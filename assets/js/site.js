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
  // 目录抽屉（含字号控件）：默认收起，左侧 << 把手滑出（<< 变 >>），再点收回
  const drawer=document.getElementById('tocDrawer');
  const tocFab=document.getElementById('tocFab');
  if(drawer && tocFab){
    const mq=window.matchMedia('(max-width:860px)');
    const backdrop=document.createElement('div');
    backdrop.className='toc-backdrop';
    document.body.appendChild(backdrop);
    // 移动端背景滚动锁：仅允许抽屉内部滚动，其余滑动一律拦截
    let isLocked=false;
    function lockScroll(){ isLocked=true; document.body.classList.add('toc-lock'); }
    function unlockScroll(){ isLocked=false; document.body.classList.remove('toc-lock'); }
    function onTouchMove(e){
      if(!isLocked) return;
      if(drawer.contains(e.target)) return; // 抽屉内：允许原生滚动
      e.preventDefault();                   // 背景：禁止滚动穿透
    }
    document.addEventListener('touchmove', onTouchMove, {passive:false});
    function openDrawer(){ drawer.classList.add('toc-open'); backdrop.classList.add('show'); tocFab.textContent='>>'; tocFab.setAttribute('aria-expanded','true'); if(mq.matches) lockScroll(); }
    function closeDrawer(){ drawer.classList.remove('toc-open'); backdrop.classList.remove('show'); tocFab.textContent='<<'; tocFab.setAttribute('aria-expanded','false'); unlockScroll(); }
    function toggleDrawer(){ drawer.classList.contains('toc-open')?closeDrawer():openDrawer(); }
    tocFab.addEventListener('click',toggleDrawer);
    backdrop.addEventListener('click',closeDrawer);
    // 移动端：点目录链接后自动收起抽屉
    drawer.addEventListener('click',e=>{ if(mq.matches && e.target.closest('a.toc-link')) closeDrawer(); });
    // 视口从移动切到桌面时解除锁定
    const onMq=()=>{ if(!mq.matches) unlockScroll(); };
    if(mq.addEventListener) mq.addEventListener('change',onMq); else if(mq.addListener) mq.addListener(onMq);
  }
})();
