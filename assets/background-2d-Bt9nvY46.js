import{t as e}from"./chapters-CVqCf1Ny.js";import{t}from"./palette-AkhPYAyA.js";import{n,t as r}from"./shared-AOrRgdO7.js";var i=`
.ckm-bg2d{inset:0;overflow:hidden;pointer-events:none;perspective:1100px;perspective-origin:50% 30%;
  -webkit-mask-image:radial-gradient(120% 90% at 50% 45%,#000 40%,transparent 100%);mask-image:radial-gradient(120% 90% at 50% 45%,#000 40%,transparent 100%)}
.ckm-bg2d__plane{position:absolute;inset:-60% -40%;transform-origin:50% 50%;
  transform:rotateX(var(--tilt,0deg)) rotate(var(--rot,0deg)) scale(var(--scale,1));
  transition:transform 1.6s cubic-bezier(.65,0,.35,1),opacity 1.6s ease;opacity:var(--a,0)}
.ckm-bg2d__ink,.ckm-bg2d__dark{position:absolute;inset:0;transition:opacity 1.6s ease}
.ckm-bg2d__ink{opacity:var(--light,0)}
.ckm-bg2d__dark{opacity:calc(1 - var(--light,0))}
.ckm-bg2d__acc{position:absolute;left:0;right:0;height:1px;opacity:var(--acc,0);transition:opacity 1.6s ease;
  background:linear-gradient(90deg,transparent,var(--c) 45%,var(--c) 55%,transparent)}
`;function a(a,o,s){r(`ckm-bg2d-css`,i);let c={...e,...o.presets||{}},l=getComputedStyle(a),u=document.createElement(`div`);u.className=`ckm-bg2d`,u.setAttribute(`aria-hidden`,`true`),u.style.position=l.position===`fixed`?`fixed`:`absolute`,u.style.zIndex=l.zIndex;let d=n(64,`#a0aec4`,.16),f=n(64,t.paperInk,.12),p=[[.38,t.cyan,0],[.55,t.red,60],[.62,t.cyan,-60]].map(([e,t,n])=>`<i class="ckm-bg2d__acc" style="top:${e*100}%;--c:${t};transform:rotate(${n}deg)"></i>`).join(``);u.innerHTML=`<div class="ckm-bg2d__plane">
    <div class="ckm-bg2d__dark" style="background-image:${d.url};background-size:${d.w}px ${d.h}px"></div>
    <div class="ckm-bg2d__ink" style="background-image:${f.url};background-size:${f.w}px ${f.h}px"></div>${p}</div>`,a.style.opacity=`0`,a.insertAdjacentElement(`afterend`,u);let m=null;function h(e){if(e===m)return;m=e;let t=c[e]||c.default,n=u.style;n.setProperty(`--tilt`,`${t.tilt}deg`),n.setProperty(`--rot`,`${t.rot}deg`),n.setProperty(`--scale`,(t.spacing/64).toFixed(3)),n.setProperty(`--a`,t.alpha.toFixed(3)),n.setProperty(`--light`,String(t.light)),n.setProperty(`--acc`,Math.min(.5,t.accent*6).toFixed(3))}return h(o.initialChapter||`top`),o.onFirstFrame&&requestAnimationFrame(()=>o.onFirstFrame()),{setChapter:h,setProgress(){},resize(){},pause(){},resume(){},seek({chapter:e}={}){e&&h(e)},get state(){return{mode:`2d`,chapter:m,reasons:s.reasons}},destroy(){u.remove()}}}export{a as create};