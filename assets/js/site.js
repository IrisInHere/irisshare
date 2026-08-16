/* site.js — 深色切换 / 字号调节（持久化） / 导航高亮 */
(function(){
  const root=document.documentElement;
  function applyHljs(){
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
  // 目录显示 / 隐藏（笔记页）
  const tocBtn=document.getElementById('tocToggle');
  if(tocBtn){
    const reader=document.querySelector('.reader');
    let hide=localStorage.getItem('irisshare-hide-toc')==='1';
    function applyToc(){
      if(reader) reader.classList.toggle('hide-toc',hide);
      tocBtn.textContent=hide?'显示目录':'隐藏目录';
    }
    applyToc();
    tocBtn.onclick=()=>{
      hide=!hide;
      try{ localStorage.setItem('irisshare-hide-toc',hide?'1':'0'); }catch(e){}
      applyToc();
    };
  }
})();
