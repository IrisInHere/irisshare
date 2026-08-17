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

  /* ---------- 登录（Fine-grained PAT 粘贴） ----------
   * 原因：GitHub Device Flow 端点（github.com/login/device/*）不支持浏览器跨域 CORS，
   * 纯静态站无法直接用 Device Flow。改用 PAT：用户生成一个 fine-grained token
   * 粘贴进网页，存 localStorage 保持登录。api.github.com 支持 CORS，编辑功能完全可用。
   * 安全性：fine-grained token 可限仓库 + 限 Contents 写权限 + 设过期。
   */
  function startLogin(){
    showTokenDialog();
  }

  function showTokenDialog(){
    // 移除已有弹窗
    var old=document.getElementById('patDialog'); if(old) old.remove();
    var dlg=document.createElement('div');
    dlg.id='patDialog';
    dlg.className='pat-dialog';
    dlg.innerHTML=
      '<div class="pat-mask"></div>'+
      '<div class="pat-box">'+
        '<div class="pat-head">'+
          '<h3>使用 GitHub Token 登录</h3>'+
          '<button type="button" class="pat-x" id="patClose" aria-label="关闭">×</button>'+
        '</div>'+
        '<div class="pat-body">'+
          '<ol class="pat-steps">'+
            '<li>打开 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub Token 生成页</a>（建议在 Edge/Chrome 打开）</li>'+
            '<li><b>Token name</b> 填 <code>IrisShare</code>；<b>Expiration</b> 选 1 年（过期前会提示）</li>'+
            '<li><b>Resource owner</b> 选 <code>IrisInHere</code>；<b>Repository access</b> 选 <b>Only select repositories</b> → 勾选 <code>irisshare</code></li>'+
            '<li><b>Permissions</b> → <b>Repository permissions</b> → 找到 <b>Contents</b> 改为 <b>Read and write</b></li>'+
            '<li>点底部 <b>Generate token</b> → 复制 <code>github_pat_xxx...</code> 开头的字符串，粘贴到下面</li>'+
          '</ol>'+
          '<div class="pat-input-row">'+
            '<input type="password" id="patInput" placeholder="github_pat_xxxxxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false">'+
            '<button type="button" class="pat-btn pat-primary" id="patSubmit">登录</button>'+
          '</div>'+
          '<p class="pat-tip">Token 仅保存在你浏览器本地（localStorage），不会上传到任何服务器。可随时在 GitHub → Settings → Developer settings 撤销。</p>'+
        '</div>'+
      '</div>';
    document.body.appendChild(dlg);
    var close=function(){ dlg.remove(); };
    dlg.querySelector('#patClose').onclick=close;
    dlg.querySelector('.pat-mask').onclick=close;
    var input=dlg.querySelector('#patInput');
    var submit=dlg.querySelector('#patSubmit');
    input.focus();
    var doSubmit=function(){
      var t=input.value.trim();
      if(!t){ input.focus(); return; }
      if(!/^(ghp_|github_pat_)/.test(t)){ alert('Token 格式不对，应以 ghp_ 或 github_pat_ 开头'); return; }
      submit.disabled=true; submit.textContent='验证中…';
      fetchUser(t).then(function(user){
        localStorage.setItem(TOKEN_KEY, t);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        canEditCache=null;
        close();
        onAuthChange();
      }).catch(function(err){
        submit.disabled=false; submit.textContent='登录';
        alert('Token 验证失败：'+(err.message||'无法获取用户信息')+'\n\n请检查：\n1. Token 复制是否完整（无空格、无换行）\n2. 是否勾选了 Contents 读写权限\n3. 是否选择了 irisshare 仓库');
      });
    };
    submit.onclick=doSubmit;
    input.addEventListener('keydown', function(e){ if(e.key==='Enter') doSubmit(); });
  }

  function fetchUser(token){
    return fetch(api+'/user', { headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'} })
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
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
