/* gen-manifest.js — 解析 <dir>/*.md 头信息，生成 <dir>/manifest.json
 * 用法（站点根目录）：node tools/gen-manifest.js [文件夹]
 * 默认文件夹为 notes；AI财务模块用：node tools/gen-manifest.js ai-finance
 * 新增文章后重跑本脚本即可刷新列表。 */
const fs=require('fs');
const path=require('path');
const dir=process.argv[2]||'notes';
if(!fs.existsSync(dir)){ console.error('缺少 '+dir+'/ 目录'); process.exit(1); }
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.md'));
const out=files.map(f=>{
  const raw=fs.readFileSync(path.join(dir,f),'utf8');
  const m=/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  const fm={}; let body=raw;
  if(m){
    body=raw.slice(m[0].length).replace(/\r\n/g,'\n');
    m[1].split(/\r?\n/).forEach(l=>{
      const i=l.indexOf(':'); if(i<0) return;
      const k=l.slice(0,i).trim();
      let v=l.slice(i+1).trim();
      if(v.startsWith('[')&&v.endsWith(']')) fm[k]=v.slice(1,-1).split(',').map(s=>s.trim().replace(/^["']|["']$/g,'').replace(/^#/,''));
      else fm[k]=v.replace(/^["']|["']$/g,'');
    });
  }
  const clean=body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/,'').replace(/[#*`>_=\-]/g,' ').replace(/\s+/g,' ').trim();
  return {
    file:f,
    book_id:fm.book_id||'',
    title:fm.title||f.replace(/\.md$/,''),
    author:fm.author||'',
    tags:fm.tags||[],
    date:fm.updated||fm.date||'',
    genre:fm.genre||fm.category||'',
    summary:clean.slice(0,120)
  };
});
fs.writeFileSync(path.join(dir,'manifest.json'), JSON.stringify(out,null,2));
console.log('manifest 已生成（'+dir+'）：'+out.length+' 篇');
