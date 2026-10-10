import{n as e,r as t,t as n}from"./mark-P3CkhnRU.js";import{t as r}from"./palette-AkhPYAyA.js";import{n as i,t as a}from"./gsap-RFlsMqEC.js";import{t as o}from"./layout-Cssh6mvN.js";import{C as s,D as c,S as l,T as u,_ as d,a as f,b as p,c as m,d as h,f as ee,g,h as te,i as ne,l as _,m as v,n as re,o as ie,p as y,r as ae,s as oe,t as se,u as ce,w as le,x as ue,y as de}from"./three-DUOMmWei.js";import{i as fe,n as pe,r as b,t as me}from"./governor-Bzl7zLMC.js";function x({color:e=`#a0aec4`,intensity:t=1,opacity:n=.3,fadeR:r=0,span:i=.35,tip:a=1.2}={}){return new l({transparent:!0,depthWrite:!1,uniforms:{uColor:{value:new _(e).multiplyScalar(t)},uOpacity:{value:n},uDraw:{value:0},uSpan:{value:i},uFadeR:{value:r},uTip:{value:a},uRing:{value:0},uRingI:{value:0},uRingColor:{value:new _(`#1aaae4`).multiplyScalar(1.8)}},vertexShader:`
      attribute float aT; attribute float aDelay;
      uniform float uDraw, uSpan, uFadeR;
      varying float vT, vLocal, vFade, vR;
      void main(){
        vT = aT;
        vLocal = clamp((uDraw - aDelay * (1.0 - uSpan)) / uSpan, 0.0, 1.0);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vR = length(wp.xz);
        vFade = uFadeR > 0.0 ? 1.0 - smoothstep(uFadeR * 0.15, uFadeR, vR) : 1.0;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,fragmentShader:`
      uniform vec3 uColor, uRingColor; uniform float uOpacity, uTip, uRing, uRingI;
      varying float vT, vLocal, vFade, vR;
      void main(){
        if (vLocal <= 0.0 || vT > vLocal) discard;
        float tip = vLocal < 1.0 ? smoothstep(vLocal - 0.2, vLocal, vT) * uTip : 0.0;
        float ring = uRingI * exp(-pow((vR - uRing) / 1.6, 2.0));
        vec3 c = uColor * (1.0 + tip) + uRingColor * ring;
        float a = (uOpacity + ring * 0.5) * vFade;
        if (a < 0.002) discard;
        gl_FragColor = vec4(c, min(a, 1.0));
        #include <colorspace_fragment>
      }`})}function S(e,t){let n=e.attributes.position,r=n.count,i=new Float32Array(r),a=new Float32Array(r);for(let e=0;e<r;e+=2){i[e]=0,i[e+1]=1;let r=(n.getX(e)+n.getX(e+1))/2,o=(n.getY(e)+n.getY(e+1))/2,s=(n.getZ(e)+n.getZ(e+1))/2,c=Math.min(1,Math.max(0,t(r,o,s,e/2)));a[e]=a[e+1]=c}return e.setAttribute(`aT`,new oe(i,1)),e.setAttribute(`aDelay`,new oe(a,1)),e}function he({top:e=`#161c28`,left:t=`#0c1018`,right:n=`#121825`,opacity:r=1}={}){return new l({transparent:!0,polygonOffset:!0,polygonOffsetFactor:1,polygonOffsetUnits:1,uniforms:{uTop:{value:new _(e)},uL:{value:new _(t)},uR:{value:new _(n)},uOpacity:{value:r}},vertexShader:`
      varying vec3 vN; varying float vY;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,fragmentShader:`
      uniform vec3 uTop, uL, uR; uniform float uOpacity;
      varying vec3 vN; varying float vY;
      void main(){
        vec3 n = normalize(vN);
        float k = clamp(dot(normalize(n.xz + 1e-4), normalize(vec2(0.55, 0.83))) * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = n.y > 0.5 ? uTop : mix(uL, uR, k);
        c *= n.y > 0.5 ? 1.0 : (0.75 + 0.25 * vY); // faint vertical gradient on walls
        gl_FragColor = vec4(c, uOpacity);
        #include <colorspace_fragment>
      }`})}function ge(e){return new l({transparent:!0,polygonOffset:!0,polygonOffsetFactor:1,polygonOffsetUnits:1,uniforms:{uColor:{value:new _(e)},uOpacity:{value:1}},vertexShader:`
      varying vec3 vN;
      void main(){ vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
      uniform vec3 uColor; uniform float uOpacity; varying vec3 vN;
      void main(){
        float face = step(0.5, abs(vN.z));
        vec3 c = uColor * mix(0.42 + 0.18 * abs(vN.x), 1.0, face);
        gl_FragColor = vec4(c, uOpacity);
        #include <colorspace_fragment>
      }`})}function _e(){return new l({transparent:!0,depthWrite:!1,blending:2,uniforms:{uTime:{value:0},uOpacity:{value:0},uPx:{value:1},uH:{value:12},uLoop:{value:-1}},vertexShader:`
      attribute float aSeed; attribute vec3 aCol;
      uniform float uTime, uPx, uH, uLoop;
      varying vec3 vCol; varying float vA;
      void main(){
        vec3 p = position;
        if (uLoop >= 0.0) {
          // deterministic loop: whole-number cycles per loop → seamless at u = 1
          float k = 1.0 + floor(aSeed * 2.0);
          p.y = mod(p.y + uLoop * uH * k, uH);
          p.x += sin(6.2831853 * uLoop * k + aSeed * 40.0) * 0.4;
        } else {
          p.y = mod(p.y + uTime * (0.08 + 0.12 * aSeed), uH);
          p.x += sin(uTime * 0.2 + aSeed * 40.0) * 0.4;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.8 + aSeed * 1.4) * uPx * 28.0 / -mv.z, 1.0, 3.5 * uPx);
        vCol = aCol;
        vA = smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(uH - 3.0, uH, p.y));
      }`,fragmentShader:`
      uniform float uOpacity; varying vec3 vCol; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.1, length(d)) * vA * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vCol, a);
        #include <colorspace_fragment>
      }`})}i.registerPlugin(a);var ve=Math.sin(Math.PI/3),C=e=>e<0?0:e>1?1:e,w=(e,t,n)=>{let r=C((e-t)/(n-t));return r*r*(3-2*r)},ye=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2,T=(e,t,n)=>e+(t-e)*n,E=.04,be=3,xe=30,Se=Math.tan(xe/2*Math.PI/180)*2,D=22,Ce=7;function we(){let e=[],t=Math.ceil(D/ve)+2,n=(e,t)=>[e+t/2,0,t*ve],r=e=>Math.hypot(e[0],e[2])<=D;for(let i=-t;i<=t;i++)for(let a=-t-Math.abs(i);a<=t+Math.abs(i);a++){let t=n(a,i);if(r(t))for(let[o,s]of[[1,0],[0,1],[-1,1]]){let c=n(a+o,i+s);r(c)&&e.push(...t,...c)}}let i=new m;return i.setAttribute(`position`,new y(e,3)),S(i,(e,t,n,r)=>Math.hypot(e,n)/D*.85+r*7919%97/97*.15)}function Te(e,t){let n=new m;return n.setAttribute(`position`,new y(e.flat(2),3)),S(n,t||((t,n,r,i)=>i/Math.max(1,e.length-1)))}function O(e,t){let n=new h(e,25);return S((n.toNonIndexed,n),t||((e,t)=>C(t)))}function Ee(i,l,h,oe={}){let S=l.render?{fps:30,duration:10,...l.render}:null,ve=fe(S?l.tier||`high`:h.tier||`mid`,{mobile:h.mobile,targetFps:l.targetFps,adaptive:!S&&l.adaptive}),Ee=l.layout||o,De=l.introDuration??3.6,k=new f({canvas:i,antialias:h.tier!==`low`,alpha:!1,powerPreference:`high-performance`,stencil:!1}),A=new ue;A.background=new _(r.ink);let j=new de(xe,1,.1,400);i.style.opacity=`0`,i.style.transition=`opacity .6s cubic-bezier(.2,.7,0,1)`;let M=x({color:`#a0aec4`,opacity:.15,fadeR:D,span:.25,tip:1.5}),Oe=new g(we(),M);A.add(Oe);let N=new v;A.add(N);let P=[210,330,90].map(e=>new u(Math.cos(e*Math.PI/180)*Ce,0,Math.sin(e*Math.PI/180)*Ce)),ke=he(),F=x({color:`#a0aec4`,opacity:.55,span:.5,tip:2}),Ae=x({color:r.cyan,intensity:2.2,opacity:.85,span:.5,tip:1}),je=[],Me=[],Ne=[];for(let e=0;e<3;e++){let t=P[e],n=P[(e+1)%3],r=n.clone().sub(t),i=r.length();r.normalize();let a=new u(0,1,0).cross(r).negate(),o=t.clone().add(n).multiplyScalar(.5);a.dot(o)<0&&a.negate();let s=i-2.9,c=.3,l=(s-2*c)/3,f=[1.45,1,1.45];for(let t=0;t<3;t++){let n=-s/2+l/2+t*(l+c),i=new v;i.position.copy(o).addScaledVector(r,n).addScaledVector(a,0),i.rotation.y=Math.atan2(a.x,a.z);let u=new v;i.add(u);let p=new ie(l,1,.45).translate(0,.5,-.45/2),m=new d(p,ke),h=new g(O(p,(n,r)=>.15+t/3*.3+r*.4+e*.05),F);m.add(h),u.add(m),N.add(i),je.push({outer:i,hinge:u,mesh:m,n:a,h:f[t],base:i.position.clone(),s:e,k:t})}}P.forEach((e,t)=>{let n=new ce(1.1,1.1,1,6).translate(0,.5,0).toNonIndexed();n.computeVertexNormals();let r=new d(n,ke);r.position.copy(e),r.add(new g(O(n,(e,n)=>.05+t*.08+n*.5),t===2?Ae:F)),N.add(r),Me.push({mesh:r,base:e.clone(),dir:e.clone().normalize()})}),[4.2,2.9,1.7].forEach((e,t)=>{let n=new ce(e,e,1,3).translate(0,.5,0).toNonIndexed();n.computeVertexNormals();let r=new d(n,ke);r.add(new g(O(n,(e,n)=>.3+t*.15+n*.3),t===2?Ae:F)),N.add(r),Ne.push({mesh:r,k:t})});let I=[[52.38,26.35],[229.98,26.35],[141,180.83]].map(([e,t])=>new u((e-n[0])*E,be,(t-n[1])*E)),Pe=(e,t,n)=>{let r=t.clone().sub(e).normalize();return[e.clone().addScaledVector(r,-n).toArray(),t.clone().addScaledVector(r,n).toArray()]},Fe=x({color:`#a0aec4`,opacity:.16,span:.6,tip:0});Fe.uniforms.uDraw.value=1;let Ie=new g(Te([Pe(I[0],I[1],30),Pe(I[1],I[2],30),Pe(I[2],I[0],30)],()=>0),Fe);A.add(Ie);let Le=P.map(e=>[[e.x,0,e.z],[e.x,6.5,e.z]]),Re=x({color:r.cyan,intensity:2,opacity:.55,span:.5,tip:1.5}),ze=new g(Te(Le.concat(P.map((e,t)=>[[e.x,2.2,e.z],I[t].toArray()]))),Re);A.add(ze);let Be=P.map(e=>e.clone().multiplyScalar(1.32)),Ve=x({color:r.red,intensity:1.9,opacity:.5,span:.6,tip:1.5}),He=new g(Te([0,1,2].map(e=>[Be[e].toArray(),Be[(e+1)%3].toArray()])),Ve);He.position.y=.01,A.add(He);let L=new v;L.rotation.order=`YXZ`,A.add(L);let Ue={r:ge(r.red),b:ge(r.cyan)},We={r:x({color:r.red,intensity:1.6,opacity:.9,span:.6,tip:.8}),b:x({color:r.cyan,intensity:1.6,opacity:.9,span:.6,tip:.8})};We.r.uniforms.uDraw.value=We.b.uniforms.uDraw.value=1;let Ge=e.map((e,r)=>{let i=t(e.d).map(([e,t])=>new le((e-n[0])*E,-(t-n[1])*E)),a=new ee(new s(i),{depth:.32,bevelEnabled:!1});a.translate(0,0,-.32);let o=new d(a,Ue[e.c]);o.add(new g(O(a,()=>0),We[e.c]));let c=new v;return c.add(o),L.add(c),{holder:c,mesh:o,dx:e.dx,dy:e.dy,i:r}}),R=1400,Ke=new Float32Array(R*3),qe=new Float32Array(R),Je=new Float32Array(R*3),Ye=new _(`#a0aec4`),Xe=new _(r.cyan).multiplyScalar(1.6),Ze=new _(r.red).multiplyScalar(1.4);for(let e=0;e<R;e++){let t=Math.sqrt(Math.random())*20,n=Math.random()*Math.PI*2;Ke.set([Math.cos(n)*t,Math.random()*12,Math.sin(n)*t],e*3),qe[e]=Math.random();let r=Math.random(),i=r<.06?Xe:r<.08?Ze:Ye;Je.set([i.r*.55,i.g*.55,i.b*.55],e*3)}let z=new m;z.setAttribute(`position`,new y(Ke,3)),z.setAttribute(`aSeed`,new y(qe,1)),z.setAttribute(`aCol`,new y(Je,3));let B=_e(),V=new p(z,B);V.frustumCulled=!1,A.add(V);let H=null,U=null;function Qe(){if(H)return;let e=new c(1,1,{type:te,samples:ve.msaa||0});H=new ne(k,e),H.addPass(new ae(A,j)),U=new re(new le(256,256),.55,.35,.62),H.addPass(U),H.addPass(new se)}function $e(){H&&(H.passes.forEach(e=>e.dispose&&e.dispose()),H.renderTarget1.dispose(),H.renderTarget2.dispose(),H=null,U=null)}let W=1,G=1,K=null,et=20,tt=40;function q(){let e=i.clientWidth||i.parentElement.clientWidth||innerWidth,t=i.clientHeight||i.parentElement.clientHeight||innerHeight;if(e===W&&Math.abs(t-G)<120&&K)return;W=e,G=t;let n=b(),r=S?S.width?S.width/W:S.pixelRatio||window.devicePixelRatio||1:Math.min(window.devicePixelRatio||1,n.dprCap)*n.heroScale;k.setPixelRatio(r),k.setSize(W,G,!1),H&&(H.setPixelRatio(r),H.setSize(W,G),U.resolution.set(W/2,G/2)),j.aspect=W/G,K=Ee(W,G);let a=K.markPx/(186*E);et=G/a/Se,tt=Math.max(30,18/(K.frac*Se*j.aspect)),B.uniforms.uPx.value=r,Z=!0}let nt=new ResizeObserver(()=>q());nt.observe(i);let J=0,Y=0,X=0,rt=0,Z=!0,Q=new u;function it(){let e=J,t=Y,n=ye(w(e,.08,.95)),r=.35*w(e,.35,1)+.65*w(t,0,.45),i=.55*w(e,.45,1)+.45*w(t,.05,.4),a=w(t,.55,1),o=.5*w(e,.45,1)+.5*w(t,.5,.95),s=w(t,.5,.95),c=w(t,.4,1);M.uniforms.uDraw.value=w(e,0,.6),M.uniforms.uRing.value=2+a*24,M.uniforms.uRingI.value=Math.sin(a*Math.PI)*.9,F.uniforms.uDraw.value=w(e,.2,.75),Ae.uniforms.uDraw.value=w(e,.35,.85),Re.uniforms.uDraw.value=w(e,.5,1),Ve.uniforms.uDraw.value=w(e,.4,.9),Re.uniforms.uOpacity.value=.55*(1-a*.6),ke.uniforms.uOpacity.value=i*(1-a*.25),Fe.uniforms.uOpacity.value=.16+.08*n,je.forEach(e=>{let t=w(a,.05*e.s+.08*e.k,.6+.05*e.s+.08*e.k);e.mesh.scale.y=Math.max(.001,e.h*r),e.hinge.rotation.x=t*1.35,e.outer.position.copy(e.base).addScaledVector(e.n,t*1.4)}),Me.forEach((e,t)=>{let n=w(a,.1*t,.7+.1*t);e.mesh.scale.y=Math.max(.001,2.2*r*(1-.45*n)),e.mesh.position.copy(e.base).addScaledVector(e.dir,n*2.6)}),Ne.forEach(e=>{let t=.6*r;e.mesh.scale.y=Math.max(.001,t),e.mesh.position.y=e.k*t+(e.k+1)*.75*a,e.mesh.rotation.y=(e.k+1)*.35*a});let l=w(e,.3,.85);Ge.forEach(t=>{let n=w(e,.28+t.i*.03,.62+t.i*.03),r=Math.sin(n*Math.PI)*.55;t.holder.position.set(t.dx*r,-t.dy*r,r*1.2),t.mesh.scale.z=Math.max(.02,l)}),L.position.set(0,T(be,5.6,o),T(0,1.2,s)),L.rotation.x=-Math.PI/2+o*(Math.PI/2-.32),L.scale.setScalar(T(1,1.28,s)),B.uniforms.uOpacity.value=w(e,.4,1)*(.8+.4*a),U&&(U.strength=.5+.35*a);let u=T(.02,.95,n)+.24*ye(C(t)),d=T(0,-.5,n)+.92*ye(C(t)),f=T(et,tt,n)*(1-.42*c);Q.set(0,T(be,1.1,n)+4.3*s,T(0,.6,s)),j.position.set(Q.x+f*Math.sin(u)*Math.sin(d),Q.y+f*Math.cos(u),Q.z+f*Math.sin(u)*Math.cos(d)),j.lookAt(Q),L.rotation.y=d*w(o,0,.5);let p=T(K.focus0[0],K.focus1[0],n),m=T(K.focus0[1],K.focus1[1],n);j.setViewOffset(W,G,-(p-.5)*W,-(m-.5)*G,W,G)}let at=!0,ot=!1,st=!0,ct=!1,lt=-1,$=!1,ut=new IntersectionObserver(e=>{at=e[0].isIntersecting},{rootMargin:`10% 0px`});ut.observe(i);let dt=()=>{b().bloom?Qe():$e(),V.geometry.setDrawRange(0,Math.floor(R*b().particles)),V.visible=b().particles>0,W=0,q()},ft=pe(dt);dt();function pt(e,t){if(ot||!at||!st)return!1;if(!$){lt<0&&(lt=e);let n=C((e-lt)/1e3/De);n!==J&&(J=n,Z=!0);let r=1-Math.exp(-t*7),i=Math.abs(X-Y)<1e-4?X:Y+(X-Y)*r;i!==Y&&(Y=i,Z=!0),rt+=t,B.uniforms.uTime.value=rt}return!Z&&!V.visible?!1:(it(),Z=!1,H?H.render():k.render(A,j),ct||(ct=!0,requestAnimationFrame(()=>{if(i.style.opacity=`1`,l.poster){let e=l.poster;setTimeout(()=>{e.style.transition=`opacity .3s`,e.style.opacity=`0`,setTimeout(()=>e.style.visibility=`hidden`,320)},600)}l.onFirstFrame&&l.onFirstFrame()})),!0)}q();let mt=S?()=>{}:me(pt),ht=null;if(l.scroll!==!1&&!S){let e=l.trigger||i.closest(`[data-chapter], section`)||i.parentElement;ht=a.create({trigger:e,start:l.scrollStart||`top top`,end:l.scrollEnd||`bottom bottom`,onUpdate:e=>{X=e.progress}}),X=ht.progress}let gt=e=>{e.preventDefault(),oe.onContextLost&&oe.onContextLost()};i.addEventListener(`webglcontextlost`,gt,{once:!0});function _t(e){e=(e%1+1)%1;let t=e=>e*e*(3-2*e);if(e<.38)return{i:C(e/.38),p:0};if(e<.76)return{i:1,p:t((e-.38)/.38)};let n=1-t((e-.76)/.24);return{i:n,p:n}}function vt(e){let t=e/(S?S.duration:De)%1,n=_t(t);J=n.i,Y=X=n.p,$=!0,B.uniforms.uLoop.value=t,it(),H?H.render():k.render(A,j),ct||(ct=!0,i.style.transition=`none`,i.style.opacity=`1`,l.poster&&(l.poster.style.visibility=`hidden`))}return S&&($=!0,W=0,q()),{renderFrame:vt,get render(){return S?{...S,frames:Math.round(S.fps*S.duration)}:null},setChapter(e){st=e===(l.chapter||`top`)||at,Z=!0},setProgress(e){X=C(+e||0)},resize(){W=0,q()},pause(){ot=!0},resume(){ot=!1,Z=!0},seek({intro:e,progress:t}={}){$=!0,e!=null&&(J=e),t!=null&&(Y=X=t),Z=!0},unfreeze(){$=!1,lt=performance.now()-J*De*1e3},get state(){return{intro:J,progress:Y,tier:h.tier,quality:{...b()}}},destroy(){mt(),ft(),nt.disconnect(),ut.disconnect(),ht&&ht.kill(),i.removeEventListener(`webglcontextlost`,gt),A.traverse(e=>{e.geometry&&e.geometry.dispose(),e.material&&e.material.dispose&&e.material.dispose()}),$e(),k.dispose(),i.style.opacity=`0`,l.poster&&(l.poster.style.visibility=``,l.poster.style.opacity=`1`)}}}export{Ee as create,o as defaultLayout};