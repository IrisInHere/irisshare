/* notes.js — 列表页（阅读笔记 / AI财务 通用）：manifest + 全文搜索 + 标签筛选
 * 页面 body 加 data-folder="ai-finance" 即切换为 AI财务 模块。 */
(function(){
  const FOLDER=document.body.dataset.folder||'notes';
  const listEl=document.getElementById('noteList');
  const tagsEl=document.getElementById('tagBar');
  const searchEl=document.getElementById('searchInput');
  let DATA=[]; let activeTag=null;

  function stripMd(s){
    return s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/,'').replace(/[#*`>_=\-]/g,' ').replace(/\s+/g,' ').trim();
  }
  function esc(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  fetch(FOLDER+'/manifest.json')
    .then(r=>r.json())
    .then(async manifest=>{
      const items=await Promise.all(manifest.map(async m=>{
        const raw=await fetch(FOLDER+'/'+encodeURIComponent(m.file)).then(r=>r.text());
        return Object.assign({}, m, { raw });
      }));
      DATA=items;
      const tagSet=new Set();
      items.forEach(i=>(i.tags||[]).forEach(t=>tagSet.add(t)));
      tagsEl.innerHTML=[...tagSet].map(t=>'<span class="tag" data-tag="'+esc(t)+'">'+esc(t)+'</span>').join('');
      tagsEl.querySelectorAll('.tag').forEach(el=>el.onclick=()=>{
        const t=el.dataset.tag;
        if(activeTag===t){ activeTag=null; el.classList.remove('active'); }
        else{ activeTag=t; tagsEl.querySelectorAll('.tag').forEach(x=>x.classList.remove('active')); el.classList.add('active'); }
        render();
      });
      render();
      if(searchEl) searchEl.addEventListener('input', render);
    })
    .catch(e=>{ listEl.innerHTML='<div class="empty">加载失败：'+e.message+'</div>'; });

  function render(){
    const q=(searchEl?searchEl.value:'').trim().toLowerCase();
    const filtered=DATA.filter(m=>{
      if(activeTag && !(m.tags||[]).includes(activeTag)) return false;
      if(!q) return true;
      const hay=((m.title||'')+' '+(m.author||'')+' '+(m.tags||[]).join(' ')+' '+stripMd(m.raw)).toLowerCase();
      return hay.includes(q);
    });
    if(!filtered.length){ listEl.innerHTML='<div class="empty">没有匹配的笔记</div>'; return; }
    listEl.innerHTML=filtered.map(m=>{
      const tags=(m.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join('');
      return '<a class="note-card" href="note.html?file='+FOLDER+'/'+encodeURIComponent(m.file)+'">'
        +'<h3>'+esc(m.title||m.file)+(m.book_id?'<span class="bookid">#'+esc(m.book_id)+'</span>':'')+'</h3>'
        +'<div class="meta">'+(m.author||'')+(m.genre?' · '+esc(m.genre):'')+(m.date?' · '+m.date:'')+'</div>'
        +(m.summary?'<div class="sum">'+esc(m.summary)+'</div>':'')
        +'<div class="ctags">'+tags+'</div></a>';
    }).join('');
  }
})();
