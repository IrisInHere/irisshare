/* auth.js — GitHub OAuth Device Flow 登录 + 保持登录 + 在线编辑保存
 * 原理：GitHub 设备授权（RFC 8628），纯静态站点可用，无需后端 secret。
 * 流程：发起 device code → 展示 8 位验证码 → 用户在 github.com/login/device 输入 → 轮询拿 token → localStorage 持久化。
 */
(function(){
  var CLIENT_ID = 'Ov23livfADPmltV13nYA'; // 用户创建 OAuth App 后填入
  var OWNER='IrisInHere', REPO='irisshare';
  var TOKEN_KEY='irisshare-gh-token', USER_KEY='irisshare-gh-user';
  var api='https://api.github.com';

  function getToken(){ try{ return localStorage.getItem(TOKEN_KEY)||''; }catch(e){ return ''; } }
  function getUser(){ try{ return JSON.parse(localStorage.getItem(USER_KEY)||'null'); }catch(e){ return null; } }

  /* ---------- 登录（Device Flow） ---------- */
  function startLogin(){
    if(!CLIENT_ID || CLIENT_ID.indexOf('REPLACE')===0){
      alert('网站还未配置 GitHub 登录（缺少 Client ID）。请联系站长配置。');
      return;
    }
    return fetch('https://github.com/login/device/code', {
      method:'POST',
      headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},
      body:'client_id='+encodeURIComponent(CLIENT_ID)+'&scope=repo'
    }).then(function(r){ return r.json(); }).then(function(data){
      if(data.error) throw new Error(data.error_description||data.error);
      // 展示验证码 + 授权链接
      var msg='1. 打开授权页面：'+data.verification_uri+'\n2. 输入验证码：'+data.user_code+'\n3. 点击 Authorize 授权（有效期 '+Math.floor(data.expires_in/60)+' 分钟）';
      alert(msg);
      // 轮询拿 token
      return pollToken(data.device_code, data.interval, data.expires_in);
    }).then(function(token){
      localStorage.setItem(TOKEN_KEY, token);
      return fetchUser(token);
    }).then(function(user){
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      onAuthChange();
      return user;
    });
  }

  function pollToken(deviceCode, interval, expiresIn){
    var deadline=Date.now()+(expiresIn||900)*1000;
    return new Promise(function(resolve, reject){
      (function tick(){
        if(Date.now()>deadline){ reject(new Error('验证码已过期，请重新登录')); return; }
        setTimeout(function(){
          fetch('https://github.com/login/oauth/access_token', {
            method:'POST',
            headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},
            body:'client_id='+encodeURIComponent(CLIENT_ID)+'&device_code='+encodeURIComponent(deviceCode)+'&grant_type=urn:ietf:params:oauth:grant-type:device_code'
          }).then(function(r){ return r.json(); }).then(function(data){
            if(data.access_token){ resolve(data.access_token); return; }
            if(data.error==='authorization_pending' || data.error==='slow_down'){ tick(); return; }
            reject(new Error(data.error_description||data.error||'授权失败'));
          }).catch(function(e){ reject(e); });
        }, Math.max((interval||5)*1000, 5000));
      })();
    });
  }

  function fetchUser(token){
    return fetch(api+'/user', { headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'} })
      .then(function(r){ if(!r.ok) throw new Error('获取用户信息失败'); return r.json(); });
  }

  /* ---------- 登出 ---------- */
  function logout(){
    try{ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }catch(e){}
    onAuthChange();
    // 若在编辑态则刷新页面回到阅读态
    if(location.search.indexOf('edit')>=0) location.reload();
  }

  /* ---------- 在线编辑：读取 / 保存 笔记文件 ---------- */
  function readFile(path){
    var token=getToken();
    var h={Accept:'application/vnd.github+json'};
    if(token) h.Authorization='Bearer '+token;
    return fetch(api+'/repos/'+OWNER+'/'+REPO+'/contents/'+path, { headers:h })
      .then(function(r){ if(!r.ok) throw new Error('读取文件失败 HTTP '+r.status); return r.json(); });
  }

  function saveFile(path, content, message){
    var token=getToken();
    if(!token) throw new Error('未登录');
    // 先取 sha（避免覆盖他人修改冲突）
    return readFile(path).then(function(meta){
      return fetch(api+'/repos/'+OWNER+'/'+REPO+'/contents/'+path, {
        method:'PUT',
        headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json'},
        body:JSON.stringify({
          message:message||'chore: 在线编辑更新 '+path,
          content:btoa(unescape(encodeURIComponent(content))), // UTF-8 → base64
          sha:meta.sha
        })
      });
    }).then(function(r){
      if(!r.ok) return r.json().then(function(j){ throw new Error(j.message||('保存失败 HTTP '+r.status)); });
      return r.json();
    });
  }

  /* ---------- 笔记页在线编辑（note.html） ---------- */
  // 缓存：当前用户对该仓库是否有写权限（null=未知，false=无权限）
  var canEditCache=null;
  function checkCanEdit(){
    var token=getToken();
    if(!token) return Promise.resolve(false);
    if(canEditCache!==null) return Promise.resolve(canEditCache);
    return fetch(api+'/repos/'+OWNER+'/'+REPO, {
      headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'}
    }).then(function(r){
      if(!r.ok) return false;
      return r.json().then(function(j){
        canEditCache=!!(j.permissions && j.permissions.push);
        return canEditCache;
      });
    }).catch(function(){ return false; });
  }

  function initEditNote(){
    var editBtn=document.getElementById('editBtn');
    var body=document.getElementById('noteBody');
    var toolbar=document.getElementById('noteToolbar');
    if(!editBtn || !body) return;

    var currentFile=null;
    var src=new URLSearchParams(location.search).get('file');

    function enterEdit(){
      if(!src) return;
      readFile(src).then(function(meta){
        currentFile=meta;
        var content=decodeURIComponent(escape(atob(meta.content)));
        // 编辑界面：源码 textarea + 实时预览
        var ed=document.createElement('div');
        ed.className='note-editor';
        ed.innerHTML=
          '<div class="ne-bar">'+
            '<span class="ne-title">编辑 '+src+'</span>'+
            '<span class="ne-hint">Markdown · 实时预览 · 保存后自动重新部署（约1-2分钟）</span>'+
            '<div class="ne-actions">'+
              '<button type="button" class="ne-btn" id="neCancel">取消</button>'+
              '<button type="button" class="ne-btn ne-save" id="neSave">保存并部署</button>'+
            '</div>'+
          '</div>'+
          '<div class="ne-cols">'+
            '<textarea class="ne-src" id="neSrc" spellcheck="false"></textarea>'+
            '<div class="ne-prev note-content" id="nePrev"></div>'+
          '</div>';
        body.parentNode.insertBefore(ed, body);
        body.style.display='none';
        toolbar.style.display='none';
      checkCanEdit().then(function(can){ if(toolbar) toolbar.style.display=can?'':'none'; });

        var ta=ed.querySelector('#neSrc');
        var prev=ed.querySelector('#nePrev');
        ta.value=content;

        function renderPreview(){
          try{
            if(!window.marked) { prev.textContent='marked 未加载'; return; }
            prev.innerHTML=window.marked.parse(ta.value);
            if(window.hljs) prev.querySelectorAll('pre code').forEach(function(el){ try{ window.hljs.highlightElement(el); }catch(e){} });
          }catch(e){ prev.textContent='预览错误：'+e.message; }
        }
        ta.addEventListener('input', renderPreview);
        renderPreview();

        ed.querySelector('#neCancel').addEventListener('click', exitEdit);
        ed.querySelector('#neSave').addEventListener('click', function(){
          var btn=this;
          btn.disabled=true; btn.textContent='保存中…';
          saveFile(src, ta.value, 'chore: 在线编辑更新 '+src)
            .then(function(){ btn.textContent='✓ 已保存，重新加载…'; setTimeout(function(){ location.reload(); }, 800); })
            .catch(function(err){ btn.disabled=false; btn.textContent='保存失败，重试'; alert('保存失败：'+err.message); });
        });
      }).catch(function(err){ alert('进入编辑失败：'+err.message); });
    }

    function exitEdit(){
      var ed=document.querySelector('.note-editor');
      if(ed) ed.remove();
      body.style.display='';
      checkCanEdit().then(function(can){ if(toolbar) toolbar.style.display=can?'':'none'; });
    }

    editBtn.addEventListener('click', enterEdit);
    // 登录态变化时：异步校验仓库写权限，仅有权者显示编辑入口
    IrisAuth.onLoginChange(function(user){
      if(!user){ canEditCache=null; if(toolbar) toolbar.style.display='none'; return; }
      checkCanEdit().then(function(can){
        if(toolbar) toolbar.style.display=can?'':'none';
      });
    });
  }

  /* ---------- UI ---------- */
  var loginListeners=[];
  function notifyLogin(){
    var user=getUser();
    loginListeners.forEach(function(fn){ try{ fn(user); }catch(e){} });
  }
  function onLoginChange(fn){ loginListeners.push(fn); fn(getUser()); }

  function onAuthChange(){
    var user=getUser();
    document.querySelectorAll('[data-auth-btn]').forEach(function(el){
      if(user){
        el.classList.add('logged-in');
        var name=el.querySelector('[data-auth-name]');
        if(name) name.textContent=user.login;
      }else{
        el.classList.remove('logged-in');
        var name2=el.querySelector('[data-auth-name]');
        if(name2) name2.textContent='登录';
      }
    });
    notifyLogin();
  }

  function init(){
    // 页面加载时恢复登录态（token 已存 localStorage）
    var token=getToken();
    if(token && !getUser()){
      fetchUser(token).then(function(u){
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        onAuthChange();
      }).catch(function(){ logout(); });
    }
    onAuthChange();

    document.querySelectorAll('[data-auth-btn]').forEach(function(el){
      el.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        var user=getUser();
        if(user){ if(confirm('退出登录 '+(user.login||'')+' ？')) logout(); }
        else startLogin().catch(function(err){ alert('登录失败：'+err.message); });
      });
    });
  }

  window.IrisAuth={ getToken:getToken, getUser:getUser, startLogin:startLogin, logout:logout,
    readFile:readFile, saveFile:saveFile, onLoginChange:onLoginChange, onAuthChange:onAuthChange,
    owner:OWNER, repo:REPO, setClientId:function(id){ CLIENT_ID=id; } };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ init(); initEditNote(); });
  else { init(); initEditNote(); }
})();
