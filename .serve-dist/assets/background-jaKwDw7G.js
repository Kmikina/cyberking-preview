var e={top:{scale:64,flow:.35,speed:.6,red:.05,radial:0,rain:0,scanDir:1.571,glow:.9,hue:0},environment:{scale:44,flow:.15,speed:.4,red:0,radial:0,rain:.25,scanDir:1.571,glow:.8,hue:0},challenge:{scale:56,flow:.7,speed:.9,red:.85,radial:0,rain:0,scanDir:0,glow:.85,hue:.25},company:{scale:70,flow:.25,speed:.5,red:.12,radial:1,rain:0,scanDir:0,glow:.9,hue:0},capabilities:{scale:38,flow:.2,speed:1,red:0,radial:0,rain:1,scanDir:1.571,glow:.8,hue:0},approach:{scale:80,flow:.1,speed:.2,red:0,radial:0,rain:0,scanDir:1.571,glow:.35,hue:0},commitment:{scale:80,flow:.1,speed:.2,red:0,radial:0,rain:0,scanDir:1.571,glow:.35,hue:0},contact:{scale:58,flow:.45,speed:.6,red:.35,radial:.35,rain:0,scanDir:3.14,glow:1,hue:.7}},t=Object.keys(e.top),n=`attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`,r=`
precision highp float;
uniform vec2 uRes; uniform float uTime, uScroll;
uniform float uScale, uFlow, uSpeed, uRed, uRadial, uRain, uScanDir, uGlow, uHue;
const vec3 INK = vec3(0.027,0.035,0.051);
const vec3 CY = vec3(0.102,0.667,0.894);
const vec3 RD = vec3(0.914,0.157,0.188);
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
// distance to the three line families of an isometric (30/60) lattice, in cell units
vec3 isoLines(vec2 q){
  vec2 a = vec2(q.x*0.57735 + q.y, q.x*0.57735 - q.y);
  float l0 = abs(fract(q.y + 0.5) - 0.5);
  float l1 = abs(fract(a.x*0.5 + 0.5) - 0.5);
  float l2 = abs(fract(a.y*0.5 + 0.5) - 0.5);
  return vec3(l0,l1,l2);
}
void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 c = (frag - 0.5*uRes) / uRes.y;
  float t = uTime * uSpeed;

  // domain warp
  vec2 w = vec2(fbm(c*2.2 + t*0.05), fbm(c*2.2 - t*0.04 + 7.3)) - 0.5;
  vec2 p = frag + w * uFlow * 220.0;
  p.y += uScroll * 0.15 * uRes.y;  // parallax with page scroll

  // radial converge: blend cartesian lattice with polar lattice around centre
  vec2 pc = frag - 0.5*uRes;
  float ang = atan(pc.y, pc.x), rad = length(pc);
  vec2 polar = vec2(ang * 0.5 * uRes.y / 3.14159 * 1.2, rad - t*30.0);
  p = mix(p, polar + w*uFlow*120.0, uRadial*0.65);

  vec2 q = p / uScale;
  vec3 L = isoLines(q);
  float px = 1.0/uScale;
  float line = 0.0;
  line = max(line, 1.0 - smoothstep(0.0, px*1.4, L.x));
  line = max(line, 1.0 - smoothstep(0.0, px*1.4, L.y*0.866));
  line = max(line, 1.0 - smoothstep(0.0, px*1.4, L.z*0.866));

  // nodes (intersections), occasionally glinting
  float node = (1.0 - smoothstep(0.0, px*3.0, L.x)) * (1.0 - smoothstep(0.0, px*3.0, L.y*0.866));
  vec2 cell = floor(q*vec2(1.0,1.0));
  float glint = step(0.93, h21(cell + floor(t*0.6)));

  // scan band
  vec2 sd = vec2(cos(uScanDir), sin(uScanDir));
  float sp = dot(uv - 0.5, sd);
  float band = fract(sp*0.8 - uTime*0.06);
  float scan = smoothstep(0.0, 0.02, band) * (1.0 - smoothstep(0.02, 0.18, band));

  // red seams: fractures along lattice where noise crosses a threshold
  float n = fbm(q*0.35 + t*0.08);
  float seam = smoothstep(0.015, 0.0, abs(n - 0.52)) * line * uRed;

  // data rain
  float colW = uScale*0.5;
  float col = floor(frag.x / colW);
  float inCol = 1.0 - smoothstep(0.6, 1.6, abs(fract(frag.x / colW) - 0.5) * colW);
  float rs = h21(vec2(col, 3.1));
  float ry = fract(uv.y*0.6 + uTime*(0.15 + rs*0.35) + rs*10.0);
  float rain = step(0.86, rs) * inCol * smoothstep(0.0, 0.3, ry) * (1.0 - smoothstep(0.3, 0.315, ry)) * uRain;

  // vignette + slow breathing glow
  float vig = smoothstep(1.25, 0.15, length(c*vec2(0.9,1.1)));
  float breathe = 0.85 + 0.15*sin(uTime*0.4);
  float field = fbm(c*1.4 + t*0.03);

  vec3 tint = mix(CY, mix(CY, RD, 0.55), uHue * smoothstep(0.2, -0.6, c.y));
  vec3 col3 = INK;
  col3 += tint * line * (0.055 + 0.20*scan) * vig * uGlow * breathe * (0.6 + field);
  col3 += tint * node * (0.12 + 0.6*glint) * vig * uGlow;
  col3 += RD * seam * 0.55 * vig;
  col3 += CY * rain * 0.6 * vig;
  // horizon glow (contact)
  col3 += mix(CY, RD, 0.5+0.5*sin(c.x*2.0 + uTime*0.2)) * uHue * 0.06 * smoothstep(0.0, -0.7, c.y) * vig;
  gl_FragColor = vec4(col3, 1.0);
}`;function i(i,a={}){let o=i.getContext(`webgl`,{antialias:!1,alpha:!1,depth:!1,powerPreference:`low-power`,preserveDrawingBuffer:!1});if(!o)throw Error(`no webgl`);let s=(e,t)=>{let n=o.createShader(e);if(o.shaderSource(n,t),o.compileShader(n),!o.getShaderParameter(n,o.COMPILE_STATUS))throw Error(o.getShaderInfoLog(n));return n},c=o.createProgram();if(o.attachShader(c,s(o.VERTEX_SHADER,n)),o.attachShader(c,s(o.FRAGMENT_SHADER,r)),o.linkProgram(c),!o.getProgramParameter(c,o.LINK_STATUS))throw Error(`link failed`);o.useProgram(c);let l=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,l),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),o.STATIC_DRAW);let u=o.getAttribLocation(c,`p`);o.enableVertexAttribArray(u),o.vertexAttribPointer(u,2,o.FLOAT,!1,0,0);let d={};[`uRes`,`uTime`,`uScroll`,...t.map(e=>`u`+e[0].toUpperCase()+e.slice(1))].forEach(e=>d[e]=o.getUniformLocation(c,e));let f={...e.top},p={...e.top},m=0,h=!0,g=!1,_=performance.now(),v=Math.min(devicePixelRatio||1,a.dprCap??1);function y(){let e=Math.round(innerWidth*v),t=Math.round(innerHeight*v);(i.width!==e||i.height!==t)&&(i.width=e,i.height=t,o.viewport(0,0,e,t))}function b(e){if(h&&!g){y();for(let e of t)f[e]+=(p[e]-f[e])*.035;o.uniform2f(d.uRes,i.width,i.height),o.uniform1f(d.uTime,(e-_)/1e3),o.uniform1f(d.uScroll,scrollY/Math.max(1,innerHeight));for(let e of t)o.uniform1f(d[`u`+e[0].toUpperCase()+e.slice(1)],e===`scale`?f[e]*v:f[e]);o.drawArrays(o.TRIANGLES,0,3),m=requestAnimationFrame(b)}}let x=()=>document.hidden?S.pause():S.resume();document.addEventListener(`visibilitychange`,x),i.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),g=!0,cancelAnimationFrame(m),a.onContextLost&&a.onContextLost()},{once:!0});let S={setChapter(t){Object.assign(p,e[t]||e.top)},setProgress(e){},resize(){y()},pause(){h=!1,cancelAnimationFrame(m)},resume(){h||g||(h=!0,m=requestAnimationFrame(b))},destroy(){S.pause(),document.removeEventListener(`visibilitychange`,x);let e=o.getExtension(`WEBGL_lose_context`);e&&e.loseContext()}};return m=requestAnimationFrame(b),S}export{i as init};