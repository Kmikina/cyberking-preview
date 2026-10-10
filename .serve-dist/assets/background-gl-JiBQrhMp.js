import{t as e}from"./palette-AkhPYAyA.js";import{o as t}from"./controller-Ccu0qIRe.js";import{n}from"./gsap-RFlsMqEC.js";import{E as r,S as i,_ as a,a as o,c as s,l as c,p as l,v as u,w as d,x as f}from"./three-DUOMmWei.js";import{i as p,n as m,r as h,t as g}from"./governor-Bzl7zLMC.js";var _=4,v=`
precision highp float;
uniform vec2 uRes;          // drawing-buffer px
uniform float uPx;          // drawing-buffer px per CSS px
uniform float uTime, uScroll;
uniform float uSpacing, uTilt, uRot, uAccent, uRed, uAlpha, uLight, uSpeed, uNodes;
uniform vec2 uDrift;
uniform vec3 uLine, uInk, uCyan, uRedC;
uniform vec4 uPulse[${_}];  // xy = plane pos (CSS px), z = start time, w = strength
varying vec2 vUv;

float hash(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main(){
  vec2 frag = (vUv - 0.5) * uRes / uPx;             // CSS px, centred
  float F = uRes.y / uPx * 1.1;                      // focal length (CSS px)
  float t = radians(uTilt);
  vec3 ro = vec3(0.0, 0.0, F);
  vec3 rd = normalize(vec3(frag, -F));
  vec3 N = vec3(0.0, sin(t), cos(t));                // plane tilts away at the top
  float den = dot(rd, N);
  if (den >= -1e-4) { gl_FragColor = vec4(0.0); return; }
  float k = -dot(ro, N) / den;
  vec3 P = ro + rd * k;
  vec2 q = vec2(P.x, dot(P, vec3(0.0, cos(t), -sin(t))));
  float depth = k / F;                               // 1 at the screen plane
  float cr = cos(radians(uRot)), sr = sin(radians(uRot));
  q = mat2(cr, -sr, sr, cr) * q;
  vec2 qw = q;                                       // plane space before drift (pulses live here)
  q += uDrift * uTime + vec2(0.0, uScroll * 0.18);

  float h = uSpacing * 0.8660254;                    // row separation
  vec3 col = vec3(0.0); float a = 0.0;
  float lineAll = 0.0;
  for (int f = 0; f < 3; f++) {
    float ang = radians(float(f) * 60.0);
    vec2 n = vec2(-sin(ang), cos(ang));
    vec2 d = vec2(cos(ang), sin(ang));
    float c = dot(q, n) / h;
    float idx = floor(c + 0.5);
    float dist = abs(c - idx);
    float aa = fwidth(c);
    float m = 1.0 - smoothstep(0.0, aa * 1.2, dist);
    m *= 1.0 - smoothstep(0.35, 0.5, aa);            // fade lines that get too dense (horizon)
    lineAll = max(lineAll, m);
    float hs = hash(idx * 3.0 + float(f) * 17.0);
    if (hs < uAccent) {
      float along = dot(q, d) / (uSpacing * 9.0);
      float s = fract(along - uTime * uSpeed * (0.6 + hash(idx + 5.0)) + hash(idx * 1.7));
      float comet = smoothstep(0.82, 1.0, s) ;
      vec3 ac = hash(idx * 9.1 + float(f)) < uRed ? uRedC : uCyan;
      col = max(col, ac * m * (0.25 + 1.6 * comet));
      a = max(a, m * (0.18 + 0.75 * comet));
    }
  }
  // Nodes: brighten intersections a touch.
  float node = 0.0;
  {
    vec2 g = vec2(q.x / uSpacing - (q.y / h) * 0.5, q.y / h);
    vec2 cell = floor(g + 0.5);
    vec2 r = g - cell;
    vec2 pr = vec2((r.x + r.y * 0.5) * uSpacing, r.y * h);
    float px = fwidth(g.y) * h;
    node = (1.0 - smoothstep(px * 0.8, px * 2.2, length(pr))) * uNodes;
  }

  // Pulse rings from lattice nodes.
  float pulse = 0.0;
  for (int i = 0; i < ${_}; i++) {
    vec4 pl = uPulse[i];
    float age = uTime - pl.z;
    if (pl.w <= 0.0 || age < 0.0 || age > 3.0) continue;
    float R = age * uSpacing * 2.2;
    float dd = length(qw - pl.xy);
    float band = exp(-pow((dd - R) / (uSpacing * 0.5), 2.0)) * (1.0 - age / 3.0);
    pulse += band * pl.w;
  }

  vec3 base = mix(uLine, uInk, uLight);
  float baseA = mix(0.13, 0.11, uLight) * uAlpha;
  vec3 c = base * lineAll * baseA + base * node * baseA * 1.6;
  float alpha = lineAll * baseA + node * baseA * 1.6;
  c += col * uAlpha * 0.9; alpha += a * uAlpha * 0.9;
  c += uCyan * pulse * lineAll * 0.8 * uAlpha; alpha += pulse * lineAll * 0.55 * uAlpha;

  // Distance fog (tilted plane) + soft vignette.
  float fog = 1.0 - smoothstep(1.6, 5.0, depth);
  vec2 uv2 = vUv - 0.5;
  float vig = 1.0 - smoothstep(0.42, 0.85, length(uv2 * vec2(1.0, 1.15)));
  float m2 = fog * mix(1.0, vig, 0.65);
  gl_FragColor = vec4(c * m2, clamp(alpha * m2, 0.0, 1.0)); // premultiplied
}`;function y(y,b,x,S={}){p(x.tier||`mid`,{mobile:x.mobile,targetFps:b.targetFps,adaptive:b.adaptive});let C={...t,...b.presets||{}},w=new o({canvas:y,antialias:!1,alpha:!0,premultipliedAlpha:!0,depth:!1,stencil:!1,powerPreference:`high-performance`});w.setClearColor(0,0);let T=new f,E=new u(-1,1,1,-1,0,1),D=new s;D.setAttribute(`position`,new l([-1,-1,0,3,-1,0,-1,3,0],3)),D.setAttribute(`uv`,new l([0,0,2,0,0,2],2));let O=e=>{let t=new c;return t.setStyle(e,`srgb-linear`),t},k=C[b.initialChapter||`top`]||C.default,A={uRes:{value:new d(1,1)},uPx:{value:1},uTime:{value:0},uScroll:{value:0},uSpacing:{value:k.spacing},uTilt:{value:k.tilt},uRot:{value:k.rot},uAccent:{value:k.accent},uRed:{value:k.red},uAlpha:{value:k.alpha},uLight:{value:k.light},uSpeed:{value:k.speed},uNodes:{value:k.nodes},uDrift:{value:new d(...k.drift)},uLine:{value:O(`#a0aec4`)},uInk:{value:O(e.paperInk)},uCyan:{value:O(e.cyan)},uRedC:{value:O(e.red)},uPulse:{value:Array.from({length:_},()=>new r(0,0,-99,0))}},j=new i({uniforms:A,transparent:!0,depthTest:!1,depthWrite:!1,premultipliedAlpha:!0,vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:v}),M=new a(D,j);M.frustumCulled=!1,T.add(M),y.style.opacity=`0`,y.style.transition=`opacity .8s ease`;let N=0,P=0;function F(){let e=y.clientWidth||innerWidth,t=y.clientHeight||innerHeight;if(e===N&&Math.abs(t-P)<120&&N)return;N=e,P=t;let n=h(),r=Math.min(window.devicePixelRatio||1,n.dprCap)*n.bgScale;w.setPixelRatio(r),w.setSize(N,P,!1),A.uRes.value.set(Math.round(N*r),Math.round(P*r)),A.uPx.value=A.uRes.value.x/N,A.uSpacing.value=(C[R]||C.default).spacing*(n.bgSparse||1)}let I=new ResizeObserver(F);I.observe(y);let L=m(()=>{N=0,F()}),R=b.initialChapter||`top`,z=null,B=0,V=2;function H(e,t,n=1){let r=A.uSpacing.value,i=r*.8660254,a=Math.round(t/i),o=Math.round(e/r-a*.5);A.uPulse.value[B].set((o+a*.5)*r,a*i,A.uTime.value,n),B=(B+1)%_}function U(e){if(e===R&&z)return;R=e;let t=C[e]||C.default,r=h().bgSparse||1;z&&z.kill();let i=b.morphDuration??1.6,a={spacing:t.spacing*r,tilt:t.tilt,rot:t.rot,accent:t.accent,red:t.red,alpha:t.alpha,light:t.light,speed:t.speed,nodes:t.nodes,dx:t.drift[0],dy:t.drift[1]},o={spacing:A.uSpacing.value,tilt:A.uTilt.value,rot:A.uRot.value,accent:A.uAccent.value,red:A.uRed.value,alpha:A.uAlpha.value,light:A.uLight.value,speed:A.uSpeed.value,nodes:A.uNodes.value,dx:A.uDrift.value.x,dy:A.uDrift.value.y};z=n.to(o,{...a,duration:i,ease:`power2.inOut`,onUpdate:()=>{A.uSpacing.value=o.spacing,A.uTilt.value=o.tilt,A.uRot.value=o.rot,A.uAccent.value=o.accent,A.uRed.value=o.red,A.uAlpha.value=o.alpha,A.uLight.value=o.light,A.uSpeed.value=o.speed,A.uNodes.value=o.nodes,A.uDrift.value.set(o.dx,o.dy)}}),t.alpha>0&&H(0,0,1.2)}let W=!1,G=!1,K=null;function q(e,t){if(W||document.hidden)return!1;let n=K??A.uTime.value+t;A.uTime.value=n,A.uScroll.value=b.scroll===!1?A.uScroll.value:window.scrollY;let r=C[R]||C.default;return K==null&&r.pulse>0&&n>V&&(H((Math.random()-.5)*N*.9,(Math.random()-.3)*P*.9,.6+Math.random()*.5),V=n+10/r.pulse*(.5+Math.random())),A.uAlpha.value<=.001&&G?!1:(w.render(T,E),G||(G=!0,requestAnimationFrame(()=>y.style.opacity=`1`),b.onFirstFrame&&b.onFirstFrame()),!0)}F(),U(R),z&&z.progress(1);let J=g(q),Y=e=>{e.preventDefault(),S.onContextLost&&S.onContextLost()};return y.addEventListener(`webglcontextlost`,Y,{once:!0}),{setChapter:U,setProgress(e){b.scroll===!1&&(A.uScroll.value=e*(b.scrollLength||document.documentElement.scrollHeight))},resize(){N=0,F()},pause(){W=!0},resume(){W=!1},pulse(e=0,t=0,n=1){H(e,t,n)},seek({chapter:e,time:t}={}){e&&(U(e),z&&z.progress(1)),t!=null&&(K=t)},get state(){return{chapter:R,tier:x.tier,quality:{...h()}}},destroy(){J(),L(),I.disconnect(),z&&z.kill(),y.removeEventListener(`webglcontextlost`,Y),D.dispose(),j.dispose(),w.dispose(),y.style.opacity=`0`}}}export{y as create};