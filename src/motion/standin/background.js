/**
 * Living background: one full-screen fragment shader in raw WebGL (no three.js, ~4 KB).
 *
 * CONTRACT (shared with hero.js, so either can be swapped by a motion engineer):
 *   const ctl = init(canvas, opts)
 *     opts.dprCap        max device-pixel-ratio multiplier for the backing store (default 1)
 *     opts.onContextLost called once if the GL context is lost; caller swaps to the 2D fallback
 *   ctl.setChapter(id)   id ∈ "top" | "environment" | "challenge" | "company" | "capabilities" | "approach" | "commitment" | "contact"
 *   ctl.setProgress(p) / ctl.resize() / ctl.pause() / ctl.resume() / ctl.destroy()
 * Throws if WebGL is unavailable (caller falls back to lite2d.js).
 */

// Per-chapter presets. Each value is tweened, so the field morphs between chapters.
//   scale: lattice cell size   flow: warp strength   speed: drift speed
//   red: red seam amount        radial: converge-to-centre blend   rain: vertical data rain
//   scanDir: scan band direction (radians)   glow: overall intensity   hue: cyan↔red horizon
const PRESETS = {
  top:          { scale: 64, flow: 0.35, speed: 0.6, red: 0.05, radial: 0.0, rain: 0.0, scanDir: 1.571, glow: 0.9, hue: 0.0 },
  environment:  { scale: 44, flow: 0.15, speed: 0.4, red: 0.0, radial: 0.0, rain: 0.25, scanDir: 1.571, glow: 0.8, hue: 0.0 },
  challenge:    { scale: 56, flow: 0.7, speed: 0.9, red: 0.85, radial: 0.0, rain: 0.0, scanDir: 0.0, glow: 0.85, hue: 0.25 },
  company:      { scale: 70, flow: 0.25, speed: 0.5, red: 0.12, radial: 1.0, rain: 0.0, scanDir: 0.0, glow: 0.9, hue: 0.0 },
  capabilities: { scale: 38, flow: 0.2, speed: 1.0, red: 0.0, radial: 0.0, rain: 1.0, scanDir: 1.571, glow: 0.8, hue: 0.0 },
  approach:     { scale: 80, flow: 0.1, speed: 0.2, red: 0.0, radial: 0.0, rain: 0.0, scanDir: 1.571, glow: 0.35, hue: 0.0 },
  commitment:   { scale: 80, flow: 0.1, speed: 0.2, red: 0.0, radial: 0.0, rain: 0.0, scanDir: 1.571, glow: 0.35, hue: 0.0 },
  contact:      { scale: 58, flow: 0.45, speed: 0.6, red: 0.35, radial: 0.35, rain: 0.0, scanDir: 3.14, glow: 1.0, hue: 0.7 },
};
const KEYS = Object.keys(PRESETS.top);

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
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
}`;

export function init(canvas, opts = {}) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) throw new Error("no webgl");
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link failed");
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ["uRes", "uTime", "uScroll", ...KEYS.map((k) => "u" + k[0].toUpperCase() + k.slice(1))].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  const cur = { ...PRESETS.top }, target = { ...PRESETS.top };
  let raf = 0, running = true, lost = false, t0 = performance.now();
  const scale = Math.min(devicePixelRatio || 1, opts.dprCap ?? 1);

  function resize() {
    const w = Math.round(innerWidth * scale), h = Math.round(innerHeight * scale);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  function frame(now) {
    if (!running || lost) return;
    resize();
    for (const k of KEYS) cur[k] += (target[k] - cur[k]) * 0.035;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, (now - t0) / 1000);
    gl.uniform1f(U.uScroll, scrollY / Math.max(1, innerHeight));
    for (const k of KEYS) gl.uniform1f(U["u" + k[0].toUpperCase() + k.slice(1)], k === "scale" ? cur[k] * scale : cur[k]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }
  const onVis = () => (document.hidden ? ctl.pause() : ctl.resume());
  document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; cancelAnimationFrame(raf); opts.onContextLost && opts.onContextLost(); }, { once: true });

  const ctl = {
    setChapter(id) { Object.assign(target, PRESETS[id] || PRESETS.top); },
    setProgress(p) { /* page-level progress; the shader already reads scrollY */ },
    resize() { resize(); },
    pause() { running = false; cancelAnimationFrame(raf); },
    resume() { if (running || lost) return; running = true; raf = requestAnimationFrame(frame); },
    destroy() { ctl.pause(); document.removeEventListener("visibilitychange", onVis); const ext = gl.getExtension("WEBGL_lose_context"); ext && ext.loseContext(); },
  };
  raf = requestAnimationFrame(frame);
  return ctl;
}
