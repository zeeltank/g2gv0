/* Browser preview of the sales-training scenarios (read-only, no storage). node preview.js -> ../preview.html */
const fs = require('fs')
const path = require('path')
const products = [require('./content/scholarclone'), require('./content/g2g'), require('./content/enterprise-brain')]
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sales training preview</title>
<style>
:root{--bg:#f4f6fa;--ink:#1b2a41;--mut:#5b6b82;--card:#fff;--bd:#d5dce8;--g:#1e9e5a;--a:#c77700;--r:#c93b3b}
*{box-sizing:border-box}body{margin:0;font-family:Calibri,Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--ink)}
header{padding:14px 24px;color:#fff;display:flex;justify-content:space-between;align-items:center}
h1{font-size:22px;margin:0}main{max-width:1050px;margin:0 auto;padding:20px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:18px;margin-bottom:14px}
.btn{display:block;width:100%;text-align:left;background:#fff;border:2px solid var(--c,#1b2a41);color:var(--ink);border-radius:12px;padding:14px 16px;margin:8px 0;font-size:16px;cursor:pointer;font-family:inherit}
.btn:hover{background:#eef3ff}.btn.pri{background:var(--c);color:#fff;font-weight:700;text-align:center}
.nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.nav .btn{width:auto;display:inline-block;margin:0;padding:8px 14px;font-size:14px;border-color:var(--bd);background:#e9edf5}
.tag{display:inline-block;font-size:12px;font-weight:700;border-radius:8px;padding:3px 10px;border:1px solid}
.v{color:var(--g);background:#e6f6ee;border-color:var(--g)}.t{color:var(--a);background:#fff3dc;border-color:var(--a)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.three{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}
.q{font-style:italic;font-size:20px;line-height:1.4}.mut{color:var(--mut)}
li{margin:7px 0;line-height:1.45}.shot{border:2px dashed var(--mut);background:#e9edf5;border-radius:10px;padding:30px;text-align:center;color:var(--mut)}
table{border-collapse:collapse;width:100%}td,th{border:1px solid var(--bd);padding:7px 10px;text-align:left}th{background:#0b1f3a;color:#fff}
</style></head><body><div id="app"></div>
<script>
const P=${JSON.stringify(products)};
const RT={best:['BEST MOVE','var(--g)'],partial:['PARTIAL - ACCEPTABLE BUT COSTLY','var(--a)'],poor:['POOR DECISION','var(--r)']};
let cur={t:'home'},hist=[];
const $=document.getElementById('app');
const P_=k=>P.find(p=>p.key===k);
function go(n){hist.push(cur);cur=n;render();window.scrollTo(0,0)}
function back(){if(hist.length){cur=hist.pop();render()}}
window.go=go;window.back=back;
function dest(p,i,lane,r){const last=i===p.decisions.length-1;
 if(lane==='S'){if(r==='best')return last?{t:'out',k:p.key,o:'won'}:{t:'dec',k:p.key,i:i+1,l:'S'};
  if(r==='partial')return last?{t:'out',k:p.key,o:'wonConc'}:{t:'dec',k:p.key,i:i+1,l:'M'};return{t:'rec',k:p.key,i}}
 if(r==='best')return last?{t:'out',k:p.key,o:'wonConc'}:{t:'dec',k:p.key,i:i+1,l:'S'};
 if(r==='partial')return last?{t:'out',k:p.key,o:'stalled'}:{t:'dec',k:p.key,i:i+1,l:'M'};return{t:'lost',k:p.key,i}}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const J=o=>esc(JSON.stringify(o)).replace(/"/g,'&quot;');
const B=(label,o,cls)=>'<button class="btn '+(cls||'')+'" onclick="go('+J(o)+')">'+esc(label)+'</button>';
const nav=(p,extra)=>'<div class="nav"><button class="btn" onclick="go({t:\\'home\\'})">Home</button><button class="btn" onclick="back()">Back</button>'+(p?'<button class="btn" onclick="go({t:\\'hub\\',k:\\''+p.key+'\\'})">Product hub</button><button class="btn" onclick="go({t:\\'map\\',k:\\''+p.key+'\\'})">Scenario map</button>':'')+(extra||'')+'</div>';
const ul=a=>'<ul>'+a.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
const prov=v=>'<span class="tag '+(v?'v':'t')+'">'+(v?'VERIFIED PRODUCT FACTS':'TRAINING SCENARIO - fictional customer')+'</span>';
function shell(p,title,body,v){document.title=title;$.innerHTML='<header style="background:'+(p?p.color:'#0b1f3a')+'"><h1>'+esc(title)+'</h1><span>'+prov(v===true)+'</span></header><main style="--c:'+(p?p.color:'#0b1f3a')+'">'+body+nav(p)+'</main>'}
function render(){const c=cur,p=c.k&&P_(c.k);
 if(c.t==='home')return shell(null,'Interactive Sales Training: preview','<div class="grid">'+P.map(q=>'<div class="card" style="border-top:6px solid '+q.color+'"><h2 style="color:'+q.color+'">'+esc(q.name)+'</h2><p>'+esc(q.tagline)+'</p><p class="mut" style="font-size:13px">'+esc(q.nameNote)+'</p>'+B('Open '+q.name,{t:'hub',k:q.key},'pri').replace('class="btn pri"','class="btn pri" style="--c:'+q.color+'"')+'</div>').join('')+'</div><p class="mut">Preview only. Nothing is stored. Personas and customer lines are fictional training content.</p>');
 if(c.t==='hub'){const items=[['Overview','overview'],['Modules and offers','modules'],['Customer problems solved','problems'],['Target customers','customers'],['Benefits and USPs','benefits'],['Use cases and proof','proof'],['Readiness and limitations','readiness'],['What we cannot claim','missing']];
  return shell(p,p.name+' - Product hub','<p class="mut">'+esc(p.tagline)+'</p><div class="grid">'+items.map(([l,id])=>B(l,{t:'info',k:p.key,id})).join('')+'</div><div class="card" style="margin-top:14px"><h3>Practise the sale</h3><p>Branching simulation with '+esc(p.persona.name)+', '+p.decisions.length+' decisions across 11 stages.</p>'+B('Meet the customer',{t:'persona',k:p.key},'pri')+'</div>',true)}
 if(c.t==='info'){const F=p.front;let title,body,v=true;
  const sh=s=>s?'<div class="shot">Screenshot placeholder<br>'+esc(s)+'</div>':'';
  if(c.id==='overview'){title='Overview';body='<div class="card">'+ul(F.overview.bullets)+'<p class="mut">Source: '+esc(F.overview.src)+'</p></div>'+sh(F.overview.shot)}
  else if(c.id==='modules'){title='Modules and offers';body=F.modules.map((m,i)=>B(m.title,{t:'mod',k:p.key,i})).join('')}
  else if(c.id==='problems'){title='Customer problems solved';body='<div class="card">'+ul(F.problems.bullets)+'<p class="mut">Source: '+esc(F.problems.src)+'</p></div>'}
  else if(c.id==='customers'){title='Target customers';body='<div class="card">'+ul(F.customers.bullets)+'<p class="mut">Source: '+esc(F.customers.src)+'</p></div>'}
  else if(c.id==='benefits'){title='Benefits and USPs';body='<div class="three"><div class="card" style="background:#e6f6ee"><h3>Documented (you may say this)</h3>'+ul(F.benefits.verified)+'</div><div class="card" style="background:#fdeaea"><h3>NOT documented (do not claim)</h3>'+ul(F.benefits.missing)+'</div></div>'}
  else if(c.id==='proof'){title='Use cases and proof points';body='<div class="card">'+ul(F.proof.bullets)+'<p class="mut">Source: '+esc(F.proof.src)+'</p></div>'}
  else if(c.id==='readiness'){title='Readiness and limitations';body='<table><tr><th>Offer</th><th>Portfolio readiness status</th></tr>'+F.readiness.rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td><b>'+esc(r[1])+'</b></td></tr>').join('')+'</table><div class="card" style="margin-top:12px;background:#fff3dc"><h3>Limitations</h3>'+ul(F.readiness.notes)+'</div>'}
  else {title='What we cannot claim: missing information';body='<div class="card" style="background:#fdeaea"><p><b>No source exists for these. If asked, say you will confirm and come back.</b></p>'+ul(F.missing)+'</div>'}
  return shell(p,title,body+B('Back to product hub',{t:'hub',k:p.key},'pri'),v)}
 if(c.t==='mod'){const m=p.front.modules[c.i];return shell(p,m.title,'<div class="card">'+ul(m.bullets)+'<p class="mut">Source: '+esc(m.src)+'</p></div><div class="shot">Screenshot placeholder<br>'+esc(m.shot)+'</div>'+B('Back to modules',{t:'info',k:p.key,id:'modules'}),true)}
 if(c.t==='persona')return shell(p,'Meet the customer','<div class="card"><h2>'+esc(p.persona.name)+'</h2><p class="mut">'+esc(p.persona.role)+'</p>'+ul(p.persona.bullets)+'<p style="color:var(--a)"><i>'+esc(p.persona.note)+'</i></p></div>'+B('Start the scenario',{t:'dec',k:p.key,i:0,l:'S'},'pri'));
 if(c.t==='map')return shell(p,'Scenario map: replay any decision','<div class="grid">'+p.decisions.map((d,i)=>B('Decision '+(i+1)+' | Stage'+(d.stageNums.length>1?'s '+d.stageNums.join('-'):' '+d.stageNums[0])+' | '+d.stage,{t:'dec',k:p.key,i,l:'S'})).join('')+'</div><p class="mut">Stages: 1 Introduction, 2 Requirements, 3 Business problems, 4 Recommendation, 5 Demonstration, 6 Questions, 7 Objections, 8 Competitors, 9 Price and negotiation, 10 Closing, 11 Follow-up.</p>');
 if(c.t==='dec'){const d=p.decisions[c.i];const S=c.l==='S';
  return shell(p,d.stage+'  ('+(c.i+1)+'/'+p.decisions.length+')','<div class="card"><b>'+esc(p.persona.name)+'</b> <span class="mut">'+esc(p.persona.role)+'</span><p class="q">'+esc(S?d.scene:d.sceneM)+'</p><span class="tag '+(S?'v':'t')+'">Customer confidence: '+(S?'STRONG':'WAVERING')+'</span></div><h3>'+esc(d.prompt)+'</h3>'+d.options.map((o,j)=>B(String.fromCharCode(65+j)+'.  '+o.label,{t:'fb',k:p.key,i:c.i,l:c.l,j})).join(''))}
 if(c.t==='fb'){const d=p.decisions[c.i],o=d.options[c.j],r=RT[o.rating],to=dest(p,c.i,c.l,o.rating);
  const conf=to.t==='dec'?(to.l==='S'?'Strong':'Wavering'):to.t==='rec'?'At risk':to.t==='out'?'Final outcome':'Deal lost';
  return shell(p,'Decision '+(c.i+1)+' result','<p style="font-size:18px;font-weight:700;color:'+r[1]+'">'+r[0]+'</p><p class="mut"><i>You chose: '+esc(o.label)+'</i></p><div class="three"><div class="card"><h3>Customer reaction</h3><p>'+esc(o.react)+'</p></div><div class="card"><h3>Consequence</h3><p>'+esc(o.result)+'</p></div><div class="card"><h3>Coaching</h3><p>'+esc(o.coach)+'</p></div></div><p><b style="color:'+r[1]+'">Customer confidence after this move: '+conf+'</b></p>'+B('Continue',to,'pri')+B('Return to decision',{t:'dec',k:p.key,i:c.i,l:c.l}))}
 if(c.t==='rec'){const d=p.decisions[c.i],last=c.i===p.decisions.length-1;
  return shell(p,'Recovery moment','<div class="card" style="background:#fdeaea"><p class="q">'+esc(d.recovery.line)+'</p><b style="color:var(--r)">Customer confidence: AT RISK</b></div><h3>How do you respond?</h3>'+B(d.recovery.good,last?{t:'out',k:p.key,o:'stalled'}:{t:'dec',k:p.key,i:c.i+1,l:'M'})+B(d.recovery.bad,{t:'lost',k:p.key,i:c.i})+B('Return to decision',{t:'dec',k:p.key,i:c.i,l:'S'}))}
 if(c.t==='lost'){const d=p.decisions[c.i];return shell(p,p.outcomes.lost.title,'<div class="card" style="background:#fdeaea"><p class="q">'+esc(d.lost)+'</p></div><p>Decision '+(c.i+1)+': '+esc(d.stage)+'. Replay it and try a different approach.</p>'+B('Replay decision '+(c.i+1),{t:'dec',k:p.key,i:c.i,l:'S'},'pri')+B('Start over',{t:'dec',k:p.key,i:0,l:'S'}))}
 if(c.t==='out'){const o=p.outcomes[c.o],tier={won:'Excellent',wonConc:'Good, with room to improve',stalled:'Needs work'}[c.o];
  return shell(p,o.title,'<div class="card"><p style="font-size:18px">'+esc(o.text)+'</p></div><div class="card"><h3>Sales performance evaluation: '+tier+'</h3>'+ul(o.lessons)+'</div>'+B('Replay the scenario',{t:'dec',k:p.key,i:0,l:'S'},'pri')+B('Review decisions (map)',{t:'map',k:p.key}))}
}
render();
</script></body></html>`
fs.writeFileSync(path.join(__dirname, '..', 'preview.html'), html)
console.log('wrote preview.html')
