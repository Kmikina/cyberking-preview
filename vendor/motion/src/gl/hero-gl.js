// Hero: the site's isometric lattice rises off the page into a construct-line
// fortress; the red/cyan mark rebuilds in 3D, then stands up as the fortress
// opens. Text-free. All state is a pure function of (intro, progress), so
// scrubbing in either direction is exact.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Object3D, Mesh, Points, Box3,
  BufferGeometry, Float32BufferAttribute, BoxGeometry, CylinderGeometry, ExtrudeGeometry,
  EdgesGeometry, Shape, Vector2, Vector3, Color, HalfFloatType, WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { lineMaterial as baseLineMaterial, addDrawAttrs, fatLines, plateMaterial, markMaterial, dustMaterial } from './materials.js';

// Every line material is tracked so resize() can feed it resolution + pixel ratio.
const LINE_MATS = new Set();
const lineMaterial = (o) => { const m = baseLineMaterial(o); LINE_MATS.add(m); return m; };
const Lines = (geo, mat) => fatLines(geo, mat);
import { MARK_PIECES, MARK_CENTER, parsePoly } from '../core/mark.js';
import { PALETTE } from '../core/palette.js';
import { defaultLayout } from '../core/layout.js';
export { defaultLayout };
import { addTicker, setTier, quality, onQuality } from '../core/governor.js';

gsap.registerPlugin(ScrollTrigger);

const S60 = Math.sin(Math.PI / 3);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

const MARK_S = 0.04;          // world units per mark SVG unit
const MARK_Y = 3.0;           // height of the mark plane at rest
const FOV = 30;
const TAN = Math.tan((FOV / 2) * Math.PI / 180) * 2;
const LATTICE_R = 22;
const RF = 7;                 // fortress footprint circumradius (equilateral, point toward viewer)

function latticeGeometry() {
  const pts = [];
  const N = Math.ceil(LATTICE_R / S60) + 2;
  const P = (i, j) => [(i + j / 2), 0, j * S60];
  const inR = (p) => Math.hypot(p[0], p[2]) <= LATTICE_R;
  for (let j = -N; j <= N; j++) for (let i = -N - Math.abs(j); i <= N + Math.abs(j); i++) {
    const a = P(i, j);
    if (!inR(a)) continue;
    for (const [di, dj] of [[1, 0], [0, 1], [-1, 1]]) {
      const b = P(i + di, j + dj);
      if (inR(b)) pts.push(...a, ...b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  // Draw outward from the fortress, with a little jitter so it reads as hand-drafted.
  return addDrawAttrs(g, (x, y, z, i) => Math.hypot(x, z) / LATTICE_R * 0.85 + ((i * 7919) % 97) / 97 * 0.15);
}

function segGeometry(segs, delayFn) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(segs.flat(2), 3));
  return addDrawAttrs(g, delayFn || ((x, y, z, i) => i / Math.max(1, segs.length - 1)));
}

function edgesOf(geo, delayFn) {
  const e = new EdgesGeometry(geo, 25);
  return addDrawAttrs(e.toNonIndexed ? e : e, delayFn || ((x, y) => clamp01(y)));
}

export function create(canvas, opts, info, hooks = {}) {
  // Deterministic render mode: no rAF loop, no adaptive tiers, fixed full quality.
  const R = opts.render ? { fps: 30, duration: 10, ...opts.render } : null;
  const q = setTier(R ? (opts.tier || 'high') : (info.tier || 'mid'), { mobile: info.mobile, targetFps: opts.targetFps, adaptive: R ? false : opts.adaptive });
  const layoutFn = opts.layout || defaultLayout;
  const introDuration = opts.introDuration ?? 3.6;

  const renderer = new WebGLRenderer({ canvas, antialias: info.tier !== 'low', alpha: false, powerPreference: 'high-performance', stencil: false });
  const scene = new Scene();
  // scene.background (not setClearColor): converted per render target, so the
  // ink ground stays exact through the bloom composer's linear buffers.
  scene.background = new Color(PALETTE.ink);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 400);

  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity .6s cubic-bezier(.2,.7,0,1)';

  // ---------- Ground lattice ----------
  const latMat = lineMaterial({ color: '#a0aec4', opacity: 0.15, fadeR: LATTICE_R, span: 0.25, tip: 1.5, width: 1 });
  const lattice = Lines(latticeGeometry(), latMat);
  scene.add(lattice);

  // ---------- Fortress ----------
  const fortress = new Group();
  scene.add(fortress);
  const corners = [210, 330, 90].map((a) => new Vector3(Math.cos(a * Math.PI / 180) * RF, 0, Math.sin(a * Math.PI / 180) * RF));
  const plateMat = plateMaterial();
  const edgeMat = lineMaterial({ color: '#a0aec4', opacity: 0.55, span: 0.5, tip: 2, width: 1.25 });
  const accentEdgeMat = lineMaterial({ color: PALETTE.cyan, intensity: 2.2, opacity: 0.85, span: 0.5, tip: 1, width: 1.5 });
  const walls = []; const bastions = []; const tiers = [];

  // Outer wall: 3 plates per side, gapped like the mark's pieces.
  for (let s = 0; s < 3; s++) {
    const A = corners[s], B = corners[(s + 1) % 3];
    const e = B.clone().sub(A); const L = e.length(); e.normalize();
    const n = new Vector3(0, 1, 0).cross(e).negate(); // outward (footprint is CCW in x/z)
    const mid = A.clone().add(B).multiplyScalar(0.5);
    if (n.dot(mid) < 0) n.negate();
    const usable = L - 2.9, gap = 0.3, pl = (usable - 2 * gap) / 3;
    const heights = [1.45, 1.0, 1.45];
    for (let k = 0; k < 3; k++) {
      const along = -usable / 2 + pl / 2 + k * (pl + gap);
      const T = 0.45;
      const outer = new Group();
      outer.position.copy(mid).addScaledVector(e, along).addScaledVector(n, 0);
      outer.rotation.y = Math.atan2(n.x, n.z); // local z → outward n, local x along the edge
      const hinge = new Group(); outer.add(hinge);
      const geo = new BoxGeometry(pl, 1, T).translate(0, 0.5, -T / 2);
      const mesh = new Mesh(geo, plateMat);
      const edges = Lines(edgesOf(geo, (x, y) => 0.15 + (k / 3) * 0.3 + y * 0.4 + s * 0.05), edgeMat);
      mesh.add(edges);
      hinge.add(mesh);
      fortress.add(outer);
      walls.push({ outer, hinge, mesh, n, h: heights[k], base: outer.position.clone(), s, k });
    }
  }
  // Corner bastions: hex prisms.
  corners.forEach((c, i) => {
    const geo = new CylinderGeometry(1.1, 1.1, 1, 6).translate(0, 0.5, 0).toNonIndexed();
    geo.computeVertexNormals();
    const mesh = new Mesh(geo, plateMat);
    mesh.position.copy(c);
    mesh.add(Lines(edgesOf(geo, (x, y) => 0.05 + i * 0.08 + y * 0.5), i === 2 ? accentEdgeMat : edgeMat));
    fortress.add(mesh);
    bastions.push({ mesh, base: c.clone(), dir: c.clone().normalize() });
  });
  // Keep: three stepped triangular prisms (the mark's triangle, stacked).
  [4.2, 2.9, 1.7].forEach((r, k) => {
    const geo = new CylinderGeometry(r, r, 1, 3).translate(0, 0.5, 0).toNonIndexed();
    geo.computeVertexNormals();
    const mesh = new Mesh(geo, plateMat);
    mesh.add(Lines(edgesOf(geo, (x, y) => 0.3 + k * 0.15 + y * 0.3), k === 2 ? accentEdgeMat : edgeMat));
    fortress.add(mesh);
    tiers.push({ mesh, k });
  });

  // ---------- Construct guides ----------
  const markTri = [[52.38, 26.35], [229.98, 26.35], [141, 180.83]].map(([x, y]) => new Vector3((x - MARK_CENTER[0]) * MARK_S, MARK_Y, (y - MARK_CENTER[1]) * MARK_S));
  const ext = (a, b, len) => { const d = b.clone().sub(a).normalize(); return [a.clone().addScaledVector(d, -len).toArray(), b.clone().addScaledVector(d, len).toArray()]; };
  // 1) the mark triangle's edges, extended (these are on the static poster too)
  const guideMat = lineMaterial({ color: '#a0aec4', opacity: 0.16, span: 0.6, tip: 0, width: 1 });
  guideMat.uniforms.uDraw.value = 1;
  const guides = Lines(segGeometry([ext(markTri[0], markTri[1], 30), ext(markTri[1], markTri[2], 30), ext(markTri[2], markTri[0], 30)], () => 0), guideMat);
  scene.add(guides);
  // 2) accent: corner verticals (cyan) + footprint plan offset (red) + convergence rays
  const vert = corners.map((c) => [[c.x, 0, c.z], [c.x, 6.5, c.z]]);
  const cyanMat = lineMaterial({ color: PALETTE.cyan, intensity: 2.0, opacity: 0.55, span: 0.5, tip: 1.5, width: 1.25 });
  const cyanLines = Lines(segGeometry(vert.concat(corners.map((c, i) => [[c.x, 2.2, c.z], markTri[i].toArray()]))), cyanMat);
  scene.add(cyanLines);
  const plan = corners.map((c) => c.clone().multiplyScalar(1.32));
  const redMat = lineMaterial({ color: PALETTE.red, intensity: 1.9, opacity: 0.5, span: 0.6, tip: 1.5, width: 1.25 });
  const redLines = Lines(segGeometry([0, 1, 2].map((i) => [plan[i].toArray(), plan[(i + 1) % 3].toArray()])), redMat);
  redLines.position.y = 0.01;
  scene.add(redLines);

  // ---------- The mark, extruded ----------
  const markRoot = new Group(); // positioned/rotated as a whole
  markRoot.rotation.order = 'YXZ';
  scene.add(markRoot);
  const markMats = { r: markMaterial(PALETTE.red), b: markMaterial(PALETTE.cyan) };
  const markEdgeMats = {
    r: lineMaterial({ color: PALETTE.red, intensity: 1.6, opacity: 0.9, span: 0.6, tip: 0.8, width: 1.5 }),
    b: lineMaterial({ color: PALETTE.cyan, intensity: 1.6, opacity: 0.9, span: 0.6, tip: 0.8, width: 1.5 }),
  };
  markEdgeMats.r.uniforms.uDraw.value = markEdgeMats.b.uniforms.uDraw.value = 1;
  const pieces = MARK_PIECES.map((pc, i) => {
    const poly = parsePoly(pc.d).map(([x, y]) => new Vector2((x - MARK_CENTER[0]) * MARK_S, -(y - MARK_CENTER[1]) * MARK_S));
    const geo = new ExtrudeGeometry(new Shape(poly), { depth: 0.32, bevelEnabled: false });
    geo.translate(0, 0, -0.32); // front face at z=0 so a flat (z-scaled) piece sits exactly on the plane
    const mesh = new Mesh(geo, markMats[pc.c]);
    mesh.add(Lines(edgesOf(geo, () => 0), markEdgeMats[pc.c]));
    const holder = new Group(); holder.add(mesh); markRoot.add(holder);
    return { holder, mesh, dx: pc.dx, dy: pc.dy, i };
  });

  // ---------- Dust ----------
  const DUST = 1400;
  const dpos = new Float32Array(DUST * 3), dseed = new Float32Array(DUST), dcol = new Float32Array(DUST * 3);
  const grey = new Color('#a0aec4'), cy = new Color(PALETTE.cyan).multiplyScalar(1.6), rd = new Color(PALETTE.red).multiplyScalar(1.4);
  for (let i = 0; i < DUST; i++) {
    const r = Math.sqrt(Math.random()) * 20, a = Math.random() * Math.PI * 2;
    dpos.set([Math.cos(a) * r, Math.random() * 12, Math.sin(a) * r], i * 3);
    dseed[i] = Math.random();
    const u = Math.random(); const c = u < 0.06 ? cy : u < 0.08 ? rd : grey;
    dcol.set([c.r * 0.55, c.g * 0.55, c.b * 0.55], i * 3);
  }
  const dgeo = new BufferGeometry();
  dgeo.setAttribute('position', new Float32BufferAttribute(dpos, 3));
  dgeo.setAttribute('aSeed', new Float32BufferAttribute(dseed, 1));
  dgeo.setAttribute('aCol', new Float32BufferAttribute(dcol, 3));
  const dustMat = dustMaterial();
  const dust = new Points(dgeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------- Post ----------
  let composer = null, bloomPass = null;
  function buildComposer() {
    if (composer) return;
    const rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: q.msaa || 0 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new Vector2(256, 256), 0.55, 0.35, 0.62);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }
  function dropComposer() {
    if (!composer) return;
    composer.passes.forEach((p) => p.dispose && p.dispose());
    composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
    composer = null; bloomPass = null;
  }

  // ---------- Layout / resize ----------
  let W = 1, H = 1, L = null, d0 = 20, d1 = 40;
  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || innerWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight || innerHeight;
    // Ignore small height-only changes (mobile URL bar) to avoid re-layout jank.
    if (w === W && Math.abs(h - H) < 120 && L) return;
    W = w; H = h;
    const q2 = quality();
    const dpr = R ? (R.width ? R.width / W : (R.pixelRatio || window.devicePixelRatio || 1)) : Math.min(window.devicePixelRatio || 1, q2.dprCap) * q2.heroScale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(W, H); bloomPass.resolution.set(W / 2, H / 2); }
    camera.aspect = W / H;
    L = layoutFn(W, H);
    latMat.uniforms.uFadeR.value = L.latticeR || LATTICE_R;
    guideMat.uniforms.uFadeR.value = L.guideR || 0;
    const pxPerWorld = L.markPx / (186 * MARK_S);
    d0 = (H / pxPerWorld) / TAN;
    d1 = Math.max(30, 18 / (L.frac * TAN * camera.aspect));
    dustMat.uniforms.uPx.value = dpr;
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    LINE_MATS.forEach((m) => { m.uniforms.uRes.value.set(bw / 2, bh / 2); m.uniforms.uPx.value = dpr * (opts.lineScale || 1); });
    dirty = true;
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  // ---------- State → scene ----------
  let intro = 0, progress = 0, target = 0, time = 0, dirty = true;
  const camTarget = new Vector3();

  function apply() {
    const i = intro, p = progress;
    const rise = eio(smooth(i, 0.08, 0.95));
    const ex = 0.35 * smooth(i, 0.35, 1) + 0.65 * smooth(p, 0, 0.45);
    const fill = 0.55 * smooth(i, 0.45, 1) + 0.45 * smooth(p, 0.05, 0.4);
    const open = smooth(p, 0.55, 1);
    const up = 0.5 * smooth(i, 0.45, 1) + 0.5 * smooth(p, 0.5, 0.95); // mark stands up: partly in the intro, fully on scroll
    const upS = smooth(p, 0.5, 0.95);
    const push = smooth(p, 0.4, 1);

    latMat.uniforms.uDraw.value = smooth(i, 0.0, 0.6);
    latMat.uniforms.uRing.value = 2 + open * 24;
    latMat.uniforms.uRingI.value = Math.sin(open * Math.PI) * 0.35;
    edgeMat.uniforms.uDraw.value = smooth(i, 0.2, 0.75);
    accentEdgeMat.uniforms.uDraw.value = smooth(i, 0.35, 0.85);
    cyanMat.uniforms.uDraw.value = smooth(i, 0.5, 1);
    redMat.uniforms.uDraw.value = smooth(i, 0.4, 0.9);
    cyanMat.uniforms.uOpacity.value = 0.55 * (1 - open * 0.6);
    plateMat.uniforms.uOpacity.value = fill * (1 - open * 0.25);
    guideMat.uniforms.uOpacity.value = 0.16 + 0.08 * rise;

    walls.forEach((w) => {
      const o = smooth(open, 0.05 * w.s + 0.08 * w.k, 0.6 + 0.05 * w.s + 0.08 * w.k);
      w.mesh.scale.y = Math.max(0.001, w.h * ex);
      w.hinge.rotation.x = o * 1.35;
      w.outer.position.copy(w.base).addScaledVector(w.n, o * 1.4);
    });
    bastions.forEach((b, k) => {
      const o = smooth(open, 0.1 * k, 0.7 + 0.1 * k);
      b.mesh.scale.y = Math.max(0.001, 2.2 * ex * (1 - 0.45 * o));
      b.mesh.position.copy(b.base).addScaledVector(b.dir, o * 2.6);
    });
    tiers.forEach((t) => {
      const hgt = 0.6 * ex;
      t.mesh.scale.y = Math.max(0.001, hgt);
      t.mesh.position.y = t.k * hgt + (t.k + 1) * 0.75 * open;
      t.mesh.rotation.y = (t.k + 1) * 0.35 * open;
    });

    // Mark: flat plan (= the poster) → extrudes in 3D → stands up and rises.
    const depthT = smooth(i, 0.3, 0.85);
    pieces.forEach((pc) => {
      const st = smooth(i, 0.28 + pc.i * 0.03, 0.62 + pc.i * 0.03);
      const lift = Math.sin(st * Math.PI) * 0.55;
      pc.holder.position.set(pc.dx * lift, -pc.dy * lift, lift * 1.2);
      pc.mesh.scale.z = Math.max(0.02, depthT);
    });
    markRoot.position.set(0, lerp(MARK_Y, 5.6, up), lerp(0, 1.2, upS));
    markRoot.rotation.x = -Math.PI / 2 + up * (Math.PI / 2 - 0.32);
    markRoot.scale.setScalar(lerp(1, 1.28, upS));

    dustMat.uniforms.uOpacity.value = smooth(i, 0.4, 1) * (0.8 + 0.4 * open);
    if (bloomPass) bloomPass.strength = 0.5 + 0.35 * open;

    // Camera: top-down on the page (poster) → rises to 3/4 → orbits & pushes in.
    const polar = lerp(0.02, 0.95, rise) + 0.24 * eio(clamp01(p));
    const az = lerp(0, -0.5, rise) + 0.92 * eio(clamp01(p));
    let dist = lerp(d0, d1, rise) * (1 - 0.42 * push);
    camTarget.set(0, lerp(MARK_Y, 1.1, rise) + 4.3 * upS, lerp(0, 0.6, upS));
    markRoot.rotation.y = az * smooth(up, 0, 0.5); // the standing mark turns to face the viewer
    let fx = lerp(L.focus0[0], L.focus1[0], rise), fy = lerp(L.focus0[1], L.focus1[1], rise);
    const place = () => {
      camera.position.set(
        camTarget.x + dist * Math.sin(polar) * Math.sin(az),
        camTarget.y + dist * Math.cos(polar),
        camTarget.z + dist * Math.sin(polar) * Math.cos(az));
      camera.lookAt(camTarget);
      camera.setViewOffset(W, H, -(fx - 0.5) * W, -(fy - 0.5) * H, W, H);
      camera.updateMatrixWorld();
    };
    place();
    // Framing fit: keep mark + fortress inside L.box for the whole timeline.
    if (L.box && opts.fit !== false) {
      collectFit(i);
      const B = L.box;
      for (let k = 0; k < 4; k++) {
        let bb = bbox();
        const s2 = Math.max((bb[2] - bb[0]) / (B[2] - B[0]), (bb[3] - bb[1]) / (B[3] - B[1]));
        if (s2 > 1.0005) { dist *= s2 * 1.01; place(); bb = bbox(); }
        const sx = bb[0] < B[0] ? B[0] - bb[0] : bb[2] > B[2] ? B[2] - bb[2] : 0;
        const sy = bb[1] < B[1] ? B[1] - bb[1] : bb[3] > B[3] ? B[3] - bb[3] : 0;
        if (Math.abs(sx) + Math.abs(sy) < 1e-4 && s2 <= 1.0005) break;
        fx += sx; fy += sy; place();
      }
      lastBBox = bbox();
      const n0 = FITN; FITN = markLocal.length; lastMarkBBox = bbox(); FITN = n0;
    }
  }

  // ---------- Framing helpers ----------
  const FIT = []; let FITN = 0; let lastBBox = null, lastMarkBBox = null;
  const _v = new Vector3(), _c = new Vector3();
  const markLocal = MARK_PIECES.flatMap((pc) => parsePoly(pc.d)).map(([x, y]) => new Vector3((x - MARK_CENTER[0]) * MARK_S, -(y - MARK_CENTER[1]) * MARK_S, 0));
  const boxCorners = (geo) => { geo.computeBoundingBox(); const b = geo.boundingBox; const out = []; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new Vector3(x, y, z)); return out; };
  const fortressParts = [...walls.map((w) => w.mesh), ...bastions.map((b) => b.mesh), ...tiers.map((t) => t.mesh)].map((m) => ({ m, pts: boxCorners(m.geometry) }));
  const vertTop = corners.map((c) => new Vector3(c.x, 6.5, c.z));
  function push3(v) { if (!FIT[FITN]) FIT[FITN] = new Vector3(); FIT[FITN++].copy(v); }
  function collectFit(i) {
    FITN = 0;
    scene.updateMatrixWorld();
    markLocal.forEach((p) => push3(_v.copy(p).applyMatrix4(markRoot.matrixWorld)));
    _c.set(0, MARK_Y, 0);
    // fortress / accents join the fit as they draw on (keeps the opening frame = poster)
    const vf = smooth(i, 0.15, 0.6), va = cyanMat.uniforms.uDraw.value, vr = redMat.uniforms.uDraw.value;
    if (vf > 0) fortressParts.forEach(({ m, pts }) => pts.forEach((p) => push3(_v.copy(p).applyMatrix4(m.matrixWorld).lerp(_c, 1 - vf))));
    if (va > 0) vertTop.forEach((p) => push3(_v.copy(p).lerp(_c, 1 - va)));
    if (vr > 0) plan.forEach((p) => push3(_v.copy(p).lerp(_c, 1 - vr)));
  }
  function bbox() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let k = 0; k < FITN; k++) {
      _v.copy(FIT[k]).project(camera);
      const x = (_v.x + 1) / 2, y = (1 - _v.y) / 2;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  }

  // ---------- Loop ----------
  let visible = true, paused = false, chapterActive = true, firstFrame = false, introStart = -1, frozen = false;
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: '10% 0px' });
  io.observe(canvas);

  const applyQuality = () => {
    if (quality().bloom) buildComposer(); else dropComposer();
    dust.geometry.setDrawRange(0, Math.floor(DUST * quality().particles));
    dust.visible = quality().particles > 0;
    W = 0; resize();
  };
  const offQ = onQuality(applyQuality);
  applyQuality();

  function frame(now, dt) {
    if (paused || !visible || !chapterActive) return false;
    if (!frozen) {
      if (introStart < 0) introStart = now;
      const ni = clamp01((now - introStart) / 1000 / introDuration);
      if (ni !== intro) { intro = ni; dirty = true; }
      const k = 1 - Math.exp(-dt * 7);
      const np = Math.abs(target - progress) < 1e-4 ? target : progress + (target - progress) * k;
      if (np !== progress) { progress = np; dirty = true; }
      time += dt;
      dustMat.uniforms.uTime.value = time;
    }
    // Static scene + no dust → skip redundant renders.
    if (!dirty && !dust.visible) return false;
    apply();
    dirty = false;
    if (composer) composer.render(); else renderer.render(scene, camera);
    if (!firstFrame) {
      firstFrame = true;
      requestAnimationFrame(() => {
        firstDrawn = true;
        if (!opts.hold || revealed) doReveal();
        opts.onFirstFrame && opts.onFirstFrame();
      });
    }
    return true;
  }
  // opts.hold: keep the live canvas invisible after its first frame until reveal()
  // (used by the video snippet: film plays, then crossfades to WebGL on first scroll).
  let firstDrawn = false, revealed = false, shown = false;
  function doReveal() {
    if (shown) return; shown = true;
    canvas.style.opacity = '1';
        if (opts.poster) {
          const el = opts.poster;
          const d = opts.hold ? 650 : 320;
          setTimeout(() => { el.style.transition = `opacity ${d}ms ease`; el.style.opacity = '0'; setTimeout(() => (el.style.visibility = 'hidden'), d + 20); }, opts.hold ? 0 : 600);
        }
  }
  resize();
  const offTick = R ? () => {} : addTicker(frame);

  // ---------- Scroll ----------
  let st = null;
  if (opts.scroll !== false && !R) {
    const trig = opts.trigger || canvas.closest('[data-chapter], section') || canvas.parentElement;
    st = ScrollTrigger.create({
      trigger: trig,
      start: opts.scrollStart || 'top top',
      end: opts.scrollEnd || 'bottom bottom',
      onUpdate: (self) => { target = self.progress; },
    });
    target = st.progress;
  }

  // ---------- Context loss → 2D fallback ----------
  const onLost = (e) => { e.preventDefault(); hooks.onContextLost && hooks.onContextLost(); };
  canvas.addEventListener('webglcontextlost', onLost, { once: true });

  // Loop timeline for render mode (u = t / duration, seamless at u = 1):
  //  0.00–0.38 intro: poster frame → lines draw, fortress rises, mark rebuilds
  //  0.38–0.76 scroll 0→1: extrude, orbit, push-in, fortress opens, mark stands up
  //  0.76–1.00 rewind to the poster frame (eased, zero velocity at both ends)
  function loopState(u) {
    u = ((u % 1) + 1) % 1;
    const ss = (x) => x * x * (3 - 2 * x);
    if (u < 0.38) return { i: clamp01(u / 0.38), p: 0 };
    if (u < 0.76) return { i: 1, p: ss((u - 0.38) / 0.38) };
    const r = 1 - ss((u - 0.76) / 0.24);
    return { i: r, p: r };
  }
  function renderFrame(t) {
    const dur = R ? R.duration : introDuration;
    const u = (t / dur) % 1;
    const st = loopState(u);
    intro = st.i; progress = target = st.p; frozen = true;
    dustMat.uniforms.uLoop.value = u;
    apply();
    if (composer) composer.render(); else renderer.render(scene, camera);
    if (!firstFrame) { firstFrame = true; canvas.style.transition = 'none'; canvas.style.opacity = '1'; if (opts.poster) opts.poster.style.visibility = 'hidden'; }
  }
  if (R) { frozen = true; W = 0; resize(); }

  const ctrl = {
    renderFrame,
    reveal() { revealed = true; if (firstDrawn) doReveal(); },
    get render() { return R ? { ...R, frames: Math.round(R.fps * R.duration) } : null; },
    // The hero renders only while its own chapter is active or it is on screen.
    setChapter(id) { chapterActive = id === (opts.chapter || 'top') || visible; dirty = true; },
    setProgress(p) { target = clamp01(+p || 0); },
    resize() { W = 0; resize(); },
    pause() { paused = true; },
    resume() { paused = false; dirty = true; },
    // QA only: freeze the timeline at an exact state (used for screenshots).
    seek({ intro: i, progress: p } = {}) {
      frozen = true;
      if (i != null) intro = i;
      if (p != null) progress = target = p;
      dirty = true;
    },
    unfreeze() { frozen = false; introStart = performance.now() - intro * introDuration * 1000; },
    get state() { return { intro, progress, tier: info.tier, quality: { ...quality() }, bbox: lastBBox && lastBBox.slice(), markBBox: lastMarkBBox && lastMarkBBox.slice() }; },
    destroy() {
      LINE_MATS.clear();
      offTick(); offQ(); ro.disconnect(); io.disconnect(); st && st.kill();
      canvas.removeEventListener('webglcontextlost', onLost);
      scene.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); });
      dropComposer();
      renderer.dispose();
      canvas.style.opacity = '0';
      if (opts.poster) { opts.poster.style.visibility = ''; opts.poster.style.opacity = '1'; }
    },
  };
  return ctrl;
}
