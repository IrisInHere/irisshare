/* md-render.js — 客户端渲染 Typora 笔记 / AI财务纪实
 * marked + ==高亮== 扩展 + 代码高亮(highlight.js) + 公式(KaTeX) + 目录大纲 + 滚动高亮 */
(function(){
  function esc(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  if(!window.marked) return;

  marked.setOptions({ gfm:true, breaks:false, mangle:false, headerIds:false });
  marked.use({ extensions:[{
    name:'mark', level:'inline',
    start(src){ const i=src.indexOf('=='); return i<0?undefined:i; },
    tokenizer(src){ const m=/^==([\s\S]+?)==/.exec(src); if(m) return { type:'mark', raw:m[0], text:m[1], tokens:this.lexer.inline(m[1]) }; },
    renderer(t){ return '<mark>'+this.parser.parseInline(t.tokens)+'</mark>'; }
  }]});

  /* 注册轻量 Power Query (M) 语法高亮，供 AI财务 模块代码块使用 */
  function registerPowerQuery(hljs){
    if(!hljs || hljs.getLanguage('powerquery')) return;
    hljs.registerLanguage('powerquery', function(hljs){
      return {
        name:'Power Query M', aliases:['m','pq'],
        keywords:{ keyword:'let in if then else each function try otherwise and or not as type error',
          built_in:'Table List Record Text Number DateTime Time Logical Duration Binary Byte Type' },
        contains:[ hljs.C_LINE_COMMENT_MODE, hljs.C_BLOCK_COMMENT_MODE, hljs.QUOTE_STRING_MODE, hljs.C_NUMBER_MODE ]
      };
    });
  }

  /* 公式渲染：遍历文本节点，把 $...$ 与 $$...$$ 交给 KaTeX */
  function renderMath(root){
    if(!window.katex) return;
    const skip=/^(SCRIPT|STYLE|CODE|PRE|MARK|TEXTAREA)$/;
    const pat=/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    const walk=node=>{
      [...node.childNodes].forEach(child=>{
        if(child.nodeType!==3) return;            // 仅处理文本节点
        if(child.parentNode && skip.test(child.parentNode.tagName)) return;
        const text=child.nodeValue;
        if(!text.includes('$')) return;
        pat.lastIndex=0;
        let m, last=0, frag=document.createDocumentFragment(), hit=false;
        while((m=pat.exec(text))!==null){
          hit=true;
          if(m.index>last) frag.appendChild(document.createTextNode(text.slice(last,m.index)));
          const display=m[1]!==undefined, tex=display?m[1]:m[2];
          try{
            const span=document.createElement('span');
            span.innerHTML=katex.renderToString(tex,{displayMode:display,throwOnError:false,output:'html'});
            frag.appendChild(span);
          }catch(e){ frag.appendChild(document.createTextNode(display?'$$'+tex+'$$':'$'+tex+'$')); }
          last=pat.lastIndex;
        }
        if(hit){ if(last<text.length) frag.appendChild(document.createTextNode(text.slice(last))); child.parentNode.replaceChild(frag,child); }
      });
    };
    walk(root);
  }

  function parseFM(raw){
    const fm={}; let body=raw;
    const m=/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
    if(m){
      body=raw.slice(m[0].length).replace(/\r\n/g,'\n');
      m[1].split(/\r?\n/).forEach(line=>{
        const i=line.indexOf(':'); if(i<0) return;
        const k=line.slice(0,i).trim();
        let v=line.slice(i+1).trim();
        if(v.startsWith('[')&&v.endsWith(']')) fm[k]=v.slice(1,-1).split(',').map(s=>s.trim().replace(/^["']|["']$/g,'').replace(/^#/,''));
        else fm[k]=v.replace(/^["']|["']$/g,'');
      });
    }
    return { fm, body };
  }

  /* 把扁平标题列表按层级构造成树（支持跳级） */
  function buildTree(flat){
    const root={lv:0, children:[]};
    const stack=[root];
    flat.forEach(item=>{
      const node={lv:item.lv, id:item.id, text:item.text, children:[]};
      while(stack.length>1 && stack[stack.length-1].lv>=node.lv) stack.pop();
      stack[stack.length-1].children.push(node);
      stack.push(node);
    });
    return root.children;
  }
  function loadTocCollapse(file){
    try{ return JSON.parse(localStorage.getItem('irisshare-toc::'+file)||'{}')||{}; }catch(e){ return {}; }
  }
  function saveTocCollapse(file,map){
    try{ localStorage.setItem('irisshare-toc::'+file, JSON.stringify(map)); }catch(e){}
  }

  window.renderNote=function(file){
    const box=document.getElementById('noteBody');
    const tocEl=document.getElementById('toc');
    fetch(file)
      .then(r=>{ if(!r.ok) throw new Error(r.status); return r.text(); })
      .then(raw=>{
        const { fm, body }=parseFM(raw);
        const tmp=document.createElement('div');
        tmp.innerHTML=marked.parse(body);

        if(window.hljs){ registerPowerQuery(window.hljs); tmp.querySelectorAll('pre code').forEach(el=>{ try{ window.hljs.highlightElement(el); }catch(e){} }); }
        renderMath(tmp);

        const toc=[];
        tmp.querySelectorAll('h1,h2,h3,h4').forEach((h,idx)=>{
          const txt=h.textContent.trim();
          h.id='h'+idx+'-'+txt.replace(/[^\w一-龥]/g,'').slice(0,20);
          h.style.scrollMarginTop='80px';
          toc.push({ lv:+h.tagName[1], id:h.id, text:txt });
        });
        box.innerHTML=tmp.innerHTML;

        const metaEl=document.getElementById('noteMeta');
        if(metaEl){
          const parts=[];
          if(fm.book_id) parts.push('<span class="mid">ID '+esc(fm.book_id)+'</span>');
          if(fm.author) parts.push('<span class="ma">'+esc(fm.author)+'</span>');
          const cat=fm.genre||fm.category||'';
          if(cat) parts.push('<span class="mg">'+esc(cat)+'</span>');
          if(Array.isArray(fm.tags)&&fm.tags.length) parts.push('<span class="mt">'+fm.tags.map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</span>');
          if(fm.date) parts.push('<span class="md">'+esc(fm.date)+'</span>');
          metaEl.innerHTML=parts.join('');
          metaEl.style.display=parts.length?'flex':'none';
        }

        if(tocEl){
          const tree=buildTree(toc);
          const collapseMap=loadTocCollapse(file);
          const renderNode=n=>{
            const hasKids=n.children && n.children.length;
            const li=document.createElement('div');
            li.className='toc-node lv'+n.lv;
            const row=document.createElement('div');
            row.className='toc-row';
            const link=document.createElement('a');
            link.href='#'+n.id;
            link.className='toc-link';
            link.textContent=n.text;
            link.addEventListener('click',e=>{
              e.preventDefault();
              const el=document.getElementById(n.id);
              if(el) el.scrollIntoView({behavior:'smooth'});
            });
            const defaultCollapsed=n.lv>=3;                       // 默认展开至 h3，h4 及以下默认收起
            const collapsed=(n.id in collapseMap)?!!collapseMap[n.id]:defaultCollapsed;
            if(hasKids){
              const btn=document.createElement('button');
              btn.className='toc-toggle';
              btn.setAttribute('aria-label', collapsed?'展开子目录':'收起子目录');
              btn.textContent=collapsed?'▸':'▾';
              btn.addEventListener('click',ev=>{
                ev.stopPropagation();
                const isCollapsed=li.classList.toggle('collapsed');
                btn.textContent=isCollapsed?'▸':'▾';
                collapseMap[n.id]=isCollapsed;
                saveTocCollapse(file,collapseMap);
              });
              row.appendChild(btn);
            }
            row.appendChild(link);
            li.appendChild(row);
            if(hasKids){
              const kids=document.createElement('div');
              kids.className='toc-children';
              n.children.forEach(c=>kids.appendChild(renderNode(c)));
              li.appendChild(kids);
              if(collapsed) li.classList.add('collapsed');
            }
            return li;
          };
          const wrap=document.createElement('div');
          wrap.className='toc-tree';
          tree.forEach(n=>wrap.appendChild(renderNode(n)));
          tocEl.innerHTML='<div class="toc-title">目录</div>';
          tocEl.appendChild(wrap);

          const links=[...tocEl.querySelectorAll('a.toc-link')];
          const obs=new IntersectionObserver(es=>{
            es.forEach(en=>{ if(en.isIntersecting){
              const id='#'+en.target.id;
              links.forEach(l=>l.classList.toggle('active', l.getAttribute('href')===id));
            }});
          },{ rootMargin:'-80px 0px -70% 0px' });
          toc.forEach(t=>{ const el=document.getElementById(t.id); if(el) obs.observe(el); });
        }
        document.title=(fm.title||'笔记')+' · IrisShare';
      })
      .catch(err=>{ box.innerHTML='<p style="color:var(--em)">笔记加载失败：'+err.message+'</p>'; });
  };
})();
