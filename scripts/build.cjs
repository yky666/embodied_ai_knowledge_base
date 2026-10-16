const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const katexDist=path.dirname(require.resolve('katex'));
const mermaidDist=path.dirname(require.resolve('mermaid'));
const katex=require('katex'), {marked}=require('marked');
const launch=require('./browser.cjs').launch;
const assets=path.join(root,'assets');fs.mkdirSync(assets,{recursive:true});fs.mkdirSync(path.join(root,'build'),{recursive:true});
fs.cpSync(path.join(katexDist,'fonts'),path.join(assets,'fonts'),{recursive:true});
fs.copyFileSync(path.join(katexDist,'katex.min.css'),path.join(assets,'katex.min.css'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=s=>s.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,'-');
const files=fs.readdirSync(root).filter(n=>n.endsWith('.md')).sort((a,b)=>a.localeCompare(b,'zh-CN'));
const docs=files.map(file=>{let raw=fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,'');return{file,raw,html:file.replace(/\.md$/,'.html'),title:raw.match(/^# (.+)$/m)?.[1]||file};});
let mathCount=0,diagramCount=0;
function math(tex,display){mathCount++;return katex.renderToString(tex,{displayMode:display,throwOnError:true,strict:'ignore',output:'htmlAndMathml',trust:false});}
function shell(title,body,d=null,toc=''){
 const lab=`<a data-label="10 · 交互式直觉实验" class="${!d&&title.startsWith('10')?'active':''}" href="10_交互实验.html">10 · 交互式直觉实验</a>`;
 const nav=docs.map(x=>(x.file.startsWith('11')?lab:'')+`<a data-label="${esc(x.title.toLowerCase())}" class="${d?.file===x.file?'active':''}" href="${esc(x.html)}">${esc(x.title)}</a>`).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 基础知识</title><link rel="stylesheet" href="assets/katex.min.css"><link rel="stylesheet" href="assets/atlas.css"></head><body><div class="layout"><aside class="sidebar"><div class="brand"><small>RESEARCH FOUNDATIONS</small>AI · Robotics<br>Spatial Intelligence</div><p>公式 · 几何 · 闭环行动</p><input class="search" id="search" aria-label="搜索模块" placeholder="搜索模块…"><nav class="nav"><a href="index.html">⌂ 知识库首页</a>${nav}</nav></aside><main class="main"><div class="toolbar"><span id="reading-mode">详细推导</span><button id="detail-mode">展开全部推导</button><button id="brief-mode">精简模式</button><button id="print">打印 / PDF</button></div><article class="article"><h1>${esc(title)}</h1><div class="meta">基础讲义 · 2026-10-12 · 本地公式与矢量图 · 点击图示放大</div>${toc}${body}<div class="foot">来源与核验状态见 <a href="参考资料.html">参考资料</a> · <a href="${d?.file||'README.md'}">Markdown 源稿</a></div></article></main></div><dialog id="zoom" class="zoom"><button>关闭放大图</button><img alt="放大图"></dialog><script src="assets/atlas.js"></script></body></html>`;
}
function transformer(){
 const block=(x,y,label,sub='',color='#edf3ef')=>`<g><rect x="${x}" y="${y}" width="300" height="52" rx="7" fill="${color}" stroke="#8da9ae"/><text x="${x+150}" y="${y+22}" class="label">${esc(label)}</text><text x="${x+150}" y="${y+40}" class="small">${esc(sub.replace('&lt;','<'))}</text></g>`;
 const arrow=(x,y,x2,y2,extra='')=>`<path d="M${x} ${y} L${x2} ${y2}" class="arrow" ${extra}/>`;
 const skip=(x,y,y2)=>`<path d="M${x+150} ${y} H${x-27} V${y2} H${x}" class="skip"/><text x="${x-30}" y="${(y+y2)/2}" class="tiny" text-anchor="end">residual</text>`;
 let b=`<text x="550" y="38" class="title">Classic Transformer · Encoder–Decoder / Post-LN</text><text x="550" y="63" class="small">教学重绘 · 数据由上向下 · 不同序列长度 n 与 m · 图中省略 dropout</text>`;
 b+=`<rect x="91" y="260" width="357" height="492" rx="15" fill="#f4f8fb" stroke="#aac1cc"/><rect x="601" y="260" width="358" height="492" rx="15" fill="#f3f6f0" stroke="#afc4ad"/><text x="270" y="285" class="label">Encoder layer × N</text><text x="780" y="285" class="label">Decoder layer × N</text>`;
 b+=block(120,94,'输入序列 x₁ … xₙ','source tokens')+block(630,94,'右移目标：BOS, y₁ … yₘ₋₁','训练：teacher forcing / 推理：已生成前缀');
 b+=block(120,181,'输入嵌入 + 位置编码','X ∈ Rⁿˣᵈ')+block(630,181,'目标嵌入 + 位置编码','Y ∈ Rᵐˣᵈ');
 for(let x of [120,630])b+=arrow(x+150,146,x+150,181)+arrow(x+150,233,x+150,312);
 b+=block(120,312,'Multi-Head Self-Attention','Q, K, V 都来自编码器输入','#e4eff7')+block(120,391,'Add & LayerNorm','LN(X + Attention(X))')+block(120,486,'Position-wise FFN','ReLU / 两个线性层','#f7eedf')+block(120,565,'Add & LayerNorm','LN(U + FFN(U))');
 b+=block(630,312,'Masked Multi-Head Self-Attention','因果 mask 禁止看未来目标','#e4eff7')+block(630,391,'Add & LayerNorm','第一条残差')+block(630,470,'Multi-Head Cross-Attention','Q ← 解码器；K,V ← 编码器输出','#e1f0e9')+block(630,549,'Add & LayerNorm','第二条残差')+block(630,628,'Position-wise FFN','逐 token 非线性变换','#f7eedf')+block(630,699,'Add & LayerNorm','第三条残差');
 b+=arrow(270,364,270,391)+arrow(270,443,270,486)+arrow(270,538,270,565)+arrow(270,617,270,684);
 b+=block(120,684,'编码器最终输出 Z','送至每个解码层作为 K,V','#dce9f2');
 for(const [y,y2] of [[364,391],[443,470],[522,549],[601,628],[680,699]])b+=arrow(780,y,780,y2);
 b+=skip(120,300,417)+skip(120,466,591)+skip(630,300,417)+skip(630,449,575)+skip(630,615,725);
 b+=`<path d="M420 710 H530 V496 H630" class="arrow"/><text x="532" y="477" class="small" text-anchor="middle">K,V</text><text x="796" y="461" class="tiny">Q</text>`;
 b+=arrow(780,751,780,800)+block(630,800,'Linear → Softmax','p(yᵢ | y&lt;ᵢ, source)','#e6ece9');
 b+=`<text x="270" y="809" class="small">每个子层输出宽度 d 相同，才能相加</text><text x="270" y="835" class="small">蓝实线：主流 / 绿虚线：残差支路</text><text x="550" y="892" class="small">Pre-LN 把归一化放在子层之前，顺序与本图不同 · 原论文 §3 / Figure 1</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="925" viewBox="0 0 1100 925" role="img"><title>经典 Transformer 编码器解码器</title><defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#426b86"/></marker></defs><style>text{font-family:'Segoe UI','Microsoft YaHei',sans-serif;fill:#213e4b;text-anchor:middle}.title{font-size:23px;font-weight:600}.label{font-size:16px;font-weight:600}.small{font-size:12px;fill:#5a737b}.tiny{font-size:10px;fill:#5b8075}.arrow{fill:none;stroke:#426b86;stroke-width:2;marker-end:url(#a)}.skip{fill:none;stroke:#579983;stroke-width:2;stroke-dasharray:5 4;marker-end:url(#a)}</style><rect width="1100" height="925" fill="white"/>${b}</svg>`;
}
function spatial(){return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="420" viewBox="0 0 920 420"><style>text{font:15px 'Segoe UI','Microsoft YaHei',sans-serif;fill:#345762}.t{font-size:19px;font-weight:600}line,path{stroke-width:3;fill:none}</style><rect width="920" height="420" fill="#fbfcfa"/><text x="70" y="35" class="t">世界坐标保持不变</text><text x="520" y="35" class="t">自我中心随朝向旋转</text><path d="M90 335V100M90 335H380" stroke="#7897a6"/><text x="82" y="85">世界 y</text><text x="375" y="361">世界 x</text><circle cx="235" cy="265" r="24" fill="#366b83"/><path d="M235 260V179" stroke="#366b83"/><path d="M225 191L235 179L245 191" stroke="#366b83"/><text x="257" y="219">前 f</text><path d="M235 265H160" stroke="#579b81"/><text x="133" y="246">左 l</text><circle cx="165" cy="166" r="15" fill="#c48456"/><text x="117" y="145">杯子</text><text x="160" y="390">杯子在机器人左前方</text><path d="M525 335V100M525 335H870" stroke="#7897a6"/><circle cx="710" cy="265" r="24" fill="#366b83"/><path d="M710 265H805M793 255L805 265L793 275" stroke="#366b83"/><text x="800" y="246">前 f</text><path d="M710 265V190" stroke="#579b81"/><text x="718" y="193">左 l</text><circle cx="640" cy="166" r="15" fill="#c48456"/><text x="590" y="145">同一个杯子</text><text x="603" y="390">机器人右转 90°：杯子在左后方</text></svg>`;}
async function main(){
 fs.writeFileSync(path.join(assets,'transformer.svg'),transformer());fs.writeFileSync(path.join(assets,'spatial-reference.svg'),spatial());
 const browser=await launch();
 try{const page=await browser.newPage();await page.setViewport({width:1500,height:1000});await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({path:path.join(mermaidDist,'mermaid.min.js')});await page.evaluate(()=>mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',themeVariables:{fontFamily:'Segoe UI, Microsoft YaHei, sans-serif',fontSize:'16px',primaryColor:'#eaf2ed',primaryBorderColor:'#80a6a7',primaryTextColor:'#204553',lineColor:'#548695',secondaryColor:'#e5edf5',tertiaryColor:'#f3ecdf'},flowchart:{htmlLabels:false,curve:'basis',padding:20,useMaxWidth:false}}));
 for(const d of docs){let src=d.raw.replace(/^# .+\n/,'');const protectedChunks=[];const save=s=>{let token='ATLASCHUNK'+protectedChunks.length+'END';protectedChunks.push(s);return token;};
 let blocks=[...src.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)];for(let i=0;i<blocks.length;i++){let code=blocks[i][1].trim(),name=d.file.replace(/\.md$/,'')+'-'+(i+1),filename=name+'.svg';const svg=await page.evaluate(async({code,id})=>(await mermaid.render(id,code)).svg,{code,id:'graph'+diagramCount});diagramCount++;fs.writeFileSync(path.join(assets,filename),svg);fs.writeFileSync(path.join(assets,name+'.mmd'),code);src=src.replace(blocks[i][0],save(`<figure class="diagram"><img src="assets/${esc(filename)}" alt="${esc(d.title)} 图 ${i+1}"><figcaption>图 ${d.file.slice(0,2)}.${i+1} · 箭头表示信息 / 计算流程；具体输入、变量与假设见本节说明。</figcaption><details class="diagram-source"><summary>查看 Mermaid 图源码</summary><pre>${esc(code)}</pre></details></figure>`));}
 src=src.replace(/\$\$([\s\S]*?)\$\$/g,(_,tex)=>save(`<div class="math-block">${math(tex.trim(),true)}<details class="math-source"><summary>LaTeX 源码</summary><pre>${esc(tex.trim())}</pre></details></div>`));
 src=src.replace(/\$([^$\n]+)\$/g,(_,tex)=>save(math(tex,false)));
 // Parse source-code fences and headings while retaining raw HTML details.
 let body=marked.parse(src,{gfm:true,breaks:false});for(let i=0;i<protectedChunks.length;i++)body=body.replaceAll('<p>ATLASCHUNK'+i+'END</p>',protectedChunks[i]).replaceAll('ATLASCHUNK'+i+'END',protectedChunks[i]);
 body=body.replace(/href="([^"#]+)\.md(#[^"]*)?"/g,'href="$1.html$2"');body=body.replace(/<table>/g,'<div class="tablebox"><table>').replace(/<\/table>/g,'</table></div>');
 body=body.replace(/(<details class="derivation" open><summary>[\s\S]*?<\/summary>)/g,'$1<div>').replace(/<\/details>/g,(m,offset,text)=>{return m});
 // Close only derivation wrapper divs; math-source and other nested details remain untouched.
 body=body.replace(/<details class="derivation" open>([\s\S]*?)\n<\/details>/g,'<details class="derivation" open>$1\n</div></details>');
 const heads=[];const seen=new Map();body=body.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/g,(_,level,title)=>{let base=slug(title),num=seen.get(base)||0;seen.set(base,num+1);let id=base+(num?'-'+num:'');heads.push({level,title:title.replace(/<[^>]*>/g,''),id});return `<h${level} id="${id}">${title}</h${level}>`;});
 const toc=`<nav class="toc" aria-label="本页目录"><b>CONTENTS · 本页目录</b>${heads.filter(h=>h.level==='2').map(h=>`<a href="#${esc(h.id)}">${h.title}</a>`).join('')}</nav>`;
 let idx=docs.indexOf(d);body+=`<nav class="chapter-neighbors">${idx>0?`<a href="${docs[idx-1].html}">← ${esc(docs[idx-1].title)}</a>`:'<span></span>'}${idx<docs.length-1?`<a href="${docs[idx+1].html}">${esc(docs[idx+1].title)} →</a>`:''}</nav>`;
 fs.writeFileSync(path.join(root,d.html),shell(d.title,body,d,toc));
 }
 }finally{await browser.close();}
 const descriptions={'00':'知识模块、研究路线与任务分层','01':'最小二乘、KL、SE(3)、相机与 ELBO','02':'反传、完整 Transformer、DDPM 与流匹配','03':'二连杆、阻尼 IK、动力学、LQR 与 MPC','04':'双目、ICP、SLAM、NeRF、3DGS','05':'关系概率、信念更新、世界模型与闭环','06':'BC、动作扩散、VLA 架构与控制接口','07':'显存状态、KV、LoRA、ZeRO 与实测','08':'指标定义、Wilson 区间与实验复现','09':'经典模型和系统图的集中索引','11':'策略梯度、GAE、PPO、SAC、奖励整形与域随机化','12':'摩擦锥、力封闭、对拓抓取、阻抗控制与灵巧手','13':'占据栅格、A*、前沿探索、语义导航与 VLN','14':'点云网络、单目深度、DUSt3R、开放词汇 3D 与空间问答','15':'RSSM、想象训练、CEM 规划、视频与 JEPA 世界模型','16':'质心动力学、LIPM、捕获点、WBC 与 RL 行走','17':'数据采集、ACT、流匹配动作头、FAST 与通用策略评测','18':'动画 + 配音 + 字幕的知识点讲解视频'};
 const card=d=>`<article class="homecard"><a href="${esc(d.html)}"><small>MODULE ${d.file.slice(0,2)}</small><h3>${esc(d.title.slice(5))}</h3><p>${descriptions[d.file.slice(0,2)]||''}</p></a></article>`;
 const labCard=`<article class="homecard"><a href="10_交互实验.html"><small>INTERACTIVE LAB</small><h3>交互式直觉实验</h3><p>调节注意力温度、机械臂关节、空间参考方向与显存预算。</p></a></article>`;
 const cards=docs.filter(d=>/^\d/.test(d.file)).map(d=>(d.file.startsWith('11')?labCard:'')+card(d)).join('');
 fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI · Robotics · Spatial Intelligence 基础知识</title><link rel="stylesheet" href="assets/atlas.css"></head><body><header class="hero"><small>RESEARCH FOUNDATIONS / LOCAL EDITION</small><h1>AI · Robotics<br>Spatial Intelligence</h1><p>从数学与模型到三维感知和闭环行动。用逐步推导、完整架构、带注解的矢量图建立可复核的知识体系。</p><div class="notice" style="color:#bed0d5">2026-10-12 · 预编译公式 · 离线阅读 · 默认详细 / 可切换精简</div></header><main class="homebody"><p class="route">阅读路线：数学与坐标 → 深度学习 → 机器人学 → 三维视觉 → 空间智能 → 具身学习 → 专题（强化学习 / 抓取 / 导航 / 3D 基础模型 / 世界模型 / 腿足人形 / 机器人基础模型）· 配套 <a href="18_视频讲解.html">视频讲解</a></p><section class="homegrid">${cards}</section><p class="notice">${mathCount} 个公式片段 · ${diagramCount+2} 张独立 SVG 图 · <a href="README.html">使用与维护</a> · <a href="参考资料.html">参考资料与核验状态</a></p><p class="notice">飞书本轮登录过期，采用现有本地整理稿并补充原论文；最新飞书内容待核验。研究索引条目不等于每篇模型已完整展开。</p></main></body></html>`);
 const labFile=path.join(assets,'lab-body.html');if(fs.existsSync(labFile))fs.writeFileSync(path.join(root,'10_交互实验.html'),shell('10 · 交互式直觉实验',fs.readFileSync(labFile,'utf8')+'<script src="assets/lab.js"></script>'));
 fs.writeFileSync(path.join(root,'build/report.json'),JSON.stringify({date:'2026-10-12',pages:docs.length+2,mathFragments:mathCount,svgFigures:diagramCount+2,formulaErrors:0,diagramErrors:0},null,2));
 console.log(JSON.stringify({pages:docs.length+2,mathFragments:mathCount,svgFigures:diagramCount+2}));
}
main().catch(e=>{console.error(e);process.exit(1)});
