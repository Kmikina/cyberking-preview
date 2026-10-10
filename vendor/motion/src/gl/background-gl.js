// Background "wildcard": one persistent isometric lattice (the site's 30°/60°
// grid) rendered procedurally in a single full-screen shader. Each chapter
// morphs density, tilt, accent share, drift and pulse rate; small pulse events
// ripple from lattice nodes. Transparent canvas — the page ground shows through.
import { WebGLRenderer, Scene, OrthographicCamera, Mesh, BufferGeometry, Float32BufferAttribute, ShaderMaterial, Vector2, Vector4, Color } from 'three';
import { gsap } from 'gsap';
import { BG_PRESETS, LIGHT_CHAPTERS } from '../core/chapters.js';
import { PALETTE } from '../core/palette.js';
import { addTicker, setTier, quality, onQuality } from '../core/governor.js';

const NP = 4; // concurrent pulse slots

const FRAG = /* glsl */`
precision highp float;
uniform vec2 uRes;          // drawing-buffer px
uniform float uPx;          // drawing-buffer px per CSS px
uniform float uTime, uScroll;
uniform float uSpacing, uTilt, uRot, uAccent, uRed, uAlpha, uLight, uSpeed, uNodes;
uniform vec2 uDrift;
uniform vec3 uLine, uInk, uCyan, uRedC;
uniform vec4 uPulse[${NP}];  // xy = plane pos (CSS px), z = start time, w = strength
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
  for (int i = 0; i < ${NP}; i++) {
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
}`;

export function create(canvas, opts, info, hooks = {}) {
  setTier(info.tier || 'mid', { mobile: info.mobile, targetFps: opts.targetFps, adaptive: opts.adaptive });
  const presets = { ...BG_PRESETS, ...(opts.presets || {}) };
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geo.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const srgb = (hex) => { const c = new Color(); c.setStyle(hex, 'srgb-linear'); return c; }; // keep sRGB numbers untouched
  const P0 = presets[opts.initialChapter || 'top'] || presets.default;
  const u = {
    uRes: { value: new Vector2(1, 1) }, uPx: { value: 1 }, uTime: { value: 0 }, uScroll: { value: 0 },
    uSpacing: { value: P0.spacing }, uTilt: { value: P0.tilt }, uRot: { value: P0.rot }, uAccent: { value: P0.accent },
    uRed: { value: P0.red }, uAlpha: { value: P0.alpha }, uLight: { value: P0.light }, uSpeed: { value: P0.speed }, uNodes: { value: P0.nodes },
    uDrift: { value: new Vector2(...P0.drift) },
    uLine: { value: srgb('#a0aec4') }, uInk: { value: srgb(PALETTE.paperInk) },
    uCyan: { value: srgb(PALETTE.cyan) }, uRedC: { value: srgb(PALETTE.red) },
    uPulse: { value: Array.from({ length: NP }, () => new Vector4(0, 0, -99, 0)) },
  };
  const mat = new ShaderMaterial({
    uniforms: u, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAG,
  });
  const quad = new Mesh(geo, mat); quad.frustumCulled = false;
  scene.add(quad);

  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity .8s ease';

  let W = 0, H = 0;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === W && Math.abs(h - H) < 120 && W) return;
    W = w; H = h;
    const q = quality();
    const px = Math.min(window.devicePixelRatio || 1, q.dprCap) * q.bgScale;
    renderer.setPixelRatio(px);
    renderer.setSize(W, H, false);
    u.uRes.value.set(Math.round(W * px), Math.round(H * px));
    u.uPx.value = u.uRes.value.x / W;
    u.uSpacing.value = (presets[current] || presets.default).spacing * (q.bgSparse || 1);
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const offQ = onQuality(() => { W = 0; resize(); });

  // ---------- Chapters ----------
  let current = opts.initialChapter || 'top';
  let tween = null, slot = 0, nextPulse = 2;
  function pulseAt(x, y, strength = 1) {
    // snap to a lattice node so the ring starts on the grid
    const s = u.uSpacing.value, h = s * 0.8660254;
    const row = Math.round(y / h), col = Math.round(x / s - row * 0.5);
    u.uPulse.value[slot].set((col + row * 0.5) * s, row * h, u.uTime.value, strength);
    slot = (slot + 1) % NP;
  }
  function setChapter(id) {
    if (id === current && tween) return;
    current = id;
    const pr = presets[id] || presets.default;
    const sparse = quality().bgSparse || 1;
    tween && tween.kill();
    const dur = opts.morphDuration ?? 1.6;
    const target = { spacing: pr.spacing * sparse, tilt: pr.tilt, rot: pr.rot, accent: pr.accent, red: pr.red, alpha: pr.alpha, light: pr.light, speed: pr.speed, nodes: pr.nodes, dx: pr.drift[0], dy: pr.drift[1] };
    const from = { spacing: u.uSpacing.value, tilt: u.uTilt.value, rot: u.uRot.value, accent: u.uAccent.value, red: u.uRed.value, alpha: u.uAlpha.value, light: u.uLight.value, speed: u.uSpeed.value, nodes: u.uNodes.value, dx: u.uDrift.value.x, dy: u.uDrift.value.y };
    tween = gsap.to(from, {
      ...target, duration: dur, ease: 'power2.inOut',
      onUpdate: () => {
        u.uSpacing.value = from.spacing; u.uTilt.value = from.tilt; u.uRot.value = from.rot; u.uAccent.value = from.accent;
        u.uRed.value = from.red; u.uAlpha.value = from.alpha; u.uLight.value = from.light; u.uSpeed.value = from.speed;
        u.uNodes.value = from.nodes; u.uDrift.value.set(from.dx, from.dy);
      },
    });
    if (pr.alpha > 0) pulseAt(0, 0, 1.2); // chapter entry: one pulse from the centre node
  }

  // ---------- Loop ----------
  let paused = false, first = false, frozenT = null;
  function frame(now, dt) {
    if (paused || document.hidden) return false;
    const T = frozenT != null ? frozenT : (u.uTime.value + dt);
    u.uTime.value = T;
    u.uScroll.value = opts.scroll === false ? u.uScroll.value : window.scrollY;
    // random small pulse events, rate per chapter
    const pr = presets[current] || presets.default;
    if (frozenT == null && pr.pulse > 0 && T > nextPulse) {
      pulseAt((Math.random() - 0.5) * W * 0.9, (Math.random() - 0.3) * H * 0.9, 0.6 + Math.random() * 0.5);
      nextPulse = T + (10 / pr.pulse) * (0.5 + Math.random());
    }
    if (u.uAlpha.value <= 0.001 && first) return false; // nothing visible (e.g. hero chapter)
    renderer.render(scene, cam);
    if (!first) { first = true; requestAnimationFrame(() => (canvas.style.opacity = '1')); opts.onFirstFrame && opts.onFirstFrame(); }
    return true;
  }
  resize();
  setChapter(current); tween && tween.progress(1);
  const offTick = addTicker(frame);

  const onLost = (e) => { e.preventDefault(); hooks.onContextLost && hooks.onContextLost(); };
  canvas.addEventListener('webglcontextlost', onLost, { once: true });

  return {
    setChapter,
    setProgress(p) { if (opts.scroll === false) u.uScroll.value = p * (opts.scrollLength || document.documentElement.scrollHeight); },
    resize() { W = 0; resize(); },
    pause() { paused = true; }, resume() { paused = false; },
    pulse(x = 0, y = 0, s = 1) { pulseAt(x, y, s); },
    // QA only: freeze time and jump straight to a chapter preset.
    seek({ chapter, time } = {}) { if (chapter) { setChapter(chapter); tween && tween.progress(1); } if (time != null) frozenT = time; },
    get state() { return { chapter: current, tier: info.tier, quality: { ...quality() } }; },
    destroy() {
      offTick(); offQ(); ro.disconnect(); tween && tween.kill();
      canvas.removeEventListener('webglcontextlost', onLost);
      geo.dispose(); mat.dispose(); renderer.dispose();
      canvas.style.opacity = '0';
    },
  };
}
