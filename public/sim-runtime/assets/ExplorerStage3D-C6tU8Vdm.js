import{i as e,t}from"./jsx-runtime-EIAPxkjE.js";import{t as n}from"./react-BPk_wmJm.js";import{v as r}from"./spec-C-VR6ERj.js";import{y as i}from"./rigid-load-SUSd0COQ.js";import"./explorer-Cx5byj4D.js";import{a,i as o,n as s,o as c,s as l,t as u}from"./assetNeeds-CXNunGRo.js";import{$ as d,B as f,Co as p,Cr as m,Ea as h,Eo as g,Er as _,Et as v,Gr as y,Hr as b,Ir as x,Ji as S,Mt as C,R as w,Tn as T,Tr as E,Tt as D,U as O,Ua as k,Un as ee,Va as A,Xn as j,Xt as te,Yi as M,Yt as ne,Zt as re,_n as ie,_r as N,an as ae,ao as P,co as oe,di as se,er as ce,fa as F,go as le,gr as I,ho as L,jt as ue,kr as de,mo as R,na as fe,ni as pe,nr as me,oo as z,pa as B,pr as he,qa as ge,qi as _e,rt as ve,sn as V,sr as ye,tt as H,ua as be,ur as U,ut as xe,vn as Se,wa as Ce,wt as we,xr as Te,y as Ee,yn as De,zr as Oe}from"./kindIcons-BW0CkbfM.js";import{_ as ke,c as Ae,d as W,g as je,h as Me,i as G,l as Ne,n as Pe,p as K,r as Fe,s as Ie,t as Le,u as Re}from"./GLTFLoader-rnMKEzFV.js";import{S as ze,T as Be,u as Ve,v as He,w as Ue,y as We}from"./icons-CsafLKcQ.js";import{i as Ge,l as Ke}from"./index-BUn_GCar.js";import{t as qe}from"./meshopt_decoder.module-DsNSzO1E.js";import{a as Je,i as Ye,n as Xe,o as Ze,r as Qe,s as $e,t as et}from"./checks-CIS20DCl.js";var q=e(n(),1),tt=Ke();function nt(e,t,n,r,i){let a=t[1]<-.02?Math.min(-e[1]/t[1],r*2):lt(it(e,n)),o=Math.min(r,Math.max(8,a*1.15)),s=2*o/i;return{x:Math.round((e[0]+t[0]*a)/s)*s,z:Math.round((e[2]+t[2]*a)/s)*s,half:o}}var rt=e=>({position:[...e.position],target:[...e.target],fov:e.fov}),it=(e,t)=>[e[0]-t[0],e[1]-t[1],e[2]-t[2]],at=(e,t)=>[e[0]+t[0],e[1]+t[1],e[2]+t[2]],ot=(e,t)=>[e[0]*t,e[1]*t,e[2]*t],st=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],ct=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],lt=e=>Math.hypot(e[0],e[1],e[2]),ut=e=>{let t=lt(e);return t>0?ot(e,1/t):[0,0,1]},dt=(e,t,n)=>e+(t-e)*n,ft=e=>{let t=Math.min(1,Math.max(0,e));return t*t*(3-2*t)};function pt(e){let t=e=>e.map(e=>Number.isFinite(e)?e:0),n=t(e.target),r=t(e.position);return lt(it(r,n))<1e-9&&(r=at(n,[0,0,.001])),{position:r,target:n,fov:Math.min(90,Math.max(10,Number.isFinite(e.fov)?e.fov:35))}}function mt(e,t,n){let r=Math.min(1,Math.max(-1,st(e,t))),i=Math.acos(r);if(i<1e-6)return ut(at(ot(e,1-n),ot(t,n)));let a=ct(e,t);lt(a)<1e-9&&(a=Math.abs(e[0])<.9?ct(e,[1,0,0]):ct(e,[0,1,0])),a=ut(a);let o=i*n;return ut(at(ot(e,Math.cos(o)),ot(ct(a,e),Math.sin(o))))}function ht(e,t,n){let r=pt(e),i=pt(t);if(n<=0)return r;if(n>=1)return i;let a=[dt(r.target[0],i.target[0],n),dt(r.target[1],i.target[1],n),dt(r.target[2],i.target[2],n)],o=it(r.position,r.target),s=it(i.position,i.target);return{position:at(a,ot(mt(ut(o),ut(s),n),dt(lt(o),lt(s),n))),target:a,fov:dt(r.fov,i.fov,n)}}var gt=1.3,_t=2.4;function vt(e,t){let n=pt(e);if(!(t>0)||t>=1.3)return n;let r=Math.min(_t,gt/t);return{...n,position:at(n.target,ot(it(n.position,n.target),r))}}function yt(e,t){let n=t.map(e=>lt(it(pt(e).position,pt(e).target))),r=n.length?Math.min(...n):1,i=n.length?Math.max(...n):1,a=e>0&&Number.isFinite(e)?e:i,o=Math.min(.12*a,.7*r),s=Math.max(3*a,2.6*i);return{min:o,max:s,near:o*.05,far:(s+a)*2}}var bt=e=>{let t=[];for(let n of[e.min[0],e.max[0]])for(let r of[e.min[1],e.max[1]])for(let i of[e.min[2],e.max[2]])t.push([n,r,i]);return t};function xt(e,t){let n=ut(it(e.target,e.position)),r=ct(n,[0,1,0]);r=lt(r)<1e-6?[1,0,0]:ut(r);let i=ct(r,n),[a,o,s,c]=[1/0,-1/0,1/0,-1/0];for(let e of t){let t=st(e,r),n=st(e,i);a=Math.min(a,t),o=Math.max(o,t),s=Math.min(s,n),c=Math.max(c,n)}return{w:o-a,h:c-s}}function St(e,t,n,r=[]){let i=pt(e),a=xt(i,[...bt(n),...r]),o=xt(i,[...bt(t),...r]),s=Math.max(a.w>0?o.w/a.w:1,a.h>0?o.h/a.h:1);return Number.isFinite(s)?Math.min(3,Math.max(1,s)):1}function Ct(e,t){return{...e,position:at(e.target,ot(it(e.position,e.target),t))}}var wt={light:`#f8fafc`,dark:`#0b1326`},Tt={primary:`#2463eb`,ok:`#157f3c`,warn:`#f59f0a`,bad:`#eb1414`,purple:`#6467f2`,muted:`#586a84`},Et={primary:`#79a3ff`,ok:`#4ade80`,warn:`#fbbf24`,bad:`#ff7a7a`,purple:`#a3a5ff`,muted:`#a9b6ca`},Dt={primary:`--primary`,ok:`--ok-bar`,warn:`--warn`,bad:`--bad`,purple:`--purple`,muted:`--muted`};function Ot(e,t=`light`){if(t===`dark`)return Et[e];if(typeof document<`u`){let t=getComputedStyle(document.documentElement).getPropertyValue(Dt[e]).trim();if(/^#[0-9a-f]{6}$/i.test(t))return t}return Tt[e]}var kt={primary:`#0f3ea3`,ok:`#157f3c`,warn:`#9a3412`,bad:`#b81e1e`,purple:`#4338ca`,muted:`#475569`},At=(e,t=`light`)=>t===`dark`?Et[e]:kt[e],jt={earth:{sky:`#cfe6fb`,ground:`#c5deb4`,gridMinor:`#a8c79a`,gridMajor:`#8fb384`,backdrop:`light`,haze:1},moon:{sky:`#05070f`,ground:`#3a3e49`,gridMinor:`#555b69`,gridMajor:`#6b7282`,backdrop:`dark`,haze:0},mars:{sky:`#e6b27a`,ground:`#c9785a`,gridMinor:`#b5684d`,gridMajor:`#9d583f`,backdrop:`light`,haze:.8},lab:{sky:wt.light,ground:null,gridMinor:`#c9d4e3`,gridMajor:`#b3c1d6`,backdrop:`light`,haze:0}},J=t();function Mt(e){return(0,J.jsxs)(`div`,{className:`s3-camera`,children:[(0,J.jsx)(`p`,{className:`s3-hint`,id:e.hintId,children:`Drag to turn · WASD to pan · Q / E to rotate · Scroll to zoom`}),(0,J.jsxs)(`div`,{className:`s3-toolbar`,role:`toolbar`,"aria-label":`Camera`,"aria-describedby":e.hintId,children:[(0,J.jsx)(`button`,{type:`button`,"aria-label":`Turn left`,title:`Turn left (Q)`,onClick:()=>e.onTurn(-1),children:(0,J.jsx)(Ue,{})}),(0,J.jsx)(`button`,{type:`button`,"aria-label":`Turn right`,title:`Turn right (E)`,onClick:()=>e.onTurn(1),children:(0,J.jsx)(Be,{})}),(0,J.jsx)(`span`,{className:`s3-sep`,"aria-hidden":`true`}),(0,J.jsx)(`button`,{type:`button`,"aria-label":`Zoom out`,title:`Zoom out (-)`,onClick:()=>e.onZoom(1/1.25),children:(0,J.jsx)(We,{})}),(0,J.jsx)(`button`,{type:`button`,"aria-label":`Zoom in`,title:`Zoom in (+)`,onClick:()=>e.onZoom(1.25),children:(0,J.jsx)(ze,{})}),(0,J.jsx)(`span`,{className:`s3-sep`,"aria-hidden":`true`}),(0,J.jsx)(`button`,{type:`button`,"aria-label":`Reset view`,title:`Back to the opening view (0)`,onClick:e.onHome,children:(0,J.jsx)(Ve,{})}),(0,J.jsx)(`span`,{className:`s3-sep`,"aria-hidden":`true`}),(0,J.jsx)(`div`,{role:`group`,"aria-label":`Views`,className:`s3-views`,children:e.cameras.map((t,n)=>(0,J.jsx)(`button`,{type:`button`,className:`s3-view-btn${e.active===n?` on`:``}`,"aria-pressed":e.active===n,onClick:()=>e.onPick(n),children:t.label},t.id))}),(0,J.jsx)(`span`,{className:`s3-sep`,"aria-hidden":`true`}),(0,J.jsx)(`button`,{type:`button`,className:e.labels?`on`:``,"aria-label":`Show labels`,"aria-pressed":e.labels,title:`Show or hide the labels on the model`,onClick:()=>e.onLabels(!e.labels),children:(0,J.jsx)(He,{})}),e.hasTour&&!e.tourOpen?(0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)(`span`,{className:`s3-sep`,"aria-hidden":`true`}),(0,J.jsx)(`button`,{type:`button`,id:e.tourId,className:`s3-view-btn s3-tour-btn`,onClick:e.onTour,children:`Take the tour`})]}):null]})]})}function Nt({focus:e,panelId:t,onPrev:n,onNext:r,onClose:i}){let a=(0,q.useRef)(null),o=e.index===e.count-1;return(0,J.jsxs)(`div`,{ref:a,id:t,className:`s3-tour`,"data-s3-avoid":``,role:`group`,"aria-label":`Guided tour`,tabIndex:-1,onKeyDown:t=>{if(t.key===`ArrowRight`&&!o)r();else if(t.key===`ArrowLeft`&&e.index>0)n();else if(t.key===`Escape`)i();else return;t.preventDefault()},children:[(0,J.jsxs)(`p`,{className:`s3-tour-step`,children:[`Step `,e.index+1,` of `,e.count]}),(0,J.jsx)(`p`,{className:`s3-tour-title`,children:e.stop.title}),(0,J.jsx)(`p`,{className:`s3-tour-text`,children:e.stop.text}),(0,J.jsxs)(`div`,{className:`s3-tour-actions`,children:[(0,J.jsx)(`button`,{type:`button`,className:`s3-btn`,onClick:n,disabled:e.index===0,children:`Previous`}),(0,J.jsx)(`button`,{type:`button`,className:`s3-btn s3-primary`,onClick:o?i:r,children:o?`Finish`:`Next`}),o?null:(0,J.jsx)(`button`,{type:`button`,className:`s3-btn s3-ghost`,onClick:i,children:`End tour`})]})]})}function Pt({title:e,text:t,onClose:n}){return(0,J.jsx)(`div`,{className:`s3-popwrap`,"data-s3-avoid":``,children:(0,J.jsxs)(`div`,{className:`s3-pop`,role:`dialog`,"aria-label":e,onKeyDown:e=>{e.key===`Escape`&&(e.preventDefault(),n())},children:[(0,J.jsxs)(`div`,{className:`s3-pop-head`,children:[(0,J.jsx)(`p`,{className:`s3-pop-title`,children:e}),(0,J.jsx)(`button`,{type:`button`,className:`s3-pop-x`,"aria-label":`Close`,title:`Close (Esc)`,autoFocus:!0,onClick:n,children:(0,J.jsx)(`svg`,{width:`14`,height:`14`,viewBox:`0 0 14 14`,"aria-hidden":`true`,focusable:`false`,children:(0,J.jsx)(`path`,{d:`M3 3l8 8M11 3l-8 8`,stroke:`currentColor`,strokeWidth:`1.8`,strokeLinecap:`round`,fill:`none`})})})]}),(0,J.jsx)(`p`,{className:`s3-pop-text`,children:t})]})})}function Ft({shape:e,colour:t}){return(0,J.jsx)(`svg`,{width:`14`,height:`14`,viewBox:`-7 -7 14 14`,"aria-hidden":`true`,focusable:`false`,children:e===`dot`?(0,J.jsx)(`circle`,{r:`4.5`,fill:t,stroke:`#fff`,strokeWidth:`2`}):e===`ring`?(0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)(`circle`,{r:`4.6`,fill:`none`,stroke:`#fff`,strokeWidth:`4.6`}),(0,J.jsx)(`circle`,{r:`4.6`,fill:`none`,stroke:t,strokeWidth:`2.2`})]}):e===`card`||e===`name`?(0,J.jsx)(`circle`,{r:`5.5`,fill:`#fff`,stroke:t,strokeWidth:`2.6`}):(0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)(`path`,{d:`M-4.2 -4.2L4.2 4.2M4.2 -4.2L-4.2 4.2`,stroke:`#fff`,strokeWidth:`4.8`,strokeLinecap:`round`}),(0,J.jsx)(`path`,{d:`M-4.2 -4.2L4.2 4.2M4.2 -4.2L-4.2 4.2`,stroke:t,strokeWidth:`2.2`,strokeLinecap:`round`})]})})}function It({markers:e,backdrop:t,refs:n}){let r=e=>{let t=n.current.get(e);return t||n.current.set(e,t={glyph:null,label:null,line:null}),t};return(0,J.jsxs)(`div`,{className:`s3-layer`,"aria-hidden":`true`,children:[(0,J.jsx)(`svg`,{className:`s3-leaders`,focusable:`false`,children:e.filter(e=>e.shape===`card`||e.shape===`name`).map(e=>(0,J.jsx)(`line`,{className:`s3-leader`,visibility:`hidden`,ref:t=>void(r(e.id).line=t)},e.id))}),e.map(e=>{let n=l(e),i=Ot(e.colour,t);return(0,J.jsxs)(`span`,{children:[(0,J.jsx)(`span`,{className:`s3-mk-glyph`,ref:t=>void(r(e.id).glyph=t),children:(0,J.jsx)(Ft,{shape:e.shape,colour:i})}),e.shape===`card`?(0,J.jsxs)(`span`,{className:`s3-card`,ref:t=>void(r(e.id).label=t),style:{borderLeftColor:i},children:[(0,J.jsx)(`span`,{className:`s3-card-title`,children:n.title}),n.value?(0,J.jsx)(`span`,{className:`s3-card-val num`,children:n.value}):null]}):e.shape===`name`?(0,J.jsx)(`span`,{className:`s3-name`,ref:t=>void(r(e.id).label=t),style:{color:At(e.colour,t),borderColor:i},children:n.title}):(0,J.jsxs)(`span`,{className:`s3-mk-label`,ref:t=>void(r(e.id).label=t),style:{color:At(e.colour,t),borderColor:i},children:[n.title,n.value?` ${n.value}`:``]})]},e.id)})]})}function Lt({message:e,loading:t,tour:n}){return(0,J.jsxs)(`div`,{className:`s3-fallback`,role:t?`status`:`alert`,tabIndex:t?void 0:0,children:[(0,J.jsx)(`p`,{className:`s3-fallback-msg`,children:e}),!t&&n.length>0?(0,J.jsx)(`ol`,{className:`s3-steps`,children:n.map(e=>(0,J.jsxs)(`li`,{children:[(0,J.jsxs)(`strong`,{children:[e.title,`.`]}),` `,e.text]},e.id))}):null]})}var Rt=e=>e.length<=1?e[0]??``:`${e.slice(0,-1).join(`, `)} and ${e[e.length-1]}`;function zt(e){let t=[`3D picture of ${e.model}${e.camera?`, ${e.camera} view`:`, turned by hand`}.`];return e.markers.length&&t.push(`Labelled: ${Rt(e.markers)}.`),e.rays.length&&t.push(`Lines drawn: ${Rt(e.rays)}.`),e.tour&&t.push(`Tour step ${e.tour.index+1} of ${e.tour.count}: ${e.tour.stop.title}.`),t.push(`Use the view buttons to change the camera.`),t.join(` `)}function Bt(e){return e.tour?`Step ${e.tour.index+1} of ${e.tour.count}: ${e.tour.stop.title}. ${e.camera?`Camera: ${e.camera}.`:``}`.trim():e.camera?`Camera: ${e.camera}.`:``}var Vt=24;function Ht(e){let t=e?.author?.trim();return t?t.length>40||t.includes(`,`)||/\bCC[ -]?(BY|0)\b|\blicen[cs]e/i.test(t)?!0:!!e?.licence&&t.toLowerCase().includes(e.licence.trim().toLowerCase()):!1}var Ut=e=>e.length>Vt||e.includes(`,`);function Wt(e,t=`Model`){return!e||!(e.title||e.author||e.licence)?``:`${t}: ${[[e.title,e.author?`by ${e.author}`:``].filter(Boolean).join(` `),e.licence].filter(Boolean).join(`, `)}`}function Gt(e,t=`Model`){if(!e||!(e.title||e.author||e.licence))return``;if(!Ht(e))return Wt(e,t);let n=t===`Image`&&e.licence&&!Ut(e.licence.trim())?e.licence.trim():``;return`${t}: ${[e.title,n].filter(Boolean).join(`, `)||`credited below`}`}function Kt(e){let t=e.filter(e=>e.title||e.author||e.licence);if(t.some(Ht)){if(t.length===1)return Gt(t[0]);let e=t.filter(e=>e.kind===`image`).length;return`${e===0?`Models`:e===t.length?`Images`:`Models and images`}: ${t.length}, credited below`}if(t.length<=3)return[...new Set(t.map(e=>Gt(e)))].join(` · `);let n=[...new Set(t.map(e=>e.author).filter(e=>!!e))],r=[...new Set(t.map(e=>e.licence).filter(e=>!!e))];return`Models: ${t.length} 3D models${n.length?` by ${Rt(n)}`:``}${r.length?`, ${r.join(`, `)}`:``}`}function qt(e){return[...new Set(e.map(e=>Wt(e)).filter(Boolean))].join(` · `)}var Jt=1.6,Yt=120*Jt,Xt=e=>Number.isFinite(e)?Math.min(Yt,Math.max(0,e*Jt)):0,Zt=e=>e*Jt,Qt=[{acuity:`6/60`,arcmin:50,letters:[`E`]},{acuity:`6/24`,arcmin:20,letters:[`F`,`P`]},{acuity:`6/12`,arcmin:10,letters:[`T`,`O`,`Z`]},{acuity:`6/9`,arcmin:7.5,letters:[`P`,`E`,`F`,`T`]},{acuity:`6/6`,arcmin:5,letters:[`O`,`Z`,`T`,`E`,`F`,`P`]}];function $t(e=Qt){let t=e.map(e=>Zt(e.arcmin)),n=e.map((e,n)=>e.letters.length*t[n]+(e.letters.length-1)*t[n]*.6),r=Math.ceil(Math.max(...n)+12),i=[],a=6;return e.forEach((e,o)=>{let s=(r-n[o])/2;for(let n of e.letters)i.push({letter:n,row:o,x:s,y:a,size:t[o]}),s+=t[o]*1.6;a+=t[o]+Math.max(4,.5*Math.min(t[o],t[o+1]??t[o]))}),{width:r,height:Math.ceil(a-4+6),letters:i}}var en={E:`M0.5 0V5M0 0.5H5M0 2.5H5M0 4.5H5`,F:`M0.5 0V5M0 0.5H5M0 2.5H4`,P:`M0.5 0V5M0 0.5H5M4.5 0.5V2.5M0 2.5H5`,T:`M0 0.5H5M2.5 0.5V5`,Z:`M0 0.5H5M4.5 1L0.5 4M0 4.5H5`,O:`M1.8 0.5H3.2Q4.5 0.5 4.5 1.8V3.2Q4.5 4.5 3.2 4.5H1.8Q0.5 4.5 0.5 3.2V1.8Q0.5 0.5 1.8 0.5Z`},tn=[`#a4161a`,`#0b5fa5`,`#1b7f3b`,`#6a2ca0`,`#b4540a`],nn=[`#e5383b`,`#f4811f`,`#f2c744`,`#2fa84f`,`#2f6fdf`,`#7c4fd0`],rn=e=>Math.round(e*100)/100,an=e=>Number.isFinite(e)?Math.min(1,Math.max(0,e)):1;function on(e){let t=Xt(e.blur),n=an(e.brightness),r=an(e.colour);return{blurPx:rn(t),brightness:rn(n),saturate:rn(r),css:`blur(${rn(t)}px) brightness(${rn(n)}) saturate(${rn(r)})`}}var sn=e=>an(e)<.4?`dim`:`bright`,cn=e=>{let t=an(e);return t<.25?`without colour`:t<.75?`with faded colour`:`with colour`};function ln(e){return`Eye chart as seen by this eye: ${e.sharp!==void 0&&Number.isFinite(e.sharp)?`about ${Math.round(Math.min(100,Math.max(0,e.sharp)))}% sharp`:`blurred by about ${rn(e.blur)} arcminutes`}, ${sn(e.brightness)}, ${cn(e.colour)}.`}var un=10,dn=56,fn=(0,q.memo)(function({label:e,blur:t,brightness:n,colour:r,sharp:i,reducedMotion:a,className:o,boxRef:s}){let c=(0,q.useMemo)(()=>$t(),[]),l=on({blur:t,brightness:n,colour:r}),u=c.height+8+un+6,d=(c.width-12)/nn.length,f=i!==void 0&&Number.isFinite(i)?`${Math.round(Math.min(100,Math.max(0,i)))}% sharp`:null;return(0,J.jsxs)(`figure`,{ref:s,"data-s3-avoid":``,className:`s3-inset${o?` ${o}`:``}`,children:[(0,J.jsxs)(`figcaption`,{className:`s3-inset-label`,children:[(0,J.jsx)(`span`,{children:e}),f?(0,J.jsx)(`b`,{className:`num`,children:f}):null]}),(0,J.jsx)(`div`,{className:`s3-inset-frame`,style:{width:c.width,height:u},role:`img`,"aria-label":ln({sharp:i,blur:t,brightness:n,colour:r}),children:(0,J.jsx)(`div`,{className:`s3-inset-sheet`,style:{inset:-56,padding:dn,filter:l.css,transition:a?`none`:`filter 0.25s ease`},"aria-hidden":`true`,children:(0,J.jsxs)(`svg`,{width:c.width,height:u,viewBox:`0 0 ${c.width} ${u}`,focusable:`false`,children:[c.letters.map((e,t)=>(0,J.jsx)(`g`,{transform:`translate(${e.x} ${e.y}) scale(${e.size/5})`,children:(0,J.jsx)(`path`,{d:en[e.letter],fill:`none`,stroke:tn[e.row]??`#0f1729`,strokeWidth:1})},t)),nn.map((e,t)=>(0,J.jsx)(`rect`,{x:6+t*d,y:c.height+8,width:d-2,height:un,rx:1.5,fill:e},e))]})})})]})}),pn=Ne>=125?`uv1`:`uv2`,mn=new w,hn=new L,gn=class extends ie{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new ne([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new ne([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new Se(t,6,1);return this.setAttribute(`instanceStart`,new T(n,3,0)),this.setAttribute(`instanceEnd`,new T(n,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let n;e instanceof Float32Array?n=e:Array.isArray(e)&&(n=new Float32Array(e));let r=new Se(n,t*2,1);return this.setAttribute(`instanceColorStart`,new T(r,t,0)),this.setAttribute(`instanceColorEnd`,new T(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new g(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new w);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),mn.setFromBufferAttribute(t),this.boundingBox.union(mn))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ce),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)hn.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(hn)),hn.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(hn));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}applyMatrix(e){return console.warn(`THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().`),this.applyMatrix4(e)}},_n=class extends gn{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e,t=3){let n=e.length-t,r=new Float32Array(2*n);if(t===3)for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5];else for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5],r[2*i+6]=e[i+6],r[2*i+7]=e[i+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},vn=class extends B{constructor(e){super({type:`LineMaterial`,uniforms:P.clone(P.merge([ke.common,ke.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new R(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${Ne>=154?`colorspace_fragment`:`encodings_fragment`}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA=`1`:delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return`WORLD_UNITS`in this.defines},set:function(e){e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return`USE_DASH`in this.defines},set(e){!!e!=`USE_DASH`in this.defines&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return`USE_ALPHA_TO_COVERAGE`in this.defines},set:function(e){!!e!=`USE_ALPHA_TO_COVERAGE`in this.defines&&(this.needsUpdate=!0),e===!0?(this.defines.USE_ALPHA_TO_COVERAGE=``,this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}},yn=new le,bn=new L,xn=new L,Y=new le,X=new le,Sn=new le,Cn=new L,wn=new I,Z=new ee,Tn=new L,En=new w,Dn=new Ce,On=new le,kn,An;function jn(e,t,n){return On.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),On.multiplyScalar(1/On.w),On.x=An/n.width,On.y=An/n.height,On.applyMatrix4(e.projectionMatrixInverse),On.multiplyScalar(1/On.w),Math.abs(Math.max(On.x,On.y))}function Mn(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){Z.start.fromBufferAttribute(i,r),Z.end.fromBufferAttribute(a,r),Z.applyMatrix4(n);let o=new L,s=new L;kn.distanceSqToSegment(Z.start,Z.end,s,o),s.distanceTo(o)<An*.5&&t.push({point:s,pointOnLine:o,distance:kn.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,[pn]:null})}}function Nn(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;kn.at(1,Sn),Sn.w=1,Sn.applyMatrix4(t.matrixWorldInverse),Sn.applyMatrix4(r),Sn.multiplyScalar(1/Sn.w),Sn.x*=i.x/2,Sn.y*=i.y/2,Sn.z=0,Cn.copy(Sn),wn.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(Y.fromBufferAttribute(s,t),X.fromBufferAttribute(c,t),Y.w=1,X.w=1,Y.applyMatrix4(wn),X.applyMatrix4(wn),Y.z>u&&X.z>u)continue;if(Y.z>u){let e=Y.z-X.z,t=(Y.z-u)/e;Y.lerp(X,t)}else if(X.z>u){let e=X.z-Y.z,t=(X.z-u)/e;X.lerp(Y,t)}Y.applyMatrix4(r),X.applyMatrix4(r),Y.multiplyScalar(1/Y.w),X.multiplyScalar(1/X.w),Y.x*=i.x/2,Y.y*=i.y/2,X.x*=i.x/2,X.y*=i.y/2,Z.start.copy(Y),Z.start.z=0,Z.end.copy(X),Z.end.z=0;let o=Z.closestPointToPointParameter(Cn,!0);Z.at(o,Tn);let l=he.lerp(Y.z,X.z,o),d=l>=-1&&l<=1,f=Cn.distanceTo(Tn)<An*.5;if(d&&f){Z.start.fromBufferAttribute(s,t),Z.end.fromBufferAttribute(c,t),Z.start.applyMatrix4(a),Z.end.applyMatrix4(a);let r=new L,i=new L;kn.distanceSqToSegment(Z.start,Z.end,i,r),n.push({point:i,pointOnLine:r,distance:kn.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,[pn]:null})}}}var Pn=class extends N{constructor(e=new gn,t=new vn({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)bn.fromBufferAttribute(t,e),xn.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+bn.distanceTo(xn);let i=new Se(r,2,1);return e.setAttribute(`instanceDistanceStart`,new T(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new T(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`);let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;kn=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;An=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),Dn.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?An*.5:jn(r,Math.max(r.near,Dn.distanceToPoint(kn.origin)),s.resolution),Dn.radius+=c,kn.intersectsSphere(Dn)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),En.copy(o.boundingBox).applyMatrix4(a);let l;l=n?An*.5:jn(r,Math.max(r.near,En.distanceToPoint(kn.origin)),s.resolution),En.expandByScalar(l),kn.intersectsBox(En)!==!1&&(n?Mn(this,t):Nn(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(yn),this.material.uniforms.resolution.value.set(yn.z,yn.w))}},Fn=class extends Pn{constructor(e=new _n,t=new vn({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},In=q.forwardRef(function({points:e,color:t=16777215,vertexColors:n,linewidth:r,lineWidth:i,segments:a,dashed:o,...s},c){var l;let u=K(e=>e.size),d=q.useMemo(()=>a?new Pn:new Fn,[a]),[f]=q.useState(()=>new vn),p=(n==null||(l=n[0])==null?void 0:l.length)===4?4:3,m=q.useMemo(()=>{let r=a?new gn:new _n,i=e.map(e=>{let t=Array.isArray(e);return e instanceof L||e instanceof le?[e.x,e.y,e.z]:e instanceof R?[e.x,e.y,0]:t&&e.length===3?[e[0],e[1],e[2]]:t&&e.length===2?[e[0],e[1],0]:e});if(r.setPositions(i.flat()),n){t=16777215;let e=n.map(e=>e instanceof H?e.toArray():e);r.setColors(e.flat(),p)}return r},[e,a,n,p]);return q.useLayoutEffect(()=>{d.computeLineDistances()},[e,d]),q.useLayoutEffect(()=>{o?f.defines.USE_DASH=``:delete f.defines.USE_DASH,f.needsUpdate=!0},[o,f]),q.useEffect(()=>()=>{m.dispose(),f.dispose()},[m]),q.createElement(`primitive`,Me({object:d,ref:c},s),q.createElement(`primitive`,{object:m,attach:`geometry`}),q.createElement(`primitive`,Me({object:f,attach:`material`,color:t,vertexColors:!!n,resolution:[u.width,u.height],linewidth:r??i??1,dashed:o,transparent:p===4},s)))}),Ln={type:`change`},Rn={type:`start`},zn={type:`end`},Bn=new S,Vn=new b,Hn=Math.cos(70*he.DEG2RAD),Q=new L,Un=2*Math.PI,$={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Wn=1e-6,Gn=class extends xe{constructor(e,t=null){super(e,t),this.state=$.NONE,this.target=new L,this.cursor=new L,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:`ArrowLeft`,UP:`ArrowUp`,RIGHT:`ArrowRight`,BOTTOM:`ArrowDown`},this.mouseButtons={LEFT:U.ROTATE,MIDDLE:U.DOLLY,RIGHT:U.PAN},this.touches={ONE:A.ROTATE,TWO:A.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle=`auto`,this._domElementKeyEvents=null,this._lastPosition=new L,this._lastQuaternion=new pe,this._lastTargetPosition=new L,this._quat=new pe().setFromUnitVectors(e.up,new L(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new h,this._sphericalDelta=new h,this._scale=1,this._panOffset=new L,this._rotateStart=new R,this._rotateEnd=new R,this._rotateDelta=new R,this._panStart=new R,this._panEnd=new R,this._panDelta=new R,this._dollyStart=new R,this._dollyEnd=new R,this._dollyDelta=new R,this._dollyDirection=new L,this._mouse=new R,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=qn.bind(this),this._onPointerDown=Kn.bind(this),this._onPointerUp=Jn.bind(this),this._onContextMenu=tr.bind(this),this._onMouseWheel=Zn.bind(this),this._onKeyDown=Qn.bind(this),this._onTouchStart=$n.bind(this),this._onTouchMove=er.bind(this),this._onMouseDown=Yn.bind(this),this._onMouseMove=Xn.bind(this),this._interceptControlDown=nr.bind(this),this._interceptControlUp=rr.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e===`grab`?this.domElement.style.cursor=`grab`:this.domElement.style.cursor=`auto`}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener(`pointerdown`,this._onPointerDown),this.domElement.addEventListener(`pointercancel`,this._onPointerUp),this.domElement.addEventListener(`contextmenu`,this._onContextMenu),this.domElement.addEventListener(`wheel`,this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener(`keydown`,this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction=`none`}disconnect(){this.state=$.NONE,this.domElement.removeEventListener(`pointerdown`,this._onPointerDown),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.domElement.removeEventListener(`pointercancel`,this._onPointerUp),this.domElement.removeEventListener(`wheel`,this._onMouseWheel),this.domElement.removeEventListener(`contextmenu`,this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener(`keydown`,this._interceptControlDown,{capture:!0}),e.removeEventListener(`keyup`,this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction=``,this.domElement.style.cursor=`auto`}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Ln),this.update(),this.state=$.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Q.copy(t).sub(this.target),Q.applyQuaternion(this._quat),this._spherical.setFromVector3(Q),this.autoRotate&&this.state===$.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(n)&&isFinite(r)&&(n<-Math.PI?n+=Un:n>Math.PI&&(n-=Un),r<-Math.PI?r+=Un:r>Math.PI&&(r-=Un),n<=r?this._spherical.theta=Math.max(n,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+r)/2?Math.max(n,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let i=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let e=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),i=e!=this._spherical.radius}if(Q.setFromSpherical(this._spherical),Q.applyQuaternion(this._quatInverse),t.copy(this.target).add(Q),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let e=null;if(this.object.isPerspectiveCamera){let t=Q.length();e=this._clampDistance(t*this._scale);let n=t-e;this.object.position.addScaledVector(this._dollyDirection,n),this.object.updateMatrixWorld(),i=!!n}else if(this.object.isOrthographicCamera){let t=new L(this._mouse.x,this._mouse.y,0);t.unproject(this.object);let n=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),i=n!==this.object.zoom;let r=new L(this._mouse.x,this._mouse.y,0);r.unproject(this.object),this.object.position.sub(r).add(t),this.object.updateMatrixWorld(),e=Q.length()}else console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.`),this.zoomToCursor=!1;e!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(e).add(this.object.position):(Bn.origin.copy(this.object.position),Bn.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Bn.direction))<Hn?this.object.lookAt(this.target):(Vn.setFromNormalAndCoplanarPoint(this.object.up,this.target),Bn.intersectPlane(Vn,this.target))))}else if(this.object.isOrthographicCamera){let e=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),e!==this.object.zoom&&(this.object.updateProjectionMatrix(),i=!0)}return this._scale=1,this._performCursorZoom=!1,i||this._lastPosition.distanceToSquared(this.object.position)>Wn||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Wn||this._lastTargetPosition.distanceToSquared(this.target)>Wn?(this.dispatchEvent(Ln),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e===null?Un/60/60*this.autoRotateSpeed:Un/60*this.autoRotateSpeed*e}_getZoomScale(e){let t=Math.abs(e*.01);return .95**(this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Q.setFromMatrixColumn(t,0),Q.multiplyScalar(-e),this._panOffset.add(Q)}_panUp(e,t){this.screenSpacePanning===!0?Q.setFromMatrixColumn(t,1):(Q.setFromMatrixColumn(t,0),Q.crossVectors(this.object.up,Q)),Q.multiplyScalar(e),this._panOffset.add(Q)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let r=this.object.position;Q.copy(r).sub(this.target);let i=Q.length();i*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*i/n.clientHeight,this.object.matrix),this._panUp(2*t*i/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.`),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),r=e-n.left,i=t-n.top,a=n.width,o=n.height;this._mouse.x=r/a*2-1,this._mouse.y=-(i/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(Un*this._rotateDelta.x/t.clientHeight),this._rotateUp(Un*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(Un*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-Un*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(Un*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-Un*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(n,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(n,r)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyStart.set(0,i)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateEnd.set(n,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(Un*this._rotateDelta.x/t.clientHeight),this._rotateUp(Un*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(n,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyEnd.set(0,i),this._dollyDelta.set(0,(this._dollyEnd.y/this._dollyStart.y)**+this.zoomSpeed),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new R,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function Kn(e){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.addEventListener(`pointerup`,this._onPointerUp)),!this._isTrackingPointer(e)&&(this._addPointer(e),e.pointerType===`touch`?this._onTouchStart(e):this._onMouseDown(e),this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grabbing`)))}function qn(e){this.enabled!==!1&&(e.pointerType===`touch`?this._onTouchMove(e):this._onMouseMove(e))}function Jn(e){switch(this._removePointer(e),this._pointers.length){case 0:this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.dispatchEvent(zn),this.state=$.NONE,this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grab`);break;case 1:let t=this._pointers[0],n=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:n.x,pageY:n.y})}}function Yn(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case U.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(e),this.state=$.DOLLY;break;case U.ROTATE:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=$.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=$.ROTATE}break;case U.PAN:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=$.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=$.PAN}break;default:this.state=$.NONE}this.state!==$.NONE&&this.dispatchEvent(Rn)}function Xn(e){switch(this.state){case $.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(e);break;case $.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(e);break;case $.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(e)}}function Zn(e){this.enabled!==!1&&this.enableZoom!==!1&&this.state===$.NONE&&(e.preventDefault(),this.dispatchEvent(Rn),this._handleMouseWheel(this._customWheelEvent(e)),this.dispatchEvent(zn))}function Qn(e){this.enabled!==!1&&this._handleKeyDown(e)}function $n(e){switch(this._trackPointer(e),this._pointers.length){case 1:switch(this.touches.ONE){case A.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(e),this.state=$.TOUCH_ROTATE;break;case A.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(e),this.state=$.TOUCH_PAN;break;default:this.state=$.NONE}break;case 2:switch(this.touches.TWO){case A.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(e),this.state=$.TOUCH_DOLLY_PAN;break;case A.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(e),this.state=$.TOUCH_DOLLY_ROTATE;break;default:this.state=$.NONE}break;default:this.state=$.NONE}this.state!==$.NONE&&this.dispatchEvent(Rn)}function er(e){switch(this._trackPointer(e),this.state){case $.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(e),this.update();break;case $.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(e),this.update();break;case $.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(e),this.update();break;case $.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(e),this.update();break;default:this.state=$.NONE}}function tr(e){this.enabled!==!1&&e.preventDefault()}function nr(e){e.key===`Control`&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}function rr(e){e.key===`Control`&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}var ir=class extends F{constructor(){super(),this.name=`RoomEnvironment`,this.position.y=-3.5;let e=new f;e.deleteAttribute(`uv`);let t=new _({side:1}),n=new _,r=new y(16777215,900,28,2);r.position.set(.418,16.199,.3),this.add(r);let i=new N(e,t);i.position.set(-.757,13.219,.717),i.scale.set(31.713,28.305,28.591),this.add(i);let a=new De(e,n,6),o=new x;o.position.set(-10.906,2.009,1.846),o.rotation.set(0,-.195,0),o.scale.set(2.328,7.905,4.651),o.updateMatrix(),a.setMatrixAt(0,o.matrix),o.position.set(-5.607,-.754,-.758),o.rotation.set(0,.994,0),o.scale.set(1.97,1.534,3.955),o.updateMatrix(),a.setMatrixAt(1,o.matrix),o.position.set(6.167,.857,7.803),o.rotation.set(0,.561,0),o.scale.set(3.927,6.285,3.687),o.updateMatrix(),a.setMatrixAt(2,o.matrix),o.position.set(-2.017,.018,6.124),o.rotation.set(0,.333,0),o.scale.set(2.002,4.566,2.064),o.updateMatrix(),a.setMatrixAt(3,o.matrix),o.position.set(2.291,-.756,-2.621),o.rotation.set(0,-.286,0),o.scale.set(1.546,1.552,1.496),o.updateMatrix(),a.setMatrixAt(4,o.matrix),o.position.set(-2.193,-.369,-5.547),o.rotation.set(0,.516,0),o.scale.set(3.875,3.487,2.986),o.updateMatrix(),a.setMatrixAt(5,o.matrix),this.add(a);let s=new N(e,ar(50));s.position.set(-16.116,14.37,8.208),s.scale.set(.1,2.428,2.739),this.add(s);let c=new N(e,ar(50));c.position.set(-16.109,18.021,-8.207),c.scale.set(.1,2.425,2.751),this.add(c);let l=new N(e,ar(17));l.position.set(14.904,12.198,-1.832),l.scale.set(.15,4.265,6.331),this.add(l);let u=new N(e,ar(43));u.position.set(-.462,8.89,14.52),u.scale.set(4.38,5.441,.088),this.add(u);let d=new N(e,ar(20));d.position.set(3.235,11.486,-12.541),d.scale.set(2.5,2,.1),this.add(d);let p=new N(e,ar(100));p.position.set(0,20,0),p.scale.set(1,.1,1),this.add(p)}dispose(){let e=new Set;this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))});for(let t of e)t.dispose()}};function ar(e){return new Te({color:0,emissive:16777215,emissiveIntensity:e})}var or={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},sr=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},cr=new Oe(-1,1,1,-1,0,1),lr=new class extends O{constructor(){super(),this.setAttribute(`position`,new ne([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new ne([0,2,0,0,2,0],2))}},ur=class{constructor(e){this._mesh=new N(lr,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,cr)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},dr=class extends sr{constructor(e,t=`tDiffuse`){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof B?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=P.clone(e.uniforms),this.material=new B({name:e.name===void 0?`unspecified`:e.name,defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new ur(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},fr=class extends sr{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),i.buffers.stencil.setClear(o),i.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}},pr=class extends sr{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},mr=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new R);this._width=n.width,this._height=n.height,t=new p(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:V}),t.texture.name=`EffectComposer.rt1`}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name=`EffectComposer.rt2`,this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new dr(or),this.copyPass.material.blending=0,this.timer=new ge}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let t=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(t.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(t.EQUAL,1,4294967295)}this.swapBuffers()}fr!==void 0&&(r instanceof fr?n=!0:r instanceof pr&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new R);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}},hr={name:`GTAOShader`,defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:`x`,SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new R},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new I},cameraProjectionMatrixInverse:{value:new I},cameraWorldMatrix:{value:new I},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new L(-1,-1,-1)},sceneBoxMax:{value:new L(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif

		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}

		void main() {
			float depth = getDepth(vUv.xy);

			#ifdef USE_REVERSED_DEPTH_BUFFER
				if (depth <= 0.0) {
					discard;
					return;
				}
			#else
				if (depth >= 1.0) {
					discard;
					return;
				}
			#endif
			
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {

				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w);
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));

				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));

				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`},gr={name:`GTAODepthShader`,defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform sampler2D tDepth;
		uniform float cameraNear;
		uniform float cameraFar;
		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		void main() {
			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`},_r={name:`GTAOBlendShader`,uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform float intensity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);
		}`};function vr(e=5){let t=Math.floor(e)%2==0?Math.floor(e)+1:Math.floor(e),n=yr(t),r=n.length,i=new Uint8Array(r*4);for(let e=0;e<r;++e){let t=n[e],a=2*Math.PI*t/r,o=new L(Math.cos(a),Math.sin(a),0).normalize();i[e*4]=(o.x*.5+.5)*255,i[e*4+1]=(o.y*.5+.5)*255,i[e*4+2]=127,i[e*4+3]=255}let a=new we(i,t,t);return a.wrapS=fe,a.wrapT=fe,a.needsUpdate=!0,a}function yr(e){let t=Math.floor(e)%2==0?Math.floor(e)+1:Math.floor(e),n=t*t,r=Array(n).fill(0),i=Math.floor(t/2),a=t-1;for(let e=1;e<=n;)i===-1&&a===t?(a=t-2,i=0):(a===t&&(a=0),i<0&&(i=t-1)),r[i*t+a]===0?(r[i*t+a]=e++,a++,i--):(a-=2,i++);return r}var br={name:`PoissonDenoiseShader`,defines:{SAMPLES:16,SAMPLE_VECTORS:xr(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new R},cameraProjectionMatrixInverse:{value:new I},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		varying vec2 vUv;

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform float lumaPhi;
		uniform float depthPhi;
		uniform float normalPhi;
		uniform float radius;
		uniform int index;

		#include <common>
		#include <packing>

		#ifndef SAMPLE_LUMINANCE
		#define SAMPLE_LUMINANCE dot(vec3(0.2125, 0.7154, 0.0721), a)
		#endif

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(denoised, 1.)
		#endif

		float getLuminance(const in vec3 a) {
			return SAMPLE_LUMINANCE;
		}

		const vec3 poissonDisk[SAMPLES] = SAMPLE_VECTORS;

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
		#if DEPTH_VALUE_SOURCE == 1
			return textureLod(tDepth, uv.xy, 0.0).a;
		#else
			return textureLod(tDepth, uv.xy, 0.0).r;
		#endif
		}

		float fetchDepth(const ivec2 uv) {
			#if DEPTH_VALUE_SOURCE == 1
				return texelFetch(tDepth, uv.xy, 0).a;
			#else
				return texelFetch(tDepth, uv.xy, 0).r;
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ?  ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz
									: -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ?  ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz
									: -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
		#if NORMAL_VECTOR_TYPE == 2
			return normalize(textureLod(tNormal, uv, 0.).rgb);
		#elif NORMAL_VECTOR_TYPE == 1
			return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
		#else
			return computeNormalFromDepth(uv);
		#endif
		}

		void denoiseSample(in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight) {
			vec4 sampleTexel = textureLod(tDiffuse, sampleUv, 0.0);
			float sampleDepth = getDepth(sampleUv);
			vec3 sampleNormal = getViewNormal(sampleUv);
			vec3 neighborColor = sampleTexel.rgb;
			vec3 viewPosSample = getViewPosition(sampleUv, sampleDepth);

			float normalDiff = dot(viewNormal, sampleNormal);
			float normalSimilarity = pow(max(normalDiff, 0.), normalPhi);
			float lumaDiff = abs(getLuminance(neighborColor) - getLuminance(center));
			float lumaSimilarity = max(1.0 - lumaDiff / lumaPhi, 0.0);
			float depthDiff = abs(dot(viewPos - viewPosSample, viewNormal));
			float depthSimilarity = max(1. - depthDiff / depthPhi, 0.);
			float w = lumaSimilarity * depthSimilarity * normalSimilarity;

			denoised += w * neighborColor;
			totalWeight += w;
		}

		void main() {
			float depth = getDepth(vUv.xy);
			vec3 viewNormal = getViewNormal(vUv);
			if (depth == 1. || dot(viewNormal, viewNormal) == 0.) {
				discard;
				return;
			}
			vec4 texel = textureLod(tDiffuse, vUv, 0.0);
			vec3 center = texel.rgb;
			vec3 viewPos = getViewPosition(vUv, depth);

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
      		vec2 noiseVec = vec2(sin(noiseTexel[index % 4] * 2. * PI), cos(noiseTexel[index % 4] * 2. * PI));
    		mat2 rotationMatrix = mat2(noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y);

			float totalWeight = 1.0;
			vec3 denoised = texel.rgb;
			for (int i = 0; i < SAMPLES; i++) {
				vec3 sampleDir = poissonDisk[i];
				vec2 offset = rotationMatrix * (sampleDir.xy * (1. + sampleDir.z * (radius - 1.)) / resolution);
				vec2 sampleUv = vUv + offset;
				denoiseSample(center, viewNormal, viewPos, sampleUv, denoised, totalWeight);
			}

			if (totalWeight > 0.) {
				denoised /= totalWeight;
			}
			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function xr(e,t,n){let r=Sr(e,t,n),i=`vec3[SAMPLES](`;for(let t=0;t<e;t++){let n=r[t];i+=`vec3(${n.x}, ${n.y}, ${n.z})${t<e-1?`,`:`)`}`}return i}function Sr(e,t,n){let r=[];for(let i=0;i<e;i++){let a=2*Math.PI*t*i/e,o=(i/(e-1))**n;r.push(new L(Math.cos(a),Math.sin(a),o))}return r}var Cr=class{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let t=0;t<256;t++)this.p[t]=Math.floor(e.random()*256);this.perm=[];for(let e=0;e<512;e++)this.perm[e]=this.p[e&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(e,t){let n,r,i,a=.5*(Math.sqrt(3)-1),o=(e+t)*a,s=Math.floor(e+o),c=Math.floor(t+o),l=(3-Math.sqrt(3))/6,u=(s+c)*l,d=s-u,f=c-u,p=e-d,m=t-f,h,g;p>m?(h=1,g=0):(h=0,g=1);let _=p-h+l,v=m-g+l,y=p-1+2*l,b=m-1+2*l,x=s&255,S=c&255,C=this.perm[x+this.perm[S]]%12,w=this.perm[x+h+this.perm[S+g]]%12,T=this.perm[x+1+this.perm[S+1]]%12,E=.5-p*p-m*m;E<0?n=0:(E*=E,n=E*E*this._dot(this.grad3[C],p,m));let D=.5-_*_-v*v;D<0?r=0:(D*=D,r=D*D*this._dot(this.grad3[w],_,v));let O=.5-y*y-b*b;return O<0?i=0:(O*=O,i=O*O*this._dot(this.grad3[T],y,b)),70*(n+r+i)}noise3d(e,t,n){let r,i,a,o,s=(e+t+n)*(1/3),c=Math.floor(e+s),l=Math.floor(t+s),u=Math.floor(n+s),d=1/6,f=(c+l+u)*d,p=c-f,m=l-f,h=u-f,g=e-p,_=t-m,v=n-h,y,b,x,S,C,w;g>=_?_>=v?(y=1,b=0,x=0,S=1,C=1,w=0):g>=v?(y=1,b=0,x=0,S=1,C=0,w=1):(y=0,b=0,x=1,S=1,C=0,w=1):_<v?(y=0,b=0,x=1,S=0,C=1,w=1):g<v?(y=0,b=1,x=0,S=0,C=1,w=1):(y=0,b=1,x=0,S=1,C=1,w=0);let T=g-y+d,E=_-b+d,D=v-x+d,O=g-S+2*d,k=_-C+2*d,ee=v-w+2*d,A=g-1+3*d,j=_-1+3*d,te=v-1+3*d,M=c&255,ne=l&255,re=u&255,ie=this.perm[M+this.perm[ne+this.perm[re]]]%12,N=this.perm[M+y+this.perm[ne+b+this.perm[re+x]]]%12,ae=this.perm[M+S+this.perm[ne+C+this.perm[re+w]]]%12,P=this.perm[M+1+this.perm[ne+1+this.perm[re+1]]]%12,oe=.6-g*g-_*_-v*v;oe<0?r=0:(oe*=oe,r=oe*oe*this._dot3(this.grad3[ie],g,_,v));let se=.6-T*T-E*E-D*D;se<0?i=0:(se*=se,i=se*se*this._dot3(this.grad3[N],T,E,D));let ce=.6-O*O-k*k-ee*ee;ce<0?a=0:(ce*=ce,a=ce*ce*this._dot3(this.grad3[ae],O,k,ee));let F=.6-A*A-j*j-te*te;return F<0?o=0:(F*=F,o=F*F*this._dot3(this.grad3[P],A,j,te)),32*(r+i+a+o)}noise4d(e,t,n,r){let i=this.grad4,a=this.simplex,o=this.perm,s=(Math.sqrt(5)-1)/4,c=(5-Math.sqrt(5))/20,l,u,d,f,p,m=(e+t+n+r)*s,h=Math.floor(e+m),g=Math.floor(t+m),_=Math.floor(n+m),v=Math.floor(r+m),y=(h+g+_+v)*c,b=h-y,x=g-y,S=_-y,C=v-y,w=e-b,T=t-x,E=n-S,D=r-C,O=w>T?32:0,k=w>E?16:0,ee=T>E?8:0,A=w>D?4:0,j=T>D?2:0,te=+(E>D),M=O+k+ee+A+j+te,ne=+(a[M][0]>=3),re=+(a[M][1]>=3),ie=+(a[M][2]>=3),N=+(a[M][3]>=3),ae=+(a[M][0]>=2),P=+(a[M][1]>=2),oe=+(a[M][2]>=2),se=+(a[M][3]>=2),ce=+(a[M][0]>=1),F=+(a[M][1]>=1),le=+(a[M][2]>=1),I=+(a[M][3]>=1),L=w-ne+c,ue=T-re+c,de=E-ie+c,R=D-N+c,fe=w-ae+2*c,pe=T-P+2*c,me=E-oe+2*c,z=D-se+2*c,B=w-ce+3*c,he=T-F+3*c,ge=E-le+3*c,_e=D-I+3*c,ve=w-1+4*c,V=T-1+4*c,ye=E-1+4*c,H=D-1+4*c,be=h&255,U=g&255,xe=_&255,Se=v&255,Ce=o[be+o[U+o[xe+o[Se]]]]%32,we=o[be+ne+o[U+re+o[xe+ie+o[Se+N]]]]%32,Te=o[be+ae+o[U+P+o[xe+oe+o[Se+se]]]]%32,Ee=o[be+ce+o[U+F+o[xe+le+o[Se+I]]]]%32,De=o[be+1+o[U+1+o[xe+1+o[Se+1]]]]%32,Oe=.6-w*w-T*T-E*E-D*D;Oe<0?l=0:(Oe*=Oe,l=Oe*Oe*this._dot4(i[Ce],w,T,E,D));let ke=.6-L*L-ue*ue-de*de-R*R;ke<0?u=0:(ke*=ke,u=ke*ke*this._dot4(i[we],L,ue,de,R));let Ae=.6-fe*fe-pe*pe-me*me-z*z;Ae<0?d=0:(Ae*=Ae,d=Ae*Ae*this._dot4(i[Te],fe,pe,me,z));let W=.6-B*B-he*he-ge*ge-_e*_e;W<0?f=0:(W*=W,f=W*W*this._dot4(i[Ee],B,he,ge,_e));let je=.6-ve*ve-V*V-ye*ye-H*H;return je<0?p=0:(je*=je,p=je*je*this._dot4(i[De],ve,V,ye,H)),27*(l+u+d+f+p)}_dot(e,t,n){return e[0]*t+e[1]*n}_dot3(e,t,n,r){return e[0]*t+e[1]*n+e[2]*r}_dot4(e,t,n,r,i){return e[0]*t+e[1]*n+e[2]*r+e[3]*i}},wr=class e extends sr{constructor(e,t,n=512,r=512,i,a,o){super(),this.width=n,this.height=r,this.clear=!0,this.camera=t,this.scene=e,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=vr(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new p(this.width,this.height,{type:V,depthBuffer:!1}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new B({defines:Object.assign({},hr.defines),uniforms:P.clone(hr.uniforms),vertexShader:hr.vertexShader,fragmentShader:hr.fragmentShader,blending:0,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=+!!this.camera.isPerspectiveCamera,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new m,this.normalMaterial.blending=0,this.pdMaterial=new B({defines:Object.assign({},br.defines),uniforms:P.clone(br.uniforms),vertexShader:br.vertexShader,fragmentShader:br.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new B({defines:Object.assign({},gr.defines),uniforms:P.clone(gr.uniforms),vertexShader:gr.vertexShader,fragmentShader:gr.fragmentShader,blending:0}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new B({uniforms:P.clone(or.uniforms),vertexShader:or.vertexShader,fragmentShader:or.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:208,blendDst:200,blendEquation:100,blendSrcAlpha:206,blendDstAlpha:200,blendEquationAlpha:100}),this.blendMaterial=new B({uniforms:P.clone(_r.uniforms),vertexShader:_r.vertexShader,fragmentShader:_r.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:5,blendSrc:208,blendDst:200,blendEquation:100,blendSrcAlpha:206,blendDstAlpha:200,blendEquationAlpha:100}),this._fsQuad=new ur(null),this._originalClearColor=new H,this.setGBuffer(i?i.depthTexture:void 0,i?i.normalTexture:void 0),a!==void 0&&this.updateGtaoMaterial(a),o!==void 0&&this.updatePdMaterial(o)}setSize(e,t){this.width=e,this.height=t,this.gtaoRenderTarget.setSize(e,t),this.normalRenderTarget.setSize(e,t),this.pdRenderTarget.setSize(e,t),this.gtaoMaterial.uniforms.resolution.value.set(e,t),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(e,t),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(e,t){e===void 0?(this.depthTexture=new C,this.depthTexture.format=ue,this.depthTexture.type=oe,this.normalRenderTarget=new p(this.width,this.height,{minFilter:de,magFilter:de,type:V,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0):(this.depthTexture=e,this.normalTexture=t,this._renderGBuffer=!1);let n=+!!this.normalTexture,r=this.depthTexture===this.normalTexture?`w`:`x`;this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=n,this.gtaoMaterial.defines.DEPTH_SWIZZLING=r,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=n,this.pdMaterial.defines.DEPTH_SWIZZLING=r,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(e){e?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(e.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(e.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(e){e.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=e.radius),e.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=e.distanceExponent),e.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=e.thickness),e.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=e.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),e.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=e.scale),e.samples!==void 0&&e.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=e.samples,this.gtaoMaterial.needsUpdate=!0),e.screenSpaceRadius!==void 0&&+!!e.screenSpaceRadius!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=+!!e.screenSpaceRadius,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(e){let t=!1;e.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=e.lumaPhi),e.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=e.depthPhi),e.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=e.normalPhi),e.radius!==void 0&&e.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=e.radius),e.radiusExponent!==void 0&&e.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=e.radiusExponent,t=!0),e.rings!==void 0&&e.rings!==this.pdRings&&(this.pdRings=e.rings,t=!0),e.samples!==void 0&&e.samples!==this.pdSamples&&(this.pdSamples=e.samples,t=!0),t&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=xr(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(t,n,r){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(t,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(t,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(t,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case e.OUTPUT.Off:break;case e.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=r.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(t,this.depthRenderMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=r.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(t,this.blendMaterial,this.renderToScreen?null:n);break;default:console.warn(`THREE.GTAOPass: Unknown output type.`)}}_renderPass(e,t,n,r,i){e.getClearColor(this._originalClearColor);let a=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,r!=null&&(e.setClearColor(r),e.setClearAlpha(i||0),e.clear()),this._fsQuad.material=t,this._fsQuad.render(e),e.autoClear=o,e.setClearColor(this._originalClearColor),e.setClearAlpha(a)}_renderOverride(e,t,n,r,i){e.getClearColor(this._originalClearColor);let a=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,r=t.clearColor||r,i=t.clearAlpha||i,r!=null&&(e.setClearColor(r),e.setClearAlpha(i||0),e.clear()),this.scene.overrideMaterial=t,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=o,e.setClearColor(this._originalClearColor),e.setClearAlpha(a)}_overrideVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(e){(e.isPoints||e.isLine||e.isLine2)&&e.visible&&(e.visible=!1,t.push(e))})}_restoreVisibility(){let e=this._visibilityCache;for(let t=0;t<e.length;t++)e[t].visible=!0;e.length=0}_generateNoise(e=64){let t=new Cr,n=e*e*4,r=new Uint8Array(n);for(let n=0;n<e;n++)for(let i=0;i<e;i++){let a=n,o=i;r[(n*e+i)*4]=(t.noise(a,o)*.5+.5)*255,r[(n*e+i)*4+1]=(t.noise(a+e,o)*.5+.5)*255,r[(n*e+i)*4+2]=(t.noise(a,o+e)*.5+.5)*255,r[(n*e+i)*4+3]=(t.noise(a+e,o+e)*.5+.5)*255}let i=new we(r,e,e,se,z);return i.wrapS=fe,i.wrapT=fe,i.needsUpdate=!0,i}};wr.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};var Tr={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},Er=class extends sr{constructor(){super(),this.isOutputPass=!0,this.uniforms=P.clone(Tr.uniforms),this.material=new _e({name:Tr.name,uniforms:this.uniforms,vertexShader:Tr.vertexShader,fragmentShader:Tr.fragmentShader}),this._fsQuad=new ur(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},ve.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},Dr=class extends sr{constructor(e,t,n=null,r=null,i=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new H}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let i,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==1&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}},Or={name:`SMAAEdgesShader`,defines:{SMAA_THRESHOLD:`0.1`},uniforms:{tDiffuse:{value:null},resolution:{value:new R(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		void SMAAEdgeDetectionVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0,  1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4(  1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 2 ] = texcoord.xyxy + resolution.xyxy * vec4( -2.0, 0.0, 0.0,  2.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAAEdgeDetectionVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		vec4 SMAAColorEdgeDetectionPS( vec2 texcoord, vec4 offset[3], sampler2D colorTex ) {
			vec2 threshold = vec2( SMAA_THRESHOLD, SMAA_THRESHOLD );

			// Calculate color deltas:
			vec4 delta;
			vec3 C = texture2D( colorTex, texcoord ).rgb;

			vec3 Cleft = texture2D( colorTex, offset[0].xy ).rgb;
			vec3 t = abs( C - Cleft );
			delta.x = max( max( t.r, t.g ), t.b );

			vec3 Ctop = texture2D( colorTex, offset[0].zw ).rgb;
			t = abs( C - Ctop );
			delta.y = max( max( t.r, t.g ), t.b );

			// We do the usual threshold:
			vec2 edges = step( threshold, delta.xy );

			// Then discard if there is no edge:
			if ( dot( edges, vec2( 1.0, 1.0 ) ) == 0.0 )
				discard;

			// Calculate right and bottom deltas:
			vec3 Cright = texture2D( colorTex, offset[1].xy ).rgb;
			t = abs( C - Cright );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Cbottom  = texture2D( colorTex, offset[1].zw ).rgb;
			t = abs( C - Cbottom );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the maximum delta in the direct neighborhood:
			float maxDelta = max( max( max( delta.x, delta.y ), delta.z ), delta.w );

			// Calculate left-left and top-top deltas:
			vec3 Cleftleft  = texture2D( colorTex, offset[2].xy ).rgb;
			t = abs( C - Cleftleft );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Ctoptop = texture2D( colorTex, offset[2].zw ).rgb;
			t = abs( C - Ctoptop );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the final maximum delta:
			maxDelta = max( max( maxDelta, delta.z ), delta.w );

			// Local contrast adaptation in action:
			edges.xy *= step( 0.5 * maxDelta, delta.xy );

			return vec4( edges, 0.0, 0.0 );
		}

		void main() {

			gl_FragColor = SMAAColorEdgeDetectionPS( vUv, vOffset, tDiffuse );

		}`},kr={name:`SMAAWeightsShader`,defines:{SMAA_MAX_SEARCH_STEPS:`8`,SMAA_AREATEX_MAX_DISTANCE:`16`,SMAA_AREATEX_PIXEL_SIZE:`( 1.0 / vec2( 160.0, 560.0 ) )`,SMAA_AREATEX_SUBTEX_SIZE:`( 1.0 / 7.0 )`},uniforms:{tDiffuse:{value:null},tArea:{value:null},tSearch:{value:null},resolution:{value:new R(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];
		varying vec2 vPixcoord;

		void SMAABlendingWeightCalculationVS( vec2 texcoord ) {
			vPixcoord = texcoord / resolution;

			// We will use these offsets for the searches later on (see @PSEUDO_GATHER4):
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.25, 0.125, 1.25, 0.125 ); // WebGL port note: Changed sign in Y and W components
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.125, 0.25, -0.125, -1.25 ); // WebGL port note: Changed sign in Y and W components

			// And these for the searches, they indicate the ends of the loops:
			vOffset[ 2 ] = vec4( vOffset[ 0 ].xz, vOffset[ 1 ].yw ) + vec4( -2.0, 2.0, -2.0, 2.0 ) * resolution.xxyy * float( SMAA_MAX_SEARCH_STEPS );

		}

		void main() {

			vUv = uv;

			SMAABlendingWeightCalculationVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#define SMAASampleLevelZeroOffset( tex, coord, offset ) texture2D( tex, coord + float( offset ) * resolution, 0.0 )

		uniform sampler2D tDiffuse;
		uniform sampler2D tArea;
		uniform sampler2D tSearch;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[3];
		varying vec2 vPixcoord;

		#if __VERSION__ == 100
		vec2 round( vec2 x ) {
			return sign( x ) * floor( abs( x ) + 0.5 );
		}
		#endif

		float SMAASearchLength( sampler2D searchTex, vec2 e, float bias, float scale ) {
			// Not required if searchTex accesses are set to point:
			// float2 SEARCH_TEX_PIXEL_SIZE = 1.0 / float2(66.0, 33.0);
			// e = float2(bias, 0.0) + 0.5 * SEARCH_TEX_PIXEL_SIZE +
			//     e * float2(scale, 1.0) * float2(64.0, 32.0) * SEARCH_TEX_PIXEL_SIZE;
			e.r = bias + e.r * scale;
			return 255.0 * texture2D( searchTex, e, 0.0 ).r;
		}

		float SMAASearchXLeft( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			/**
				* @PSEUDO_GATHER4
				* This texcoord has been offset by (-0.25, -0.125) in the vertex shader to
				* sample between edge, thus fetching four edges in a row.
				* Sampling with different offsets in each direction allows to disambiguate
				* which edges are active from the four fetched ones.
				*/
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x > end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			// We correct the previous (-0.25, -0.125) offset we applied:
			texcoord.x += 0.25 * resolution.x;

			// The searches are bias by 1, so adjust the coords accordingly:
			texcoord.x += resolution.x;

			// Disambiguate the length added by the last step:
			texcoord.x += 2.0 * resolution.x; // Undo last step
			texcoord.x -= resolution.x * SMAASearchLength(searchTex, e, 0.0, 0.5);

			return texcoord.x;
		}

		float SMAASearchXRight( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x < end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			texcoord.x -= 0.25 * resolution.x;
			texcoord.x -= resolution.x;
			texcoord.x -= 2.0 * resolution.x;
			texcoord.x += resolution.x * SMAASearchLength( searchTex, e, 0.5, 0.5 );

			return texcoord.x;
		}

		float SMAASearchYUp( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y > end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y -= 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y; // WebGL port note: Changed sign
			texcoord.y -= 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y * SMAASearchLength( searchTex, e.gr, 0.0, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		float SMAASearchYDown( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y < end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y += 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y; // WebGL port note: Changed sign
			texcoord.y += 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y * SMAASearchLength( searchTex, e.gr, 0.5, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		vec2 SMAAArea( sampler2D areaTex, vec2 dist, float e1, float e2, float offset ) {
			// Rounding prevents precision errors of bilinear filtering:
			vec2 texcoord = float( SMAA_AREATEX_MAX_DISTANCE ) * round( 4.0 * vec2( e1, e2 ) ) + dist;

			// We do a scale and bias for mapping to texel space:
			texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + ( 0.5 * SMAA_AREATEX_PIXEL_SIZE );

			// Move to proper place, according to the subpixel offset:
			texcoord.y += SMAA_AREATEX_SUBTEX_SIZE * offset;

			return texture2D( areaTex, texcoord, 0.0 ).rg;
		}

		vec4 SMAABlendingWeightCalculationPS( vec2 texcoord, vec2 pixcoord, vec4 offset[ 3 ], sampler2D edgesTex, sampler2D areaTex, sampler2D searchTex, ivec4 subsampleIndices ) {
			vec4 weights = vec4( 0.0, 0.0, 0.0, 0.0 );

			vec2 e = texture2D( edgesTex, texcoord ).rg;

			if ( e.g > 0.0 ) { // Edge at north
				vec2 d;

				// Find the distance to the left:
				vec2 coords;
				coords.x = SMAASearchXLeft( edgesTex, searchTex, offset[ 0 ].xy, offset[ 2 ].x );
				coords.y = offset[ 1 ].y; // offset[1].y = texcoord.y - 0.25 * resolution.y (@CROSSING_OFFSET)
				d.x = coords.x;

				// Now fetch the left crossing edges, two at a time using bilinear
				// filtering. Sampling at -0.25 (see @CROSSING_OFFSET) enables to
				// discern what value each edge has:
				float e1 = texture2D( edgesTex, coords, 0.0 ).r;

				// Find the distance to the right:
				coords.x = SMAASearchXRight( edgesTex, searchTex, offset[ 0 ].zw, offset[ 2 ].y );
				d.y = coords.x;

				// We want the distances to be in pixel units (doing this here allow to
				// better interleave arithmetic and memory accesses):
				d = d / resolution.x - pixcoord.x;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the right crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 1, 0 ) ).r;

				// Ok, we know how this pattern looks like, now it is time for getting
				// the actual area:
				weights.rg = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.y ) );
			}

			if ( e.r > 0.0 ) { // Edge at west
				vec2 d;

				// Find the distance to the top:
				vec2 coords;

				coords.y = SMAASearchYUp( edgesTex, searchTex, offset[ 1 ].xy, offset[ 2 ].z );
				coords.x = offset[ 0 ].x; // offset[1].x = texcoord.x - 0.25 * resolution.x;
				d.x = coords.y;

				// Fetch the top crossing edges:
				float e1 = texture2D( edgesTex, coords, 0.0 ).g;

				// Find the distance to the bottom:
				coords.y = SMAASearchYDown( edgesTex, searchTex, offset[ 1 ].zw, offset[ 2 ].w );
				d.y = coords.y;

				// We want the distances to be in pixel units:
				d = d / resolution.y - pixcoord.y;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the bottom crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 0, 1 ) ).g;

				// Get the area for this direction:
				weights.ba = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.x ) );
			}

			return weights;
		}

		void main() {

			gl_FragColor = SMAABlendingWeightCalculationPS( vUv, vPixcoord, vOffset, tDiffuse, tArea, tSearch, ivec4( 0.0 ) );

		}`},Ar={name:`SMAABlendShader`,uniforms:{tDiffuse:{value:null},tColor:{value:null},resolution:{value:new R(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		void SMAANeighborhoodBlendingVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0, 1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( 1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAANeighborhoodBlendingVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform sampler2D tColor;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		vec4 SMAANeighborhoodBlendingPS( vec2 texcoord, vec4 offset[ 2 ], sampler2D colorTex, sampler2D blendTex ) {
			// Fetch the blending weights for current pixel:
			vec4 a;
			a.xz = texture2D( blendTex, texcoord ).xz;
			a.y = texture2D( blendTex, offset[ 1 ].zw ).g;
			a.w = texture2D( blendTex, offset[ 1 ].xy ).a;

			// Is there any blending weight with a value greater than 0.0?
			if ( dot(a, vec4( 1.0, 1.0, 1.0, 1.0 )) < 1e-5 ) {
				return texture2D( colorTex, texcoord, 0.0 );
			} else {
				// Up to 4 lines can be crossing a pixel (one through each edge). We
				// favor blending by choosing the line with the maximum weight for each
				// direction:
				vec2 offset;
				offset.x = a.a > a.b ? a.a : -a.b; // left vs. right
				offset.y = a.g > a.r ? -a.g : a.r; // top vs. bottom // WebGL port note: Changed signs

				// Then we go in the direction that has the maximum weight:
				if ( abs( offset.x ) > abs( offset.y )) { // horizontal vs. vertical
					offset.y = 0.0;
				} else {
					offset.x = 0.0;
				}

				// Fetch the opposite color and lerp by hand:
				vec4 C = texture2D( colorTex, texcoord, 0.0 );
				texcoord += sign( offset ) * resolution;
				vec4 Cop = texture2D( colorTex, texcoord, 0.0 );
				float s = abs( offset.x ) > abs( offset.y ) ? abs( offset.x ) : abs( offset.y );

				// WebGL port note: Added gamma correction
				C.xyz = pow(C.xyz, vec3(2.2));
				Cop.xyz = pow(Cop.xyz, vec3(2.2));
				vec4 mixed = mix(C, Cop, s);
				mixed.xyz = pow(mixed.xyz, vec3(1.0 / 2.2));

				return mixed;
			}
		}

		void main() {

			gl_FragColor = SMAANeighborhoodBlendingPS( vUv, vOffset, tColor, tDiffuse );

		}`},jr=class extends sr{constructor(){super(),this._edgesRT=new p(1,1,{depthBuffer:!1,type:V}),this._edgesRT.texture.name=`SMAAPass.edges`,this._weightsRT=new p(1,1,{depthBuffer:!1,type:V}),this._weightsRT.texture.name=`SMAAPass.weights`;let e=this,t=new Image;t.src=this._getAreaTexture(),t.onload=function(){e._areaTexture.needsUpdate=!0},this._areaTexture=new k,this._areaTexture.name=`SMAAPass.area`,this._areaTexture.image=t,this._areaTexture.minFilter=j,this._areaTexture.generateMipmaps=!1,this._areaTexture.flipY=!1;let n=new Image;n.src=this._getSearchTexture(),n.onload=function(){e._searchTexture.needsUpdate=!0},this._searchTexture=new k,this._searchTexture.name=`SMAAPass.search`,this._searchTexture.image=n,this._searchTexture.magFilter=de,this._searchTexture.minFilter=de,this._searchTexture.generateMipmaps=!1,this._searchTexture.flipY=!1,this._uniformsEdges=P.clone(Or.uniforms),this._materialEdges=new B({defines:Object.assign({},Or.defines),uniforms:this._uniformsEdges,vertexShader:Or.vertexShader,fragmentShader:Or.fragmentShader}),this._uniformsWeights=P.clone(kr.uniforms),this._uniformsWeights.tDiffuse.value=this._edgesRT.texture,this._uniformsWeights.tArea.value=this._areaTexture,this._uniformsWeights.tSearch.value=this._searchTexture,this._materialWeights=new B({defines:Object.assign({},kr.defines),uniforms:this._uniformsWeights,vertexShader:kr.vertexShader,fragmentShader:kr.fragmentShader}),this._uniformsBlend=P.clone(Ar.uniforms),this._uniformsBlend.tDiffuse.value=this._weightsRT.texture,this._materialBlend=new B({uniforms:this._uniformsBlend,vertexShader:Ar.vertexShader,fragmentShader:Ar.fragmentShader}),this._fsQuad=new ur(null)}render(e,t,n){this._uniformsEdges.tDiffuse.value=n.texture,this._fsQuad.material=this._materialEdges,e.setRenderTarget(this._edgesRT),this.clear&&e.clear(),this._fsQuad.render(e),this._fsQuad.material=this._materialWeights,e.setRenderTarget(this._weightsRT),this.clear&&e.clear(),this._fsQuad.render(e),this._uniformsBlend.tColor.value=n.texture,this._fsQuad.material=this._materialBlend,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(),this._fsQuad.render(e))}setSize(e,t){this._edgesRT.setSize(e,t),this._weightsRT.setSize(e,t),this._materialEdges.uniforms.resolution.value.set(1/e,1/t),this._materialWeights.uniforms.resolution.value.set(1/e,1/t),this._materialBlend.uniforms.resolution.value.set(1/e,1/t)}dispose(){this._edgesRT.dispose(),this._weightsRT.dispose(),this._areaTexture.dispose(),this._searchTexture.dispose(),this._materialEdges.dispose(),this._materialWeights.dispose(),this._materialBlend.dispose(),this._fsQuad.dispose()}_getAreaTexture(){return`data:image/png;base64,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`}_getSearchTexture(){return`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAhCAAAAABIXyLAAAAAOElEQVRIx2NgGAWjYBSMglEwEICREYRgFBZBqDCSLA2MGPUIVQETE9iNUAqLR5gIeoQKRgwXjwAAGn4AtaFeYLEAAAAASUVORK5CYII=`}};function Mr(e){if(!(e>0)||!Number.isFinite(e))return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;return(n<1.5?1:n<3.5?2:n<7.5?5:10)*t}function Nr(e,t){let n=e.part?t.get(e.part):void 0;return n?[n[0]+e.at[0],n[1]+e.at[1],n[2]+e.at[2]]:[e.at[0],e.at[1],e.at[2]]}var Pr=e=>e.isMesh===!0,Fr={x:0,y:1,z:2},Ir=e=>Array.isArray(e)?e:[e];function Lr(e){let t=[];return e.traverse(n=>{n!==e&&t.push(n)}),t}function Rr(e,t,n){let r=new w,i=new L;for(let[a,o]of t){r.makeEmpty();for(let t of e){t.updateWorldMatrix(!0,!0);let e=Lr(t).filter(e=>Xe(e,o)!==null),n=new Set(e);for(let t of e){let e=!1;for(let r=t.parent;r&&!e;r=r.parent)e=n.has(r);e||r.expandByObject(t)}}r.isEmpty()||n.set(a,r.getCenter(i).toArray())}}function zr(e){let t=new Set;for(let n of Lr(e))for(let e of Ye(n))t.add(e);return[...t]}var Br=class{root;clipNames;resolved;tracked=new Map;visibleOriginally=new Map;touched=new Set;mixer;clips=new Map;actions=new Map;order=new Map;centres=new Map;planes=new Map;cuts=new Map;lastKey=``;constructor(e,t,n=[]){this.root=e;let r=Lr(e);this.rankMeshes(e,r);let i=t.map(e=>{let t=Qe(e.match);return r.map(e=>Xe(e,t))}),a=r.map((e,t)=>Math.min(...i.map(e=>e[t]??2)));this.resolved=t.map((e,t)=>{let n=r.filter((e,n)=>i[t][n]!==null&&i[t][n]===a[n]),o=new Set(n),s=n.filter(e=>{for(let t=e.parent;t;t=t.parent)if(o.has(t))return!1;return!0}),c=[];for(let e of n)e.traverse(e=>Pr(e)&&!c.includes(e)&&c.push(e));return{def:e,matched:n,tops:s,meshes:c}});for(let e of this.resolved){for(let t of e.matched)this.visibleOriginally.has(t)||this.visibleOriginally.set(t,t.visible);for(let t of e.meshes)this.track(t)}this.clipNames=n.map(e=>e.name);for(let e of n)this.clips.has(e.name)||this.clips.set(e.name,e);this.mixer=n.length?new Ee(e):null}rankMeshes(e,t){e.updateMatrixWorld(!0);let n=new w,r=new L,i=t.filter(Pr),a=new Map(i.map(e=>[e,n.setFromObject(e).getSize(r).length()]));i.sort((e,t)=>a.get(e)-a.get(t)),i.forEach((e,t)=>{this.order.set(e,10+t);let n=Ir(e.material);if(n.some(e=>e.transparent)){for(let e of n)e.transparent&&(e.depthWrite=!1);e.renderOrder=10+t}})}get unmatched(){return this.resolved.filter(e=>e.matched.length===0).map(e=>e.def.id)}track(e){if(this.tracked.has(e))return;let t=e.material,n=Ir(t).map(e=>e.clone()),r=n.map(e=>{let t=e,n=t.emissive instanceof H;return{opacity:e.opacity,transparent:e.transparent,depthWrite:e.depthWrite,emissive:n?t.emissive.clone():null,emissiveIntensity:n?t.emissiveIntensity:0,color:e.color instanceof H?e.color.clone():null,side:e.side,clipShadows:e.clipShadows,clipped:(e.clippingPlanes?.length??0)>0}});e.material=Array.isArray(t)?n:n[0],this.tracked.set(e,{mesh:e,baseOrder:e.renderOrder,original:t,clones:n,base:r})}reset(){for(let e of this.touched)e.matrixAutoUpdate=!0;this.touched.clear();for(let[e,t]of this.visibleOriginally)e.visible=t;for(let e of this.tracked.values())e.mesh.renderOrder=e.baseOrder,e.clones.forEach((t,n)=>{let r=e.base[n],i=t;t.opacity=r.opacity,t.depthWrite=r.depthWrite,t.transparent!==r.transparent&&(t.transparent=r.transparent,t.needsUpdate=!0),r.emissive&&(i.emissive.copy(r.emissive),i.emissiveIntensity=r.emissiveIntensity),r.color&&t.color.copy(r.color),!r.clipped&&(t.clippingPlanes?.length??0)>0&&(t.clippingPlanes=null,t.needsUpdate=!0),t.side=r.side,t.clipShadows=r.clipShadows})}holdClips(e){if(!this.mixer)return;let t=new Map(e.map(e=>[e.name,e.progress]));for(let[e,n]of this.clips){if(!t.has(e)&&!this.actions.has(e))continue;let r=this.actions.get(e);r||(r=this.mixer.clipAction(n),r.setLoop(ye,1),r.clampWhenFinished=!0,r.play(),r.paused=!0,this.actions.set(e,r)),r.time=(t.get(e)??0)*n.duration}this.mixer.update(0)}apply(e,t,n){let r=JSON.stringify([e,t]);if(r===this.lastKey)return!1;this.lastKey=r,this.reset(),this.holdClips(t),this.root.updateMatrixWorld(!0);let i=new Map(e.map(e=>[e.id,e])),a=new Map,o=new Map,s=new Map;this.cuts=new Map;for(let e of this.resolved){let t=i.get(e.def.id);if(!t||e.matched.length===0)continue;if(t.hide)for(let t of e.matched)t.visible=!1;let r=t.scale.every(e=>e===1)&&t.move.every(e=>e===0),c=!r||t.cut?this.centreOf(e.tops):new L;if(r||(this.transform(e.tops,t.scale,t.move,c),this.root.updateMatrixWorld(!0)),t.cut){let n=Fr[t.cut.axis],i=r?t.cut.at:c.getComponent(n)+(t.cut.at-c.getComponent(n))*t.scale[n]+t.move[n],a=this.planes.get(e.def.id);a||this.planes.set(e.def.id,a=new b),a.normal.set(0,0,0).setComponent(n,t.cut.keep===`above`?1:-1),a.constant=t.cut.keep===`above`?-i:i,this.cuts.set(e.def.id,{a:n,at:i,keep:t.cut.keep});for(let t of e.meshes)s.set(t,[...s.get(t)??[],a])}for(let r of e.meshes)t.opacity!==1&&a.set(r,t.opacity<1?Math.min(a.get(r)??1,t.opacity):Math.max(a.get(r)??1,t.opacity)),t.glow&&t.glow.amount>0&&t.glow.amount>=(o.get(r)?.amount??0)&&o.set(r,{colour:new H(n(t.glow.colour)),amount:t.glow.amount})}for(let e of this.tracked.values()){let t=a.get(e.mesh)??1,n=o.get(e.mesh),r=s.get(e.mesh);e.clones.forEach((i,a)=>{let o=e.base[a];if(r&&((i.clippingPlanes?.length??0)!==r.length&&(i.needsUpdate=!0),i.clippingPlanes=r,i.clipShadows=!0,i.side=2),t!==1&&(i.opacity=Math.min(1,o.opacity*t),t<1&&(e.mesh.renderOrder=Math.max(e.mesh.renderOrder,this.order.get(e.mesh)??10),i.transparent||(i.transparent=!0,i.needsUpdate=!0),i.depthWrite=!1)),n){if(o.emissive){let e=i;e.emissive.copy(n.colour),e.emissiveIntensity=n.amount}else o.color&&i.color.lerp(n.colour,n.amount*.6)}})}return this.centres=this.measure(),!0}centreOf(e){let t=new w;for(let n of e)t.expandByObject(n);return t.isEmpty()?new L:t.getCenter(new L)}measure(){let e=new Map,t=new w,n=new L;for(let r of this.resolved){if(r.tops.length===0)continue;t.makeEmpty();for(let e of r.tops)t.expandByObject(e);let i=this.cuts.get(r.def.id);if(i&&!t.isEmpty()){let e=i.keep===`above`?`min`:`max`,n=t[e].getComponent(i.a);(i.keep===`above`?i.at>n:i.at<n)&&t[e].setComponent(i.a,i.at),t.min.getComponent(i.a)>t.max.getComponent(i.a)&&t.makeEmpty()}t.isEmpty()||e.set(r.def.id,t.getCenter(n).toArray())}return e}transform(e,t,n,r){let i=new I().makeTranslation(n[0],n[1],n[2]).multiply(new I().makeTranslation(r.x,r.y,r.z)).multiply(new I().makeScale(t[0],t[1],t[2])).multiply(new I().makeTranslation(-r.x,-r.y,-r.z)),a=new I;for(let t of e){let e=i.clone().multiply(t.matrixWorld);t.parent?a.copy(t.parent.matrixWorld).invert():a.identity(),t.matrix.copy(a).multiply(e),t.matrixAutoUpdate=!1,this.touched.add(t)}}dispose(){this.reset(),this.mixer?.stopAllAction(),this.mixer?.uncacheRoot(this.root);for(let e of this.tracked.values()){e.mesh.material=e.original;for(let t of e.clones)t.dispose()}this.tracked.clear(),this.actions.clear()}};function Vr(e,t={}){let n=new Set;e.traverse(e=>{if(Pr(e)&&(e.geometry.dispose(),t.materials!==!1))for(let t of Ir(e.material)){for(let e of Object.values(t))e instanceof k&&n.add(e);t.dispose()}});for(let e of n)e.dispose()}var Hr=(e,t)=>Math.max(0,Math.min(e.r,t.r)-Math.max(e.l,t.l))*Math.max(0,Math.min(e.b,t.b)-Math.max(e.t,t.t));function Ur(e,t,n={}){let r=n.gap??6,i=n.margin??4,a=e.map(e=>({l:e.x-7,t:e.y-7,r:e.x+7,b:e.y+7})),o=[],s=n.obstacles??[],c=[];for(let n of e){let e=7+(n.gap??r),l=n.h+2,u=[];for(let t of[0,-1,1,-2,2])u.push({side:`right`,left:n.x+e,top:n.y-n.h/2+t*l}),u.push({side:`left`,left:n.x-e-n.w,top:n.y-n.h/2+t*l});let d=[],f=[];for(let t of[0,-.5,.5])d.push({side:`above`,left:n.x-n.w/2+t*n.w,top:n.y-e-n.h}),f.push({side:`below`,left:n.x-n.w/2+t*n.w,top:n.y+e});let p=n.prefer===`above`?[...d,...f,...u]:n.prefer===`below`?[...f,...d,...u]:[...u,...d,...f],m=null,h=1/0,g=null;for(let e of p){let r=Math.min(Math.max(e.left,i),Math.max(i,t.w-n.w-i)),c=Math.min(Math.max(e.top,i),Math.max(i,t.h-n.h-i)),l={l:r,t:c,r:r+n.w,b:c+n.h},u=(Math.abs(r-e.left)+Math.abs(c-e.top))*4;for(let e of o)u+=Hr(l,e)*8;for(let e of a)u+=Hr(l,e)*12;for(let e of s)u+=Hr(l,e)*6;if(u<h&&(h=u,m={id:n.id,left:r,top:c,side:e.side},g=l),u===0)break}c.push(m),o.push(g)}return c}var Wr=.22,Gr=.3;function Kr(e,t){return t==null||e.tour.length===0||!Number.isFinite(t)?null:Math.min(e.tour.length-1,Math.max(0,Math.round(t)))}function qr(e,t){let n=Kr(e,t);if(n===null)return null;let r=e.tour[n];return{stop:r,index:n,count:e.tour.length,camera:e.cameras.findIndex(e=>e.id===r.camera),parts:new Set(r.parts),rays:r.rays.length>0?new Set(r.rays):null,clean:r.clean}}function Jr(e){return{key:`tour:${e.index}`,camera:e.camera,set:e.stop.set,objects:e.stop.objects,parts:e.stop.parts,clean:e.clean,rays:e.rays}}var Yr=e=>Object.keys(e.set).length>0||e.objects.length>0||e.parts.length>0||e.clean;function Xr(e,t){let n=t===null?void 0:e.cameras[t];return!n||!Yr(n)?null:{key:`view:${n.id}`,camera:t,set:n.set,objects:n.objects,parts:n.parts,clean:n.clean,rays:n.clean?null:`all`}}var Zr=(e,t,n)=>e!==null&&Object.keys(e.set).some(e=>n[e]!==t[e]);function Qr(e,t){return!e||t.letGo||Zr(e,t.taken,t.knobs)?!1:t.byUser||!Object.keys(e.set).some(n=>t.taken[n]!==e.set[n])}var $r=e=>e===null?null:`stop`in e?Jr(e):e;function ei(e,t){let n=$r(e);return!n||n.rays===`all`?1:n.rays?n.rays.has(t)?1:Wr:0}function ti(e,t){let n=$r(e);return n?n.parts.filter(e=>n.clean||!t.has(e)):[]}function ni(e,t){let n=$r(t);if(!n||n.parts.length===0)return e;let r=new Set(n.parts);return e.map(e=>r.has(e.id)?{...e,opacity:e.opacity===1&&r.size<=3?3:e.opacity,glow:{colour:e.glow?.colour??`primary`,amount:Math.max(e.glow?.amount??0,r.size>3?0:Gr)}}:e)}function ri(e,t,n){e.position.set(...n.position),t.target.set(...n.target),e.fov!==n.fov&&(e.fov=n.fov,e.updateProjectionMatrix()),t.update()}var ii=.9,ai=e=>{let t=e;return!!t&&(t.tagName===`INPUT`||t.tagName===`TEXTAREA`||t.tagName===`SELECT`||t.isContentEditable)};function oi({poses:e,follow:t,objects:n,limits:r,request:i,reduced:a,reserveRight:o,pad:s,onUserMove:c,onHome:l,commands:u,model:d,rays:f,framing:p}){let m=K(e=>e.camera),h=K(e=>e.gl),g=K(e=>e.invalidate),_=(0,q.useMemo)(()=>new Gn(m,h.domElement),[m,h]),v=K(e=>e.size),y=(0,q.useRef)(null),b=(0,q.useRef)(c);b.current=c;let x=(0,q.useRef)(l);x.current=l;let S=(0,q.useRef)(new Set),C=(0,q.useRef)(null),w=o>0&&v.width-o>v.width*.5?o:0,T=Math.max(160,v.width-w-s.left-s.right),E=Math.max(160,v.height-s.top-s.bottom),D=T/E,O=(w+s.right-s.left)/2,k=(s.bottom-s.top)/2,ee=(0,q.useMemo)(()=>d.box.isEmpty()?{min:[0,0,0],max:[0,0,0]}:{min:d.box.min.toArray(),max:d.box.max.toArray()},[d]),A=(0,q.useRef)(f.flatMap(e=>e.points));A.current=f.flatMap(e=>e.points);let j=(0,q.useRef)(1),te=(0,q.useRef)(!1),M=(0,q.useRef)(new Map);M.current=new Map(n.map(e=>[e.id,e.position]));let ne=(0,q.useRef)(null),re=n=>{let r=e[n]??e[0],i=t[n],a=i?M.current.get(i):void 0,o=a?{...r,position:[r.position[0]+a[0],r.position[1]+a[1],r.position[2]+a[2]],target:[r.target[0]+a[0],r.target[1]+a[1],r.target[2]+a[2]]}:r;ne.current=i&&a?{id:i,last:a}:null;let s=!i&&!te.current&&p.current.box?St(o,p.current.box,ee,A.current):1;j.current=s;let c=vt(Ct(o,s),D),l=D>=1.3?1:Math.min(2.4,gt/D),u=v.height/E;return u>l?Ct(c,u/l):c},ie=()=>({position:m.position.toArray(),target:_.target.toArray(),fov:m.fov}),N=(e,t)=>{t||a?(y.current=null,ri(m,_,e)):y.current={from:ie(),to:e,t0:performance.now()},g()},ae=()=>{C.current!==null&&(C.current=null,b.current())};(0,q.useEffect)(()=>{_.enableDamping=!a,_.dampingFactor=.12,_.rotateSpeed=.7,_.zoomSpeed=.8,_.minDistance=r.min,_.maxDistance=r.max,m.near=r.near,m.far=r.far,m.updateProjectionMatrix(),g()},[_,m,r,a,g]),(0,q.useEffect)(()=>{O!==0||k!==0?m.setViewOffset(v.width,v.height,O,k,v.width,v.height):m.clearViewOffset(),g(),C.current!==null&&(y.current?y.current.to=re(C.current):ri(m,_,re(C.current)))},[m,_,v.width,v.height,w,s.left,s.right,s.top,s.bottom,g]),(0,q.useEffect)(()=>{let e=()=>g(),t=()=>{y.current=null,ae()};return _.addEventListener(`change`,e),_.addEventListener(`start`,t),()=>{_.removeEventListener(`change`,e),_.removeEventListener(`start`,t),_.dispose()}},[_,g]),(0,q.useEffect)(()=>{let e=e=>{let t=ie(),n=[t.position[0]-t.target[0],t.position[1]-t.target[1],t.position[2]-t.target[2]];if(e.type===`rotate`){let r=e.dir*Math.PI/2,i=Math.cos(r),a=Math.sin(r);ae(),N({...t,position:[t.target[0]+n[0]*i+n[2]*a,t.position[1],t.target[2]-n[0]*a+n[2]*i]},!1)}else{let i=Math.hypot(...n),a=Math.min(r.max,Math.max(r.min,i/e.factor))/i;ae(),N({...t,position:[t.target[0]+n[0]*a,t.target[1]+n[1]*a,t.target[2]+n[2]*a]},!1)}};u.current=e;let t=t=>{if(t.ctrlKey||t.metaKey||t.altKey||ai(t.target))return;let n=t.key.toLowerCase(),r=n.startsWith(`arrow`);r&&t.target!==document.body&&t.target!==h.domElement||([`w`,`a`,`s`,`d`].includes(n)||r?(S.current.add(n),ae(),t.preventDefault(),g()):n===`q`?e({type:`rotate`,dir:-1}):n===`e`?e({type:`rotate`,dir:1}):n===`+`||n===`=`?e({type:`zoom`,factor:1.25}):n===`-`||n===`_`?e({type:`zoom`,factor:1/1.25}):n===`0`&&x.current())},n=e=>void S.current.delete(e.key.toLowerCase()),i=()=>S.current.clear();return window.addEventListener(`keydown`,t),window.addEventListener(`keyup`,n),window.addEventListener(`blur`,i),()=>{u.current=null,window.removeEventListener(`keydown`,t),window.removeEventListener(`keyup`,n),window.removeEventListener(`blur`,i)}},[m,_,h,r,a,u,g]),(0,q.useEffect)(()=>{i&&(C.current=i.index,te.current=i.fixed===!0,N(re(i.index),i.instant))},[i]);let P=(0,q.useMemo)(()=>new L,[]),oe=(0,q.useMemo)(()=>new L,[]);return W((t,n)=>{let r=y.current,i=ne.current,a=i?M.current.get(i.id):void 0;if(i&&a&&(a[0]!==i.last[0]||a[1]!==i.last[1]||a[2]!==i.last[2])){let e=new L(a[0]-i.last[0],a[1]-i.last[1],a[2]-i.last[2]);if(m.position.add(e),_.target.add(e),r)for(let t of[r.from,r.to])for(let n of[`position`,`target`])t[n]=[t[n][0]+e.x,t[n][1]+e.y,t[n][2]+e.z];i.last=a,g()}if(!r&&C.current!==null&&!te.current&&p.current.box){let t=St(e[C.current]??e[0],p.current.box,ee,A.current);Math.abs(t-j.current)>.004&&ri(m,_,re(C.current))}if(S.current.size>0){let e=0,t=0;for(let n of S.current)(n===`d`||n===`arrowright`)&&(e+=1),(n===`a`||n===`arrowleft`)&&--e,(n===`w`||n===`arrowup`)&&(t+=1),(n===`s`||n===`arrowdown`)&&--t;if(e!==0||t!==0){let r=Math.hypot(e,t),i=m.position.distanceTo(_.target)*ii*Math.min(.05,n);P.set(1,0,0).applyQuaternion(m.quaternion),oe.set(0,1,0).applyQuaternion(m.quaternion),P.multiplyScalar(e/r*i).addScaledVector(oe,t/r*i),m.position.add(P),_.target.add(P),y.current=null}g()}if(y.current){let e=y.current,t=Math.min(1,(performance.now()-e.t0)/700);ri(m,_,ht(e.from,e.to,ft(t))),t>=1?y.current=null:g()}else _.update()},-1),null}var si=[-5,16,6],ci={aces:4,agx:6,neutral:7,linear:1},li=(e,t)=>{if(e?.azimuth===void 0&&e?.elevation===void 0&&!t)return new L(...si).normalize();let n=(e?.azimuth??t?.azimuth??-39.8)*Math.PI/180,r=(e?.elevation??t?.elevation??68.6)*Math.PI/180;return new L(Math.sin(n)*Math.cos(r),Math.sin(r),Math.cos(n)*Math.cos(r))},ui=.75,di=1,fi=.35,pi=2048;function mi({model:e,world:t,sky:n,env:r,light:i}){let a=K(e=>e.gl);(0,q.useEffect)(()=>(a.toneMapping=ci[i?.tone??`aces`],a.toneMappingExposure=i?.exposure??1.08,()=>{a.toneMapping=4,a.toneMappingExposure=1.08}),[a,i?.tone,i?.exposure]);let o=K(e=>e.scene),s=K(e=>e.invalidate);(0,q.useEffect)(()=>{let e=new je(a),t=r?.light??n,c=t?null:new ir,l=t?e.fromEquirectangular(t):e.fromScene(c,.04);o.environment=l.texture;let u=r&&i?.azimuth!==void 0?(i.azimuth-r.sun.azimuth)*Math.PI/180:0;return o.environmentRotation.y=u,o.backgroundRotation.y=u,o.userData.environmentSource=r?`hdr`:n?`sky`:`room`,o.environmentIntensity=i?.environment??(r?di:n?ui:fi),s(),()=>{o.environment=null,o.environmentRotation.y=0,o.backgroundRotation.y=0,l.dispose(),e.dispose(),c?.dispose()}},[a,o,s,n,r,i?.environment,i?.azimuth]);let c=t?t.extent:e.diag,l=t?new L(...t.centre):e.center,u=c/12,d=(0,q.useRef)(null),f=(0,q.useMemo)(()=>li(i,r?.sun),[i?.azimuth,i?.elevation,r]),p=(0,q.useMemo)(()=>new L,[]);return W(({camera:e})=>{let n=d.current;if(!n||!t)return;e.getWorldDirection(p);let{x:r,z:i,half:a}=nt(e.position.toArray(),p.toArray(),t.centre,t.extent,pi),o=a*3+12;n.target.position.set(r,0,i),n.target.updateMatrixWorld(),n.position.set(r+f.x*o,f.y*o,i+f.z*o);let s=n.shadow.camera;s.right!==a&&(s.left=-a,s.right=a,s.top=a,s.bottom=-a,s.near=o*.1,s.far=o+a*4+30,s.updateProjectionMatrix()),n.shadow.normalBias=a*.0012}),(0,q.useEffect)(()=>{let e=d.current;if(e)return e.target.position.copy(l),o.add(e.target),()=>void o.remove(e.target)},[o,l.x,l.y,l.z]),(0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)(`hemisphereLight`,{args:[`#ffffff`,`#c5d0e0`,i?.ambient??1.05]}),(0,J.jsx)(`directionalLight`,{ref:d,position:[l.x+si[0]*u,l.y+si[1]*u,l.z+si[2]*u],intensity:i?.sun??2.6,color:`#ffffff`,castShadow:!0,"shadow-mapSize":[pi,pi],"shadow-radius":3,"shadow-bias":-4e-4,"shadow-normalBias":c*5e-4,"shadow-camera-left":-c,"shadow-camera-right":c,"shadow-camera-top":c,"shadow-camera-bottom":-c,"shadow-camera-near":c*.2,"shadow-camera-far":c*6})]})}function hi({colour:e,sky:t}){let n=K(e=>e.scene),r=K(e=>e.invalidate);return(0,q.useEffect)(()=>(n.background=t??new H(e),n.backgroundIntensity=1,r(),()=>{n.background=null}),[n,r,e,t]),null}function gi({look:e,world:t,horizon:n}){let r=K(e=>e.scene),i=K(e=>e.invalidate),a=t&&e?e.haze:0,o=n??e?.sky??`#ffffff`,s=t?.extent??1;return(0,q.useEffect)(()=>(r.fog=a>0?new re(o,s*.9/a,s*4.5/a):null,i(),()=>{r.fog=null}),[r,i,a,o,s]),null}var _i=1e3;function vi(){let e={value:new H(`#888888`)},t={value:new R(1e6,2e6)},n=new _({metalness:0,color:`#ffffff`,polygonOffset:!0,polygonOffsetFactor:4,polygonOffsetUnits:4});return n.onBeforeCompile=n=>{n.uniforms.uAvg=e,n.uniforms.uFade=t,n.fragmentShader=n.fragmentShader.replace(`#include <common>`,`#include <common>
uniform vec3 uAvg;
uniform vec2 uFade;`).replace(`#include <map_fragment>`,`#ifdef USE_MAP
  vec4 texel = texture2D( map, vMapUv );
  float lumAvg = max( dot( uAvg, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.02 );
  float macro = dot( texture2D( map, vMapUv * 0.0713 + vec2( 0.37, 0.11 ) ).rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) / lumAvg;
  texel.rgb *= clamp( mix( 1.0, macro, 0.55 ), 0.7, 1.35 );
  float far = smoothstep( uFade.x, uFade.y, length( vViewPosition ) );
  texel.rgb = mix( texel.rgb, uAvg * clamp( mix( 1.0, macro, 0.4 ), 0.8, 1.2 ), far );
  diffuseColor *= texel;
#endif`)},n.customProgramCacheKey=()=>`stage3d-photo-ground`,{material:n,average:e,fade:t}}function yi({model:e,world:t,look:n,ground:r}){let i=K(e=>e.gl),a=(0,q.useMemo)(vi,[]);(0,q.useEffect)(()=>()=>a.material.dispose(),[a]);let o=t?t.extent:e.diag,s=t?new L(...t.centre):e.center,c=n??jt.lab,l=(0,q.useMemo)(()=>new B({vertexShader:Ae,fragmentShader:Ie,transparent:!0,depthWrite:!1,uniforms:{minor:{value:new H(`#c9d4e3`)},major:{value:new H(`#b3c1d6`)},centre:{value:new R(0,0)},reach:{value:60},cellSize:{value:1},minorAlpha:{value:.5},majorAlpha:{value:.75}}}),[]);(0,q.useEffect)(()=>{l.polygonOffset=!0,l.polygonOffsetFactor=3,l.polygonOffsetUnits=3},[l]),(0,q.useEffect)(()=>{let e=l.uniforms;e.cellSize.value=Mr(t?o/40:o/10),e.centre.value.set(s.x,s.z),e.reach.value=t?o*1.2+40:o*4,e.minor.value.set(c.gridMinor),e.major.value.set(c.gridMajor),e.minorAlpha.value=r?r.grid===!1?0:.12:.5,e.majorAlpha.value=r?r.grid===!1?0:.3:.75},[l,o,s.x,s.z,t,c,r]),(0,q.useEffect)(()=>()=>l.dispose(),[l]);let u=t?0:e.box.min.y-o*.1,d=(t?o:o*60)*(t?6:1),f=Math.max(d,4e3),p=r?r.tile??_i/r.repeat:1;return(0,q.useEffect)(()=>{if(!r)return;let e=r.texture,t=f/p,n=[e,r.normal,r.rough,r.ao].filter(e=>!!e);for(let e of n)e.repeat.set(t,t),e.offset.set(s.x/p-t/2,-s.z/p-t/2),e.anisotropy=i.capabilities.getMaxAnisotropy(),e.needsUpdate=!0;let o=a.material;(o.map!==e||o.normalMap!==(r.normal??null)||o.roughnessMap!==(r.rough??null)||o.aoMap!==(r.ao??null))&&(o.map=e,o.normalMap=r.normal??null,o.roughnessMap=r.rough??null,o.aoMap=r.ao??null,o.needsUpdate=!0),o.normalScale.set(r.normalScale??1,r.normalScale??1),o.roughness=r.roughness,a.average.value.set(r.average??`#888888`),a.fade.value.set(p*8,p*40)},[r,i,f,p,s.x,s.z,a]),(0,J.jsxs)(J.Fragment,{children:[r?(0,J.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],position:[s.x,u-o*2e-4,s.z],renderOrder:-11,frustumCulled:!1,receiveShadow:!0,children:[(0,J.jsx)(`planeGeometry`,{args:[f,f]}),(0,J.jsx)(`primitive`,{object:a.material,attach:`material`})]}):null,!r&&c.ground?(0,J.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],position:[s.x,u-o*2e-4,s.z],renderOrder:-11,frustumCulled:!1,children:[(0,J.jsx)(`planeGeometry`,{args:[d,d]}),(0,J.jsx)(`meshBasicMaterial`,{color:c.ground,toneMapped:!1,polygonOffset:!0,polygonOffsetFactor:4,polygonOffsetUnits:4})]}):null,(0,J.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],position:[s.x,u,s.z],renderOrder:-10,frustumCulled:!1,children:[(0,J.jsx)(`planeGeometry`,{args:[d,d]}),(0,J.jsx)(`primitive`,{object:l,attach:`material`})]}),r?null:(0,J.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],position:[s.x,u+o*1e-4,s.z],receiveShadow:!0,renderOrder:-9,frustumCulled:!1,children:[(0,J.jsx)(`planeGeometry`,{args:[d,d]}),(0,J.jsx)(`shadowMaterial`,{color:Fe.navy,opacity:.2,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:2,polygonOffsetUnits:2})]})]})}function bi({marks:e,backdrop:t,scale:n}){return(0,J.jsx)(J.Fragment,{children:e.map(e=>{let r=e.kind===`zone`,i=r?Math.max(e.to-e.from,n*.002):Math.max(n*.006,.25),a=r?n*.03:n*.12;return(0,J.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],position:[r?(e.from+e.to)/2:e.from,n*3e-4,0],renderOrder:-8,frustumCulled:!1,children:[(0,J.jsx)(`planeGeometry`,{args:[i,a]}),(0,J.jsx)(`meshBasicMaterial`,{color:Ot(e.colour,t),transparent:!0,opacity:r?.45:.85,depthWrite:!1,toneMapped:!1,polygonOffset:!0,polygonOffsetFactor:1,polygonOffsetUnits:1})]},e.id)})})}var xi={roughness:.5,metalness:.18};function Si(e){e.userData.polished||(e.userData.polished=!0,e.traverse(e=>{if(e.isMesh)for(let t of[].concat(e.material)){let e=t;e.isMeshStandardMaterial&&e.map&&e.roughness>=.9&&e.metalness<=.05&&!e.transparent&&(e.roughness=xi.roughness,e.metalness=xi.metalness,e.needsUpdate=!0)}}))}function Ci({instances:e,objects:t,finish:n,live:r}){let i=K(e=>e.invalidate);return(0,q.useEffect)(()=>{if(r)return;let a=new Map(t.map(e=>[e.id,e]));for(let[t,r]of e){let e=a.get(t);r.visible=e!==void 0,e&&(n&&Si(r),r.position.set(e.position[0],e.position[1],e.position[2]),e.quaternion?r.quaternion.set(e.quaternion[0],e.quaternion[1],e.quaternion[2],e.quaternion[3]):r.rotation.set(e.rotation[0]*Math.PI/180,e.rotation[1]*Math.PI/180,e.rotation[2]*Math.PI/180,`XYZ`),r.scale.set(e.scale[0],e.scale[1],e.scale[2]))}i()},[e,t,i,n,r]),(0,J.jsx)(J.Fragment,{children:[...e].map(([e,t])=>(0,J.jsx)(`primitive`,{object:t},e))})}function wi({live:e,view:t,instances:n}){let r=K(e=>e.gl),i=K(e=>e.camera),a=K(e=>e.invalidate),o=(0,q.useMemo)(()=>new M,[]),s=(0,q.useMemo)(()=>new b,[]),l=(0,q.useMemo)(()=>new R,[]),u=(0,q.useMemo)(()=>new L,[]),d=(0,q.useMemo)(()=>new L,[]);return W((r,i)=>{e.advance(i);let o=c(t,e.scope()),s=new Set;for(let e of o.objects){let t=n.get(e.id);t&&(s.add(e.id),t.visible=!0,t.position.set(e.position[0],e.position[1],e.position[2]),e.quaternion?t.quaternion.set(e.quaternion[0],e.quaternion[1],e.quaternion[2],e.quaternion[3]):t.rotation.set(e.rotation[0]*Math.PI/180,e.rotation[1]*Math.PI/180,e.rotation[2]*Math.PI/180,`XYZ`),t.scale.set(e.scale[0],e.scale[1],e.scale[2]))}for(let[e,t]of n)s.has(e)||(t.visible=!1);e.running&&a()}),(0,q.useEffect)(()=>{ji&&(window.__live=e);let t=r.domElement,n=e=>{let n=t.getBoundingClientRect();return l.set((e.clientX-n.left)/n.width*2-1,-((e.clientY-n.top)/n.height)*2+1),o.setFromCamera(l,i),o.ray},c=r=>{if(r.button!==0)return;let o=n(r),c=e.pick([o.origin.x,o.origin.y,o.origin.z],[o.direction.x,o.direction.y,o.direction.z]);c&&e.movable(c.body)&&e.grab(c.body,c.point)&&(i.getWorldDirection(d),s.setFromNormalAndCoplanarPoint(d,u.set(c.point[0],c.point[1],c.point[2])),t.setPointerCapture?.(r.pointerId),t.style.cursor=`grabbing`,r.stopImmediatePropagation(),r.preventDefault(),a())},f=r=>{if(e.grabbed){n(r).intersectPlane(s,u)&&e.moveGrab([u.x,u.y,u.z]),a();return}let i=n(r),o=e.pick([i.origin.x,i.origin.y,i.origin.z],[i.direction.x,i.direction.y,i.direction.z]);t.style.cursor=o&&e.movable(o.body)?`grab`:``},p=n=>{e.grabbed&&(e.release(),t.releasePointerCapture?.(n.pointerId),t.style.cursor=``,a())};return t.addEventListener(`pointerdown`,c,{capture:!0}),t.addEventListener(`pointermove`,f),window.addEventListener(`pointerup`,p),window.addEventListener(`pointercancel`,p),()=>{t.removeEventListener(`pointerdown`,c,{capture:!0}),t.removeEventListener(`pointermove`,f),window.removeEventListener(`pointerup`,p),window.removeEventListener(`pointercancel`,p),e.release(),t.style.cursor=``}},[r,i,e,a,o,s,l,u,d]),null}function Ti({strength:e,radius:t,extent:n,onSlow:r}){let i=K(e=>e.gl),a=K(e=>e.scene),o=K(e=>e.camera),s=K(e=>e.size),c=(0,q.useMemo)(()=>{let e=new p(s.width,s.height,{type:V}),t=new mr(i,e);t.addPass(new Dr(a,o));let n=new wr(a,o,s.width,s.height),r=n.render.bind(n);return n.render=(...e)=>{let t=[];a.traverse(e=>{let n=e;(n.isLine2||n.isLineSegments2)&&e.visible&&(e.visible=!1,t.push(e))}),r(...e);for(let e of t)e.visible=!0},t.addPass(n),t.addPass(new Er),t.addPass(new jr),{composer:t,gtao:n}},[i,a,o]);(0,q.useEffect)(()=>{c.composer.setPixelRatio(Math.min(i.getPixelRatio(),2)),c.composer.setSize(s.width,s.height)},[c,i,s.width,s.height]),(0,q.useEffect)(()=>{c.gtao.blendIntensity=e,c.gtao.updateGtaoMaterial({radius:t??Math.min(.8,Math.max(.1,n/40)),distanceExponent:1.4,thickness:1.5,scale:1.1,samples:16,distanceFallOff:1,screenSpaceRadius:!1}),c.gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,radiusExponent:1,rings:2,samples:16})},[c,e,t,n]),(0,q.useEffect)(()=>(ji&&(window.__composer=c.composer),()=>{c.composer.dispose(),c.gtao.dispose()}),[c]);let l=(0,q.useRef)([]);return W((e,t)=>{c.composer.render(t),t>=2?l.current=[]:(l.current.push(t),l.current.length>12&&l.current.shift(),l.current.length===12&&l.current.filter(e=>e>.05).length>=8&&r())},1),null}function Ei({model:e,parts:t,clips:n,backdrop:r,framing:i}){let a=K(e=>e.invalidate);return(0,q.useEffect)(()=>{if(e.fx.apply(t,n,e=>Ot(e,r))){let t=new w().setFromObject(e.gltf.scene);i.current={box:t.isEmpty()?null:{min:t.min.toArray(),max:t.max.toArray()}},a()}},[e,t,n,r,i,a]),null}function Di({ray:e,backdrop:t,fade:n,dash:r,ghost:i=!0}){let a=JSON.stringify(e.points),o=n<=0,s={points:(0,q.useMemo)(()=>e.points.map(e=>[...e]),[a]),color:Ot(e.colour,t),lineWidth:e.width,dashed:e.dashed,dashSize:r,gapSize:r*.7,transparent:!0};return o?null:(0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)(In,{...s,opacity:n,renderOrder:1e3}),i?(0,J.jsx)(In,{...s,opacity:n*.3,depthTest:!1,depthWrite:!1,renderOrder:1001}):null]})}var Oi=110,ki=34;function Ai({model:e,markers:t,rays:n,refs:r,shown:i,instances:a,objects:o,parts:s}){let c=K(e=>e.invalidate),l=(0,q.useRef)(t);l.current=t;let u=(0,q.useRef)(n);u.current=n;let d=(0,q.useRef)(i);d.current=i;let f=(0,q.useRef)({instances:a,objects:o});f.current={instances:a,objects:o};let p=(0,q.useMemo)(()=>new Map(s.map(e=>[e.id,Qe(e.match)])),[s]),m=(0,q.useMemo)(()=>new Map,[]);(0,q.useEffect)(()=>c(),[t,n,i,a,o,c]);let h=(0,q.useMemo)(()=>new L,[]);return W(({camera:t,size:n,gl:i})=>{if(!d.current)return;t.updateMatrixWorld();let a=t,o=e.diag/(2*Math.max(t.position.distanceTo(e.center),1e-9)*Math.tan(a.fov*Math.PI/360))*n.height<Oi,s=[];m.clear();let c=new Map;for(let t of l.current)t.part&&!e.fx.centres.has(t.part)&&p.has(t.part)&&c.set(t.part,p.get(t.part));c.size>0&&Rr(f.current.objects.flatMap(e=>f.current.instances.get(e.id)??[]),c,m);for(let i of l.current){let a=r.current.get(i.id);if(!a?.glyph||!a.label)continue;let o=Nr(i,i.part&&!e.fx.centres.has(i.part)&&m.has(i.part)?m:e.fx.centres);h.set(o[0],o[1],o[2]).applyMatrix4(t.matrixWorldInverse);let c=h.z>0;h.set(o[0],o[1],o[2]).project(t);let l=(h.x*.5+.5)*n.width,u=(-h.y*.5+.5)*n.height;s.push({m:i,els:a,x:l,y:u,visible:!c&&l>-12&&l<n.width+12&&u>-12&&u<n.height+12})}let g=new Map;s.filter(e=>e.visible&&e.m.shape===`name`).sort((e,t)=>e.x-t.x).forEach((e,t)=>g.set(e.m.id,t%2==0?`above`:`below`));let _=s.filter(t=>t.visible&&!(o&&t.m.part&&e.fx.centres.has(t.m.part))).map(e=>({id:e.m.id,x:e.x,y:e.y,w:e.els.label.offsetWidth,h:e.els.label.offsetHeight,...e.m.shape===`card`||e.m.shape===`name`?{gap:ki}:{},...g.has(e.m.id)?{prefer:g.get(e.m.id)}:{}})),v=[],y=i.domElement.closest(`.s3`),b=i.domElement.getBoundingClientRect();y?.querySelectorAll(`[data-s3-avoid]`).forEach(e=>{let t=e.getBoundingClientRect();v.push({l:t.left-b.left,t:t.top-b.top,r:t.right-b.left,b:t.bottom-b.top})}),i.domElement.closest(`.cv`)?.querySelectorAll(`[data-hud="left"], [data-hud="right"]`).forEach(e=>{if(y?.contains(e))return;let t=e.getBoundingClientRect();t.width<1||v.push({l:t.left-b.left,t:t.top-b.top,r:t.right-b.left,b:t.bottom-b.top})});for(let e of u.current){let r=null;for(let i of e.points){h.set(i[0],i[1],i[2]).project(t);let e={x:(h.x*.5+.5)*n.width,y:(-h.y*.5+.5)*n.height};if(r){let t=Math.max(1,Math.ceil(Math.hypot(e.x-r.x,e.y-r.y)/8));for(let n=0;n<=t;n++){let i=r.x+(e.x-r.x)*n/t,a=r.y+(e.y-r.y)*n/t;v.push({l:i-4,t:a-4,r:i+4,b:a+4})}}r=e}}let x=new Map(Ur(_,{w:n.width,h:n.height},{obstacles:v}).map(e=>[e.id,e]));for(let t of s){let n=x.get(t.m.id),r=t.visible&&n!==void 0,i=t.visible&&o&&!!t.m.part&&e.fx.centres.has(t.m.part);if(t.els.glyph.style.visibility=r||i?`visible`:`hidden`,t.els.label.style.visibility=r?`visible`:`hidden`,i)t.els.glyph.style.transform=`translate(${t.x-7}px, ${t.y-7}px)`,t.els.line?.setAttribute(`visibility`,`hidden`);else if(!r)t.els.line?.setAttribute(`visibility`,`hidden`);else if(t.els.glyph.style.transform=`translate(${t.x-7}px, ${t.y-7}px)`,t.els.label.style.transform=`translate(${n.left}px, ${n.top}px)`,t.els.line){let e=t.els.label.offsetWidth,r=t.els.label.offsetHeight,i=Math.min(Math.max(t.x,n.left),n.left+e),a=Math.min(Math.max(t.y,n.top),n.top+r),o=Math.hypot(i-t.x,a-t.y)>12;t.els.line.setAttribute(`visibility`,o?`visible`:`hidden`),o&&(t.els.line.setAttribute(`x1`,t.x.toFixed(1)),t.els.line.setAttribute(`y1`,t.y.toFixed(1)),t.els.line.setAttribute(`x2`,i.toFixed(1)),t.els.line.setAttribute(`y2`,a.toFixed(1)))}}}),null}var ji=typeof location<`u`&&new URLSearchParams(location.search).has(`qa`);function Mi(){let e=K();return window.__stage3d=e,W(({gl:e})=>{e.domElement.dataset.frames=String(Number(e.domElement.dataset.frames??0)+1)}),null}function Ni(e){let{model:t,backdrop:n,reducedMotion:r}=e,[i,a]=(0,q.useState)(!1);(0,q.useEffect)(()=>{ji&&(window.__ao=i?`off: too slow`:e.light?.ao?`on`:`none`)},[i,e.light?.ao]);let o=e.poses[0],s=(0,q.useRef)({box:null}),c=(e.world?e.world.extent:t.diag)*.02,l=(0,q.useMemo)(()=>e.trails.length?[...e.rays,...e.trails]:e.rays,[e.rays,e.trails]);return(0,J.jsxs)(Re,{frameloop:`demand`,shadows:`percentage`,dpr:[1,2],gl:{antialias:!0,alpha:!1,powerPreference:`high-performance`,toneMapping:4,toneMappingExposure:1.08},camera:{fov:o.fov,near:e.limits.near,far:e.limits.far,position:o.position},onCreated:({gl:t})=>{t.localClippingEnabled=!0,t.domElement.addEventListener(`webglcontextlost`,t=>{t.preventDefault(),e.onLost()})},"aria-hidden":`true`,onPointerMissed:()=>e.onPick(null),children:[(0,J.jsx)(hi,{colour:e.look?e.look.sky:wt[n],sky:e.sky?.texture??e.environment?.texture??null}),(0,J.jsx)(gi,{look:e.look,world:e.world,horizon:e.sky?.horizon??e.environment?.horizon??null}),(0,J.jsx)(oi,{poses:e.poses,follow:e.follow,objects:e.objects,limits:e.limits,request:e.request,reduced:r,reserveRight:e.reserveRight,pad:e.pad,onUserMove:e.onUserMove,onHome:e.onHome,commands:e.commands,model:t,rays:e.rays,framing:s}),(0,J.jsx)(mi,{model:t,world:e.world,sky:e.sky?.texture??null,env:e.environment??null,light:e.light}),(0,J.jsx)(yi,{model:t,world:e.world,look:e.look,ground:e.ground}),(0,J.jsx)(bi,{marks:e.marks,backdrop:n,scale:e.world?e.world.extent:t.diag}),(0,J.jsx)(`primitive`,{object:t.gltf.scene,onClick:t=>{t.stopPropagation(),e.onPick(Je(t.object,e.partMatches))}}),(0,J.jsx)(Ci,{instances:e.instances,objects:e.objects,finish:e.world!==null,live:!!e.live}),e.live?(0,J.jsx)(wi,{live:e.live,view:e.view,instances:e.instances}):null,e.light?.ao&&!i?(0,J.jsx)(Ti,{strength:e.light.ao,radius:e.light.aoRadius,extent:e.world?e.world.extent:t.diag,onSlow:()=>a(!0)}):null,(0,J.jsx)(Ei,{model:t,parts:e.parts,clips:e.clips,backdrop:n,framing:s}),e.rays.map(t=>(0,J.jsx)(Di,{ray:t,backdrop:n,fade:ei(e.shown,t.id),dash:c},t.id)),e.trails.map(e=>(0,J.jsx)(Di,{ray:e,backdrop:n,fade:1,dash:c,ghost:!1},e.id)),(0,J.jsx)(Ai,{model:t,markers:e.markers,rays:l,refs:e.markerRefs,shown:e.labels,instances:e.instances,objects:e.objects,parts:e.partMatches}),ji?(0,J.jsx)(Mi,{}):null]})}var Pi=new WeakMap;function Fi(e,t){let n=Pi.get(e);n||Pi.set(e,n=new Map);let i=`${t.id}|${t.x}|${t.y}|${t.z}`,a=n.get(i);if(a)return a;let o={t:[],p:[]};try{let n=r(t.x),i=r(t.y),a=r(t.z),s={...e.base};for(let t=0;t<e.t.length;t++){s.t=e.t[t];for(let n of e.vars)s[n]=e.series[n][t];let r=n.eval(s),c=i.eval(s),l=a.eval(s);Number.isFinite(r)&&Number.isFinite(c)&&Number.isFinite(l)&&(o.t.push(e.t[t]),o.p.push([r,c,l]))}}catch{}return n.set(i,o),o}function Ii(e,t,n){let r=Fi(e,t),i=r.t.length;if(i===0)return[];let a=Math.min(Math.max(n,0),e.T),o=0;for(;o+1<i&&r.t[o+1]<=a;)o++;let s=r.p.slice(0,o+1);if(o+1<i&&a>r.t[o]){let e=r.t[o],t=r.t[o+1],n=t===e?0:(a-e)/(t-e),i=r.p[o],c=r.p[o+1];s.push([i[0]+(c[0]-i[0])*n,i[1]+(c[1]-i[1])*n,i[2]+(c[2]-i[2])*n])}if(s.length<=360)return s;let c=(s.length-1)/359,l=[];for(let e=0;e<359;e++)l.push(s[Math.round(e*c)]);return l.push(s[s.length-1]),l}function Li(e,t,n){if(!t)return[];let r=[];for(let i of e.trails){let e=Ii(t,i,n);e.length>=2&&r.push({id:i.id,label:i.label,colour:i.colour,width:i.width,dashed:i.dashed,points:e})}return r}function Ri(e,t){if(!t||e.trails.length===0)return null;let n=[1/0,1/0,1/0],r=[-1/0,-1/0,-1/0];for(let i of e.trails)for(let e of Fi(t,i).p)for(let t=0;t<3;t++)n[t]=Math.min(n[t],e[t]),r[t]=Math.max(r[t],e[t]);return Number.isFinite(n[0])?{centre:[(n[0]+r[0])/2,(n[1]+r[1])/2,(n[2]+r[2])/2],extent:Math.hypot(r[0]-n[0],r[1]-n[1],r[2]-n[2])}:null}function zi(e){return(e??[]).map(e=>({id:e.id,kind:e.kind,from:e.from,to:e.kind===`zone`&&e.to!==void 0?e.to:e.from,label:e.label,colour:e.kind===`zone`?`ok`:`bad`}))}var Bi=`The 3D model file could not be read.`;function Vi(e){return new Promise((t,n)=>{let r=new Le;r.setMeshoptDecoder(qe);try{r.parse(e,``,t,e=>n(Error(e instanceof Error?e.message:String(e?.message??e))))}catch(e){n(e instanceof Error?e:Error(String(e)))}})}var Hi={metalness:0,roughness:.72},Ui=e=>e.isMeshStandardMaterial===!0,Wi=(e,t)=>e.traverse(e=>{if(!e.isMesh)return;let n=e;for(let e of[].concat(n.material))t(e,n)});function Gi(e){let t=0,n=new Set;return Wi(e,e=>{Ui(e)&&!n.has(e.uuid)&&(n.add(e.uuid),e.metalness===1&&e.roughness===1&&!e.metalnessMap&&!e.roughnessMap&&(e.metalness=Hi.metalness,e.roughness=Hi.roughness,e.needsUpdate=!0,t++))}),t}function Ki(e,t){let n=e.trim().toLowerCase();if(n===`*`||n===``)return!0;let r=t.toLowerCase();if(!n.includes(`*`))return r.includes(n);let i=n.split(`*`),a=0;for(let e=0;e<i.length;e++){let t=i[e];if(t!==``){if(e===0){if(!r.startsWith(t))return!1;a=t.length}else if(e===i.length-1)return r.length-t.length>=a&&r.endsWith(t);else{let e=r.indexOf(t,a);if(e<0)return!1;a=e+t.length}}}return!0}function qi(e,t){let n=[];if(t.length===0)return n;let r=new Map;return e.traverse(e=>{if(!e.isMesh)return;let i=e,a=[].concat(i.material).map(e=>{let i=t.filter(t=>Ki(t.match,e.name));if(i.length===0||!Ui(e))return e;let a=r.get(e);if(!a){a=e.clone();for(let e of i)if(e.colour!==void 0&&a.color.set(e.colour),e.metalness!==void 0&&(a.metalness=e.metalness),e.roughness!==void 0&&(a.roughness=e.roughness),e.emissive!==void 0&&a.emissive.set(e.emissive),e.emissiveIntensity!==void 0&&(a.emissiveIntensity=e.emissiveIntensity),e.envIntensity!==void 0&&(a.envMapIntensity=e.envIntensity),e.opacity!==void 0&&(a.opacity=e.opacity,a.transparent=e.opacity<1,a.depthWrite=e.opacity>=1),e.clearcoat!==void 0||e.clearcoatRoughness!==void 0){let t=new E;t.copy(a),e.clearcoat!==void 0&&(t.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(t.clearcoatRoughness=e.clearcoatRoughness),a.dispose(),a=t}a.needsUpdate=!0,r.set(e,a),n.push(a)}return a});i.material=Array.isArray(i.material)?a:a[0]}),n}var Ji=(e,t=!1)=>e.traverse(e=>{e.isMesh&&(e.castShadow=!0,e.receiveShadow=t)});function Yi(e,t,n,r,i,a=[]){let[o,s]=(0,q.useState)({status:`idle`}),c=JSON.stringify(n),l=JSON.stringify(r),u=JSON.stringify(a),d=e?e.map(e=>e.id).join(`|`):``;return(0,q.useEffect)(()=>{if(!e){s({status:`idle`});return}let n=!0,r=null;return s({status:`loading`}),Promise.all(e.map(async e=>[e.id,await Vi(e.bytes)])).then(e=>{let a=e.map(([,e])=>e);if(i)for(let e of a)G(e.scene,`toon`);else for(let e of a)Gi(e.scene);if(!n){for(let e of a)Vr(e.scene,{materials:!i});return}let o=new Map(e),d=t===void 0?{scene:new ae,animations:[]}:o.get(t);if(!d){s({status:`error`,message:Bi});return}let f=new Map,p=JSON.parse(u),m=[];for(let e of JSON.parse(l)){let t=o.get(e.asset);if(!t)continue;let n=Pe(t.scene);Ji(n,!0),m.push(...qi(n,p.filter(t=>t.object===e.id))),f.set(e.id,n)}Ji(d.scene),m.push(...qi(d.scene,p.filter(e=>e.object===void 0)));let h=new w().setFromObject(d.scene),g=h.isEmpty()?new L:h.getCenter(new L),_=h.isEmpty()?1:h.getSize(new L).length(),v={gltf:d,fx:new Br(d.scene,JSON.parse(c),d.animations),box:h,center:g,diag:_,names:zr(d.scene),clipNames:d.animations.map(e=>e.name),instances:f};r={model:v,sources:a,own:m},s({status:`ready`,model:v})},e=>{n&&s({status:`error`,message:Bi})}),()=>{if(n=!1,r){r.model.fx.dispose();for(let e of r.own)e.dispose();for(let e of r.sources)Vr(e.scene,{materials:!i})}}},[d,e===null,t,c,l,i,u]),o}function Xi(e,t,n=[]){let[r,i]=(0,q.useState)(new Map),a=(0,q.useRef)([]),o=(0,q.useRef)(n);o.current=n;let s=(0,q.useRef)(new Map),c=(0,q.useRef)(new Set),l=(0,q.useRef)(!0),u=e.map(e=>e.id).join(`|`);return(0,q.useEffect)(()=>(l.current=!0,()=>{l.current=!1;for(let e of s.current.values())e.then(e=>Vr(e.scene,{materials:!t}),()=>{});s.current.clear(),c.current.clear();for(let e of a.current)e.dispose();a.current=[]}),[t]),(0,q.useEffect)(()=>{for(let n of e){if(c.current.has(n.id))continue;c.current.add(n.id);let e=s.current.get(n.asset);e||(e=Vi(n.bytes).then(e=>(t?G(e.scene,`toon`):Gi(e.scene),e)),s.current.set(n.asset,e)),e.then(e=>{if(!l.current)return;let t=Pe(e.scene);Ji(t,!0),a.current.push(...qi(t,o.current.filter(e=>e.object===n.id))),i(e=>new Map(e).set(n.id,t))},e=>{})}},[u,t]),r}var Zi=class extends D{constructor(e){super(e),this.type=V}parse(e){let t=function(e,t){switch(e){case 1:throw Error(`THREE.HDRLoader: Read Error: `+(t||``));case 2:throw Error(`THREE.HDRLoader: Write Error: `+(t||``));case 3:throw Error(`THREE.HDRLoader: Bad File Format: `+(t||``));default:case 4:throw Error(`THREE.HDRLoader: Memory Error: `+(t||``))}},n=function(e,t,n){t||=1024;let r=e.pos,i=-1,a=0,o=``,s=String.fromCharCode.apply(null,new Uint16Array(e.subarray(r,r+128)));for(;0>(i=s.indexOf(`
`))&&a<t&&r<e.byteLength;)o+=s,a+=s.length,r+=128,s=String.fromCharCode.apply(null,new Uint16Array(e.subarray(r,r+128)));return-1<i&&(!1!==n&&(e.pos+=a+i+1),o+s.slice(0,i))},r=function(e){let r=/^#\?(\S+)/,i=/^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,a=/^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,o=/^\s*FORMAT=(\S+)\s*$/,s=/^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,c={valid:0,string:``,comments:``,programtype:`RGBE`,format:``,gamma:1,exposure:1,width:0,height:0},l,u;for((e.pos>=e.byteLength||!(l=n(e)))&&t(1,`no header found`),(u=l.match(r))||t(3,`bad initial token`),c.valid|=1,c.programtype=u[1],c.string+=l+`
`;l=n(e),!1!==l;)if(c.string+=l+`
`,l.charAt(0)===`#`)c.comments+=l+`
`;else if((u=l.match(i))&&(c.gamma=parseFloat(u[1])),(u=l.match(a))&&(c.exposure=parseFloat(u[1])),(u=l.match(o))&&(c.valid|=2,c.format=u[1]),(u=l.match(s))&&(c.valid|=4,c.height=parseInt(u[1],10),c.width=parseInt(u[2],10)),c.valid&2&&c.valid&4)break;return c.valid&2||t(3,`missing format specifier`),c.valid&4||t(3,`missing image size specifier`),c},i=function(e,n,r){let i=n;if(i<8||i>32767||e[0]!==2||e[1]!==2||e[2]&128)return new Uint8Array(e);i!==(e[2]<<8|e[3])&&t(3,`wrong scanline width`);let a=new Uint8Array(4*n*r);a.length||t(4,`unable to allocate buffer space`);let o=0,s=0,c=4*i,l=new Uint8Array(4),u=new Uint8Array(c),d=r;for(;d>0&&s<e.byteLength;){s+4>e.byteLength&&t(1),l[0]=e[s++],l[1]=e[s++],l[2]=e[s++],l[3]=e[s++],(l[0]!=2||l[1]!=2||(l[2]<<8|l[3])!=i)&&t(3,`bad rgbe scanline format`);let n=0,r;for(;n<c&&s<e.byteLength;){r=e[s++];let i=r>128;if(i&&(r-=128),(r===0||n+r>c)&&t(3,`bad scanline data`),i){let t=e[s++];for(let e=0;e<r;e++)u[n++]=t}else u.set(e.subarray(s,s+r),n),n+=r,s+=r}let f=i;for(let e=0;e<f;e++){let t=0;a[o]=u[e+t],t+=i,a[o+1]=u[e+t],t+=i,a[o+2]=u[e+t],t+=i,a[o+3]=u[e+t],o+=4}d--}return a},a=function(e,t,n,r){let i=2**(e[t+3]-128)/255;n[r+0]=e[t+0]*i,n[r+1]=e[t+1]*i,n[r+2]=e[t+2]*i,n[r+3]=1},o=function(e,t,n,r){let i=2**(e[t+3]-128)/255;n[r+0]=v.toHalfFloat(Math.min(e[t+0]*i,65504)),n[r+1]=v.toHalfFloat(Math.min(e[t+1]*i,65504)),n[r+2]=v.toHalfFloat(Math.min(e[t+2]*i,65504)),n[r+3]=v.toHalfFloat(1)},s=new Uint8Array(e);s.pos=0;let c=r(s),l=c.width,u=c.height,d=i(s.subarray(s.pos),l,u),f,p,m;switch(this.type){case te:m=d.length/4;let e=new Float32Array(m*4);for(let t=0;t<m;t++)a(d,t*4,e,t*4);f=e,p=te;break;case V:m=d.length/4;let t=new Uint16Array(m*4);for(let e=0;e<m;e++)o(d,e*4,t,e*4);f=t,p=V;break;default:throw Error(`THREE.HDRLoader: Unsupported type: `+this.type)}return{width:l,height:u,data:f,header:c.string,gamma:c.gamma,exposure:c.exposure,type:p,colorSpace:me,minFilter:j,magFilter:j,generateMipmaps:!1,flipY:!0}}setDataType(e){return this.type=e,this}};function Qi(e,t,n,r,i){let a=Math.max(0,Math.min(n-1,Math.floor(r*n))),o=Math.max(a+1,Math.min(n,Math.ceil(i*n))),s=0,c=0,l=0,u=0;for(let n=a;n<o;n++)for(let r=0;r<t;r++){let i=(n*t+r)*4;s+=e[i],c+=e[i+1],l+=e[i+2],u++}return u===0?[255,255,255]:[Math.round(s/u),Math.round(c/u),Math.round(l/u)]}var $i=e=>`#${e.map(e=>Math.max(0,Math.min(255,e)).toString(16).padStart(2,`0`)).join(``)}`;async function ea(e,t,n){let r=await createImageBitmap(new Blob([e],t?{type:t}:{}),{imageOrientation:`flipY`}),i=new k(r);i.flipY=!1,i.colorSpace=n===`data`?``:be,i.generateMipmaps=!0,i.minFilter=ce,i.magFilter=j,n===`ground`||n===`data`?(i.wrapS=fe,i.wrapT=fe):(i.mapping=303,i.wrapS=fe,i.wrapT=d),i.needsUpdate=!0;let a=null,o=null;if(typeof document<`u`){let e=document.createElement(`canvas`);e.width=64,e.height=32;let t=e.getContext(`2d`);if(t){t.drawImage(r,0,0,e.width,e.height);let i=t.getImageData(0,0,e.width,e.height).data;n===`sky`?a=$i(Qi(i,e.width,e.height,.42,.56)):o=$i(Qi(i,e.width,e.height,0,1))}}return{texture:i,horizon:a,average:o}}function ta(e,t,n){let[r,i]=(0,q.useState)(null);return(0,q.useEffect)(()=>{if(!e){i(null);return}let r=!0,a=null;return ea(e,t,n).then(e=>{r?(a=e,i(e)):e.texture.dispose()},e=>{r&&i(null)}),()=>{if(r=!1,a){let e=a.texture.image;a.texture.dispose(),e?.close?.()}}},[e,t,n]),r}function na(e){let t=new Zi().parse(e),{width:n,height:r,data:i}=t,a=i instanceof Uint16Array,o=e=>a?v.fromHalfFloat(i[e]):i[e],s=0,c=0;for(let e=0;e<r>>1;e++)for(let t=0;t<n;t++){let r=.2126*o((e*n+t)*4)+.7152*o((e*n+t)*4+1)+.0722*o((e*n+t)*4+2);s=Math.max(s,r),c+=r}let l=Math.max(6,8*c/((r>>1)*n)),u=0,f=0,p=0;for(let e=0;e<r>>1;e++){let t=(.5-e/(r-1))*Math.PI,i=Math.cos(t);for(let r=0;r<n;r++){let a=(e*n+r)*4,c=.2126*o(a)+.7152*o(a+1)+.0722*o(a+2);if(!(c>=s*.5)||!(c>0))continue;let l=(r/(n-1)-.5)*2*Math.PI,d=c*i;u+=d*Math.cos(t)*Math.cos(l),f+=d*Math.sin(t),p+=d*Math.cos(t)*Math.sin(l)}}let m=Math.hypot(u,f,p)||1,h={azimuth:Math.atan2(u,p)*180/Math.PI,elevation:Math.max(8,Math.min(90,Math.asin(Math.max(-1,Math.min(1,f/m)))*180/Math.PI))},g=0,_=0,y=0,b=0;for(let e=Math.floor(r*.45);e<=Math.ceil(r*.55);e++)for(let t=0;t<n;t++){let r=(e*n+t)*4;g+=o(r),_+=o(r+1),y+=o(r+2),b++}let x=e=>Math.round(255*Math.min(1,Math.max(0,e/b/(1+e/b)))**(1/2.2)),S=`#${[x(g),x(_),x(y)].map(e=>e.toString(16).padStart(2,`0`)).join(``)}`,C=e=>{let i=new we(e,n,r,se,t.type,303,d,d,j,j,1);return i.colorSpace=me,i.generateMipmaps=!1,i.flipY=!0,i.needsUpdate=!0,i},w=a?new Uint16Array(i.length):new Float32Array(i.length);for(let e=0;e<i.length;e+=4){let t=o(e),n=o(e+1),r=o(e+2),s=.2126*t+.7152*n+.0722*r,c=s>l?l/s:1;if(a){let a=w;a[e]=v.toHalfFloat(t*c),a[e+1]=v.toHalfFloat(n*c),a[e+2]=v.toHalfFloat(r*c),a[e+3]=i[e+3]}else{let a=w;a[e]=t*c,a[e+1]=n*c,a[e+2]=r*c,a[e+3]=i[e+3]}}return{texture:C(i),light:C(w),sun:h,horizon:S}}function ra(e){let[t,n]=(0,q.useState)(null);return(0,q.useEffect)(()=>{if(!e){n(null);return}let t=null;try{t=na(e)}catch{}return n(t),()=>{t?.texture.dispose(),t?.light.dispose()}},[e]),t}var ia=()=>typeof window<`u`&&typeof window.matchMedia==`function`?window.matchMedia(`(prefers-reduced-motion: reduce)`):null;function aa(){return(0,q.useSyncExternalStore)(e=>{let t=ia();return t?.addEventListener(`change`,e),()=>t?.removeEventListener(`change`,e)},()=>ia()?.matches??!1,()=>!1)}var oa=null;function sa(){if(oa!==null)return oa;try{let e=document.createElement(`canvas`),t=e.getContext(`webgl2`)||e.getContext(`webgl`);oa=!!t,t?.getExtension(`WEBGL_lose_context`)?.loseContext()}catch{oa=!1}return oa}var ca=class extends q.Component{state={failed:!1};static getDerivedStateFromError(){return{failed:!0}}componentDidCatch(e){this.props.onError()}render(){return this.state.failed?null:this.props.children}},la={nowebgl:`This device cannot draw the 3D picture here. The explanation below says what it would show.`,lost:`The 3D picture stopped, probably because the graphics card was reset. Reload the lesson to see it again.`,crashed:`The 3D picture could not be drawn on this device. The explanation below says what it would show.`,loading:`Loading the 3D model…`,noView:`This simulation has no 3D picture.`},ua=[],da={};function fa(e){return e.spec.view3d?(0,J.jsx)(ma,{...e,view:e.spec.view3d}):(0,J.jsx)(`p`,{className:`s3-fallback-msg`,children:la.noView})}var pa={left:0,right:0,top:0,bottom:0};function ma({spec:e,run:t,live:n=null,knobs:r,time:d,markers:f,reducedMotion:p,className:m,tourIndex:h,onTourIndex:g,restyle:_=!1,float:v=!1,pad:y=pa,toolbarHost:b=null,view:x}){let S=aa()||p===!0,C=(0,q.useId)(),w=`${C}-tour-open`,T=`${C}-tour`,[E,D]=(0,q.useState)(null),O=Kr(x,h===void 0?E:h),k=(0,q.useMemo)(()=>qr(x,O),[x,O]),[ee,A]=(0,q.useState)(0),[j,te]=(0,q.useState)(0),[M,ne]=(0,q.useState)({index:0,nonce:0,instant:!0,byUser:!1}),re=(0,q.useCallback)((e,t=!1,n=!1,r=!0)=>{A(e),te(e),ne(i=>({index:e,nonce:i.nonce+1,instant:t,fixed:n,byUser:r}))},[]),ie=(0,q.useCallback)((e,t)=>re(e,t,Object.keys(x.cameras[e]?.set??{}).length>0),[re,x]),N=(0,q.useMemo)(()=>Xr(x,j),[x,j]),ae=(0,q.useRef)({nonce:-1,values:{}});ae.current.nonce!==M.nonce&&(ae.current={nonce:M.nonce,values:Object.fromEntries(Object.keys(N?.set??{}).map(e=>[e,r[e]]))});let[P,oe]=(0,q.useState)(-1),se=Zr(N,ae.current.values,r);(0,q.useEffect)(()=>{se&&O===null&&oe(M.nonce)},[se,M.nonce]);let ce=Qr(N,{byUser:M.byUser!==!1,taken:ae.current.values,knobs:r,letGo:P===M.nonce}),F=(0,q.useMemo)(()=>k?Jr(k):ce?N:null,[k,ce,N]),le=F?.clean===!0,I=(0,q.useRef)(0),L=(0,q.useRef)(!1);(0,q.useEffect)(()=>{!k&&!L.current&&(I.current=j)},[j,k]),(0,q.useEffect)(()=>{k?L.current=!0:L.current&&(L.current=!1,I.current!==null&&ie(I.current,S))},[k===null]);let ue=(0,q.useCallback)(e=>{h===void 0&&D(e),g?.(e)},[h,g]),de=e=>void requestAnimationFrame(()=>document.getElementById(e)?.focus({preventScroll:!0})),R=()=>{ue(0),de(T)},fe=()=>{ue(null),de(w)},pe=k?.stop.figure,me=pe?e.assets?.models.find(e=>e.id===pe.asset):void 0,z=me?Ge.get(me.sha256):void 0,B=$e(z?.status===`ready`?z.bytes:null,z?.status===`ready`?z.mime:void 0),[he,ge]=(0,q.useState)(new Set),_e=e.model.state.length>0,ve=t?Math.min(Math.max(d??t.T,0),t.T):0,V=(0,q.useMemo)(()=>a(e,r,t,ve),[e,t,r,ve]),ye=F?.set??da,H=(0,q.useMemo)(()=>{if(Object.keys(ye).length===0)return V;try{return o(e,i(e,r,ye),ve)}catch{return V}},[e,r,V,F?.key,_e,ve]),be=(0,q.useMemo)(()=>new Set(F?.objects??[]),[F]),U=(0,q.useMemo)(()=>c(x,H,be),[x,H,be]),xe=x.asset===void 0?void 0:e.assets?.models.find(e=>e.id===x.asset),Se=xe?.name??x.asset??e.title,Ce=(0,q.useMemo)(()=>u(e,x,U.objects,k?[k.index,k.index+1]:x.tour.length>0?[0]:[],U.scene),[e,x,U.objects,U.scene,k?.index]),we=Ce.all.map(e=>e.sha256).join(`|`);(0,q.useEffect)(()=>{Ge.want(Ce.all.map(e=>({id:e.id,sha256:e.sha256,kind:e.kind,...e.name?{name:e.name}:{}})))},[we]),(0,q.useSyncExternalStore)(Ge.subscribe,()=>Ge.version,()=>0);let Te=xe?Ge.get(xe.sha256):void 0,Ee=Te?.status===`error`?Te:void 0,De=Te?.status===`ready`?Te.bytes:null,Oe=(0,q.useMemo)(()=>x.parts.map(e=>({id:e.id,match:e.match})),[x]),ke=sa(),Ae=Yi((0,q.useMemo)(()=>ke?x.asset===void 0?[]:xe&&De?[{id:xe.id,bytes:De}]:null:null,[ke,x.asset,xe,De]),x.asset,Oe,ua,_,x.materials),W=Ae.status===`ready`?Ae.model:null,je=new Set(U.objects.map(e=>e.id)),Me=Xi(x.objects.flatMap(t=>{if(!t.tourOnly&&!je.has(t.id))return[];let n=e.assets?.models.find(e=>e.id===t.asset),r=n?Ge.get(n.sha256):void 0;return r?.status===`ready`?[{id:t.id,asset:t.asset,bytes:r.bytes}]:[]}),_,x.materials),G=U.scene>=0?x.scenes[U.scene]:void 0,Ne=t=>{let n=t?e.assets?.models.find(e=>e.id===t):void 0,r=n?Ge.get(n.sha256):void 0;return r?.status===`ready`?{bytes:r.bytes,mime:r.mime}:null},Pe=Ne(G?.ground?.texture),K=Ne(G?.sky),Fe=ra(Ne(G?.environment)?.bytes??null),Ie=ta(Pe?.bytes??null,Pe?.mime,`ground`),Le=ta(K?.bytes??null,K?.mime,`sky`),Re=Ne(G?.ground?.normal),ze=Ne(G?.ground?.rough),Be=Ne(G?.ground?.ao),Ve=ta(Re?.bytes??null,Re?.mime,`data`),He=ta(ze?.bytes??null,ze?.mime,`data`),Ue=ta(Be?.bytes??null,Be?.mime,`data`),We=(0,q.useMemo)(()=>Ie&&G?.ground?{texture:Ie.texture,repeat:G.ground.repeat,tile:G.ground.tile,grid:G.ground.grid,roughness:G.ground.roughness,average:Ie.average,normal:Ve?.texture??null,rough:He?.texture??null,ao:Ue?.texture??null,normalScale:G.ground.normalScale}:null,[Ie,Ve,He,Ue,G?.ground]),Ke=(0,q.useMemo)(()=>new Map([...W?.instances??[],...Me]),[W,Me]),qe=s(Ce.scene,e=>Ge.get(e.sha256),x.asset),Je=(0,q.useMemo)(()=>le?null:H===V?U.inset:c(x,V).inset,[le,H,V,U.inset,x]),Ye=(0,q.useMemo)(()=>_e?Li(x,t,ve):[],[x,t,_e,ve]),Xe=x.scenes.length>0||x.objects.length>0,Qe=(0,q.useMemo)(()=>{if(!Xe)return null;let e=_e?Ri(x,t):null,n=Math.max(...x.cameras.map(e=>Math.hypot(e.position[0]-e.target[0],e.position[1]-e.target[1],e.position[2]-e.target[2])),1);return e?{centre:e.centre,extent:Math.max(e.extent,n*2)}:{centre:[0,0,0],extent:n*4}},[Xe,_e,x,t]),nt=x.scenes.length>0?jt[x.scenes[Math.max(0,U.scene)].theme]:null,it=nt?nt.backdrop:x.background,at=(0,q.useMemo)(()=>zi(f),[f]),ot=(0,q.useMemo)(()=>F&&F.rays===null?[]:U.rays,[F,U.rays]),st=(0,q.useMemo)(()=>{let e=new Set(U.markers.filter(e=>e.shape===`card`&&e.part).map(e=>e.part)),t=ti(F,e).map(e=>{let t=x.parts.find(t=>t.id===e);return{id:`name-${e}`,label:t?.label??e,colour:t?.glow?.colour??`primary`,shape:`name`,at:[0,0,0],part:e,value:null,unit:void 0,digits:void 0}});return le?t:[...U.markers,...at.map(e=>({id:`mark-${e.id}`,label:e.label,colour:e.colour,shape:`card`,at:[(e.from+e.to)/2,.15,0],part:void 0,value:null,unit:void 0,digits:void 0})),...t]},[U.markers,at,F,le,x.parts]);(0,q.useEffect)(()=>(U.problems,void 0),[U.problems]);let ct=x.objects.every(e=>e.tourOnly?Ke.has(e.id):!je.has(e.id)||Ke.has(e.id));(0,q.useEffect)(()=>{W&&et(e,ct?[...W.names,...[...Ke.values()].flatMap(e=>zr(e))]:void 0,W.clipNames)},[W,e,ct]);let[lt,ut]=(0,q.useState)(null),dt=lt?x.parts.find(e=>e.id===lt):void 0,ft=(0,q.useMemo)(()=>{let e=ni(U.parts,F);return lt?e.map(e=>e.id===lt?{...e,glow:{colour:e.glow?.colour??`primary`,amount:Math.max(e.glow?.amount??0,.55)}}:e):e},[U.parts,F,lt]),pt=(0,q.useCallback)(e=>ut(t=>e===t?null:e),[]),mt=(0,q.useMemo)(()=>x.cameras.map(rt),[x]),ht=(0,q.useMemo)(()=>x.cameras.map(e=>e.follow),[x]),gt=(0,q.useMemo)(()=>W?yt(Math.max(W.diag,Qe?.extent??0),mt):null,[W,mt,Qe]),_t=(0,q.useRef)(!0);(0,q.useEffect)(()=>{k&&k.camera>=0&&re(k.camera,_t.current,Object.keys(k.stop.set).length>0,!1),_t.current=!1},[k?.index]);let vt=(0,q.useCallback)(()=>A(null),[]),bt=ee===null?null:x.cameras[ee]?.label??null,[xt,St]=(0,q.useState)(``),Ct=(0,q.useRef)(`${k?.index??-1}|${ee}`);(0,q.useEffect)(()=>{let e=`${k?.index??-1}|${ee}`;e!==Ct.current&&(Ct.current=e,(ee!==null||k)&&St(Bt({tour:k,camera:bt})))},[k,ee,bt]);let wt=zt({model:Se,camera:bt,markers:st.map(e=>[l(e).title,l(e).value].filter(Boolean).join(` `)),rays:ot.map(e=>e.label??e.id),tour:k}),Tt=(0,q.useRef)(new Map),Et=(0,q.useRef)(null),[Dt,Ot]=(0,q.useState)(!0),kt=`${C}-hint`,At=(0,q.useRef)(null),[Ft,Rt]=(0,q.useState)(0);(0,q.useEffect)(()=>{let e=At.current,t=e?.parentElement;if(!e||!t)return Rt(0);let n=()=>{let n=t.getBoundingClientRect(),r=e.getBoundingClientRect();Rt(r.height/Math.max(1,n.height)<.45?0:Math.max(0,Math.round(n.right-r.left+10)))};n();let r=new ResizeObserver(n);return r.observe(e),r.observe(t),()=>r.disconnect()},[Je!==null]);let[Vt,Ht]=(0,q.useState)(null),Ut=ke?Ee?Ee.message:Ae.status===`error`?Ae.message:Vt?la[Vt]:la.loading:la.nowebgl,Jt=W!==null&&gt!==null&&Vt===null&&ke,Yt=!Jt&&(!ke||Ee!==void 0||Ae.status===`error`||Vt!==null),Xt=qe.loading?[]:[...new Set([...Ce.scene,...Ce.step.filter(e=>e.kind!==`image`)])].filter(e=>Ge.get(e.sha256)?.status===`ready`).map(e=>({kind:`model`,...Ge.get(e.sha256).credit??{title:e.name??e.id}})),Zt=Kt(Xt),Qt=qt(Xt),$t=typeof V.sharp==`number`&&Number.isFinite(V.sharp)?V.sharp:void 0,en=typeof location<`u`&&new URLSearchParams(location.search).has(`qa`),tn=(0,J.jsx)(Mt,{cameras:x.cameras,active:ee,onPick:e=>ie(e,S),onTurn:e=>Et.current?.({type:`rotate`,dir:e}),onZoom:e=>Et.current?.({type:`zoom`,factor:e}),onHome:()=>ie(0,S),labels:Dt,onLabels:Ot,hintId:kt,tourId:w,hasTour:x.tour.length>0,tourOpen:k!==null,onTour:R});return(0,J.jsx)(`div`,{className:`s3-wrap${m?` ${m}`:``}`,children:(0,J.jsxs)(`div`,{className:`s3`,"data-bg":it,"data-status":Jt?`ready`:Yt?`failed`:`loading`,"data-tour":Jt&&k?`open`:void 0,"data-qa":en?``:void 0,children:[(0,J.jsxs)(`div`,{className:`s3-view`,children:[Jt?(0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)(`div`,{className:`s3-canvas`,role:`img`,"aria-label":wt,children:(0,J.jsx)(ca,{onError:()=>Ht(`crashed`),children:(0,J.jsx)(Ni,{model:W,view:x,parts:ft,clips:U.clips,rays:ot,markers:st,objects:U.objects,instances:Ke,trails:Ye,follow:ht,look:nt,live:n,environment:Fe,ground:We,light:G?.light,sky:Le,world:Qe,marks:at,shown:F,partMatches:Oe,backdrop:it,reducedMotion:S,poses:mt,limits:gt,request:M,reserveRight:v?Math.max(0,Ft-y.right):Ft,pad:v?y:pa,onPick:pt,markerRefs:Tt,commands:Et,labels:Dt,onHome:()=>ie(0,S),onUserMove:vt,onLost:()=>Ht(`lost`)})})}),Dt?(0,J.jsx)(It,{markers:st,backdrop:it,refs:Tt}):null]}):(0,J.jsx)(Lt,{message:Ut,loading:!Yt,tour:Yt?x.tour:[]}),Je?(0,J.jsx)(fn,{boxRef:At,label:x.inset.label,blur:Je.blur,brightness:Je.brightness,colour:Je.colour,sharp:$t,reducedMotion:S}):null,Jt&&qe.text?(0,J.jsx)(`p`,{className:`s3-status`,role:`status`,"data-s3-avoid":``,"data-problem":qe.failed>0?``:void 0,children:qe.text}):null,Zt&&Jt?(0,J.jsxs)(`p`,{className:`s3-credit`,"data-s3-avoid":``,title:Qt===Zt?void 0:Qt,children:[Zt,Qt===Zt?null:(0,J.jsxs)(`span`,{className:`s3-sr`,children:[` Full credit: `,Qt]})]}):null]}),Jt&&dt?.text?(0,J.jsx)(Pt,{title:dt.label??dt.id,text:dt.text,onClose:()=>ut(null)}):null,Jt?v&&b?(0,tt.createPortal)(tn,b):tn:null,Jt&&k?(0,J.jsxs)(`div`,{className:`s3-side`,"data-s3-avoid":``,...v?{"data-hud":`left`}:{},children:[(0,J.jsx)(Nt,{focus:k,panelId:T,onPrev:()=>ue(k.index-1),onNext:()=>ue(k.index+1),onClose:fe}),pe&&!he.has(k.stop.id)?(0,J.jsx)(Ze,{title:k.stop.title,caption:pe.caption,alt:pe.alt,state:z?.status===`ready`&&B?`ready`:z?.status===`error`||z===void 0&&me===void 0?`failed`:`loading`,url:B,credit:z?.status===`ready`?Gt(z.credit,`Image`):``,creditFull:z?.status===`ready`?Wt(z.credit,`Image`):``,onHide:()=>{ge(e=>new Set(e).add(k.stop.id)),de(T)}}):null]}):null,(0,J.jsx)(`div`,{className:`s3-sr`,role:`status`,"aria-live":`polite`,children:xt})]})})}export{fa as ExplorerStage3D,fa as default,sa as webglAvailable};