/* site.js — 深色切换 / 字号调节（持久化） / 导航高亮 */
(function(){
  const root=document.documentElement;
  // 同步顶栏实际高度（手机端导航换行后更高），供吸顶工具栏定位
  function syncHeaderH(){
    const h=document.querySelector('.site-header');
    if(h) root.style.setProperty('--header-h', h.offsetHeight+'px');
  }
  syncHeaderH();
  window.addEventListener('resize', syncHeaderH);  function applyHljs(){
    const link=document.getElementById('hljs-theme');
    if(link) link.setAttribute('href', root.getAttribute('data-theme')==='dark'?'assets/css/hljs-dark.css':'assets/css/hljs-light.css');
  }
  const themeBtn=document.getElementById('themeToggle');
  if(themeBtn){
    themeBtn.textContent=root.getAttribute('data-theme')==='dark'?'☀︎':'☾';
    applyHljs();
    themeBtn.addEventListener('click',()=>{
      const next=root.getAttribute('data-theme')==='dark'?'light':'dark';
      root.setAttribute('data-theme',next);
      try{ localStorage.setItem('irisshare-theme',next); }catch(e){}
      themeBtn.textContent=next==='dark'?'☀︎':'☾';
      applyHljs();
    });
  }
  // 字号（笔记页）
  const dec=document.getElementById('fontDec');
  if(dec){
    const inc=document.getElementById('fontInc');
    const reset=document.getElementById('fontReset');
    const lbl=document.getElementById('fontLabel');
    const MIN=14,MAX=24,DEF=18;
    let px=parseInt(localStorage.getItem('irisshare-font')||DEF,10);
    function apply(v){
      px=Math.max(MIN,Math.min(MAX,v));
      document.querySelectorAll('.note-content').forEach(el=>el.style.setProperty('--content-font-size',px+'px'));
      if(lbl) lbl.textContent=px+'px';
      try{ localStorage.setItem('irisshare-font',px); }catch(e){}
    }
    apply(px);
    dec.onclick=()=>apply(px-1);
    inc.onclick=()=>apply(px+1);
    reset.onclick=()=>apply(DEF);
  }
  // 工具栏（目录 + 字号）：默认收起，靠右侧 << 按钮展开
  const toolbar=document.querySelector('.toolbar');
  const fab=document.getElementById('toolbarFab');
  if(toolbar && fab){
    let open=localStorage.getItem('irisshare-toolbar')==='open';
    function sync(){
      toolbar.classList.toggle('collapsed', !open);
      fab.textContent=open?'>>':'<<';
      fab.setAttribute('aria-expanded', open?'true':'false');
    }
    sync();
    fab.addEventListener('click',()=>{
      open=!open;
      sync();
      try{ localStorage.setItem('irisshare-toolbar', open?'open':'collapsed'); }catch(e){}
    });
  }
  // 目录显示 / 隐藏（笔记页）
  const tocBtn=document.getElementById('tocToggle');
  if(tocBtn){
    const reader=document.querySelector('.reader');
    const toc=document.getElementById('toc');
    const mq=window.matchMedia('(max-width:860px)');
    let deskHide=localStorage.getItem('irisshare-hide-toc')==='1';

    // 移动端遮罩（点遮罩收起抽屉）
    const backdrop=document.createElement('div');
    backdrop.className='toc-backdrop';
    document.body.appendChild(backdrop);
    // 移动端背景滚动锁：仅允许目录抽屉内部滚动，其余滑动一律拦截
    let isLocked=false;
    function lockScroll(){ isLocked=true; document.body.classList.add('toc-lock'); }
    function unlockScroll(){ isLocked=false; document.body.classList.remove('toc-lock'); }
    function onTouchMove(e){
      if(!isLocked) return;
      if(toc && toc.contains(e.target)) return; // 目录内：允许原生滚动
      e.preventDefault();                        // 背景：禁止滚动穿透
    }
    document.addEventListener('touchmove', onTouchMove, {passive:false});
    const closeDrawer=()=>{ if(toc){toc.classList.remove('toc-open');} backdrop.classList.remove('show'); unlockScroll(); tocBtn.textContent='目录'; };
    backdrop.addEventListener('click',closeDrawer);

    function render(){
      if(mq.matches){
        // 移动端：抽屉模式（默认收起，忽略桌面端的 hide-toc 偏好）
        if(reader) reader.classList.remove('hide-toc');
        tocBtn.textContent=toc.classList.contains('toc-open')?'收起目录':'目录';
      }else{
        // 桌面端：原隐藏 / 显示
        if(reader) reader.classList.toggle('hide-toc',deskHide);
        if(toc) toc.classList.remove('toc-open');
        backdrop.classList.remove('show');
        unlockScroll();
        tocBtn.textContent=deskHide?'显示目录':'隐藏目录';
      }
    }
    render();
    if(mq.addEventListener) mq.addEventListener('change',render); else if(mq.addListener) mq.addListener(render);

    tocBtn.addEventListener('click',()=>{
      if(mq.matches){
        const open=!(toc && toc.classList.contains('toc-open'));
        if(toc) toc.classList.toggle('toc-open',open);
        backdrop.classList.toggle('show',open);
        open?lockScroll():unlockScroll();
        tocBtn.textContent=open?'收起目录':'目录';
      }else{
        deskHide=!deskHide;
        try{ localStorage.setItem('irisshare-hide-toc',deskHide?'1':'0'); }catch(e){}
        render();
      }
    });

    // 移动端：点目录链接后自动收起抽屉
    if(toc) toc.addEventListener('click',e=>{ if(mq.matches && e.target.closest('a.toc-link')) closeDrawer(); });
  }
})();
