/**
 * Hero: "The Crown Lattice", a full-viewport three.js scene.
 * The isometric lattice is the ground. The real Cyber King mark is extruded into a crystalline citadel that
 * assembles along its own 30°/60° vectors, ringed by a crown of rising construct-line pillars, scan rings and
 * C·I·A shield pulses. Pointer parallax plus scroll lift.
 *
 * CONTRACT (a motion engineer can replace this file wholesale):
 *   const ctl = await init(canvas, opts)
 *     opts.dprCap         max devicePixelRatio (1.5 on mobile, 2 desktop)
 *     opts.quality        "high" (bloom, more instances) | "low"
 *     opts.onFirstFrame() called after the first frame is on screen → page cross-fades poster → canvas
 *     opts.onContextLost() called if the GL context is lost → page swaps to the 2D tier
 *     opts.onAnchors(pts)  optional; pts = [{x,y,visible}] ×3 screen-space C, I, A beacons (CSS px, canvas-relative)
 *   ctl.setChapter(id)    chapter id (see background.js). The hero runs only while "top" is near the viewport.
 *   ctl.setProgress(p)    0..1 scroll progress through the hero (camera lift / exploded view)
 *   ctl.resize()          re-measure the canvas (also handled internally by a ResizeObserver)
 *   ctl.pause() / ctl.resume() / ctl.destroy()
 */
import * as THREE from "three";

const RED = new THREE.Color("#e92830");
const CYAN = new THREE.Color("#1aaae4");
const INK = new THREE.Color("#07090d");

// The mark, verbatim from cyberking-mark.svg (viewBox 48 6 186 180). dx/dy = assembly vector from the original site.
const FACETS = [
  { c: "r", dx: -1, dy: -0.577, d: "135.53,10.35 194.13,10.35 108.15,59.99 108.15,125.4 77.85,72.92 77.85,43.65" },
  { c: "r", dx: 0, dy: -1, d: "110.85,130.08 110.85,62.59 172.3,27.09 201.22,43.29 140.15,78.13 140.15,180.83" },
  { c: "r", dx: 1, dy: -0.577, d: "172.85,62.33 201.15,45.99 201.15,78.12 172.85,127.13" },
  { c: "b", dx: -1, dy: 0, d: "52.38,26.35 103.62,26.35 78,41.15" },
  { c: "b", dx: -1, dy: 0.577, d: "52.74,29.44 76.15,42.86 76.15,69.98" },
  { c: "b", dx: 1, dy: 0, d: "175.84,26.35 229.98,26.35 203.41,42" },
  { c: "b", dx: 1, dy: 0.577, d: "228.8,30.23 203.85,44.57 203.85,73.44" },
  { c: "b", dx: 0, dy: 1, d: "142.85,179.1 142.85,79.53 170.15,63.77 170.15,131.81" },
];
const MC = [141, 95], MS = 1 / 55; // mark centre + scale (≈3.2 units wide)
const toLocal = (x, y) => new THREE.Vector2((x - MC[0]) * MS, -(y - MC[1]) * MS);
const TRI = [toLocal(52.4, 26.3), toLocal(230, 26.3), toLocal(141, 181)]; // outer triangle: C (top-left), I (top-right), A (bottom)
const GROUND_Y = -2.7;

const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

const ISO_GLSL = `
vec3 isoDist(vec2 q){
  vec2 a = vec2(q.x*0.57735 + q.y, q.x*0.57735 - q.y);
  return vec3(abs(fract(q.y+0.5)-0.5), abs(fract(a.x*0.5+0.5)-0.5)*0.866, abs(fract(a.y*0.5+0.5)-0.5)*0.866);
}
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
`;

export async function init(canvas, opts = {}) {
  const high = opts.quality !== "low";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !high, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, opts.dprCap || 1.5));
  renderer.setClearColor(INK, 1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(INK, 0.045);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);

  // Environment lighting for the facets (cheap, generated once)
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  const world = new THREE.Group();
  scene.add(world);
  const U = {
    uTime: { value: 0 }, uRing: { value: -10 }, uBoost: { value: 0 }, uRise: { value: 0 },
    uPointer: { value: new THREE.Vector2(99, 99) }, uLift: { value: 0 },
  };

  // ---------- Ground: analytic isometric lattice ----------
  const groundMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    extensions: { derivatives: true },
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      uniform float uTime, uRing, uBoost, uRise; uniform vec2 uPointer; varying vec2 vW;
      ${ISO_GLSL}
      void main(){
        vec2 q = vW / 0.84;
        vec3 d = isoDist(q);
        float fw = fwidth(q.y)*1.2;
        float line = 1.0 - smoothstep(0.0, fw, min(d.x, min(d.y, d.z)));
        float node = (1.0 - smoothstep(0.0, fw*2.5, d.x)) * (1.0 - smoothstep(0.0, fw*2.5, d.y));
        float r = length(vW);
        float ring = exp(-pow((r - uRing)*1.3, 2.0));
        float trail = smoothstep(uRing, uRing-6.0, r) * step(r, uRing) * 0.35;
        float pnear = exp(-pow(length(vW - uPointer)*0.55, 2.0)) * (0.4 + uBoost);
        float fade = (1.0 - smoothstep(5.0, 24.0, r)) * uRise;
        vec2 cell = floor(vec2(q.x*0.57735 + q.y, q.x*0.57735 - q.y));
        float seamCell = step(0.985, h21(cell)) * step(2.5, r);
        float sealed = smoothstep(0.0, 1.0, uRing - r) * (1.0 - smoothstep(1.0, 5.0, uRing - r));
        float flick = 0.5 + 0.5*sin(uTime*7.0 + h21(cell+3.0)*30.0);
        vec3 cy = vec3(0.10,0.67,0.89), rd = vec3(0.91,0.16,0.19);
        vec3 col = cy * line * (0.07 + ring*1.4 + trail*0.5 + pnear*1.0);
        col += cy * node * (0.25 + ring*2.5);
        col += mix(rd*flick, cy*1.5, sealed) * seamCell * line * 1.6;
        float a = clamp(max(line, node) * fade, 0.0, 1.0);
        gl_FragColor = vec4(col * fade, a);
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  world.add(ground);
  // base glow disc
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: glowTex, color: CYAN, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = GROUND_Y + 0.01;
  world.add(disc);

  // ---------- Crown of construct-line pillars ----------
  const spacing = high ? 0.4 : 0.52, Rmax = high ? 5.8 : 5.0;
  const pts = [];
  for (let j = -20; j <= 20; j++) for (let i = -20; i <= 20; i++) {
    const x = (i + j * 0.5) * spacing, z = j * spacing * 0.866;
    const r = Math.hypot(x, z);
    if (r > Rmax || r < 1.25) continue;
    const th = Math.atan2(z, x);
    // Crown: five-lobed profile; the three lobes behind the mark read as the points of a crown.
    const lobe = Math.pow(Math.max(0, Math.cos(5 * (th + Math.PI / 2))), 3);
    const back = 1 - THREE.MathUtils.smoothstep(z, -1.0, 2.2);
    const crown = lobe * (0.35 + 0.65 * back) * (th < -Math.PI / 2 - 0.3 || th > -Math.PI / 2 + 0.3 ? 0.82 : 1);
    const ring = THREE.MathUtils.smoothstep(r, 1.4, 2.3) * (1 - THREE.MathUtils.smoothstep(r, 3.4, 5.4));
    const sd = hash(i * 31.7 + j * 17.3);
    let h = (0.12 + 0.45 * sd * sd + 4.3 * crown) * ring + (sd > 0.95 ? 0.9 * sd : 0.04 + 0.1 * sd) * (1 - ring);
    if (z > 1.2 && Math.abs(x) < 2.0) h *= 0.2; // keep a clear sightline in front of the mark
    h *= 1 - 0.5 * THREE.MathUtils.smoothstep(z, 0.5, 4.0); // front of the crown stays low
    pts.push({ x, z, h, r, sd, i, j, crown });
  }
  const pillarGeo = new THREE.CylinderGeometry(0.008, 0.055, 1, 3, 1, false); // tapered crystal shards
  pillarGeo.translate(0, 0.5, 0);
  pillarGeo.rotateY(Math.PI / 6);
  const inst = new THREE.InstancedBufferGeometry().copy(pillarGeo);
  inst.instanceCount = pts.length;
  const aOff = new Float32Array(pts.length * 4);
  pts.forEach((p, k) => { aOff.set([p.x, p.z, p.h, p.sd], k * 4); });
  inst.setAttribute("aInst", new THREE.InstancedBufferAttribute(aOff, 4));
  const pillarMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `
      attribute vec4 aInst; uniform float uTime, uRise, uLift; varying float vY; varying float vH; varying float vR; varying float vSd;
      void main(){
        float r = length(aInst.xy);
        float delay = 0.25 + r*0.18 + aInst.w*0.35;
        float g = clamp((uRise*3.2 - delay)/1.1, 0.0, 1.0);
        g = 1.0 - pow(1.0-g, 3.0);
        float h = aInst.z * g * (1.0 + 0.06*sin(uTime*0.8 + aInst.w*20.0)) * (1.0 - uLift*0.35);
        vec3 p = position; vY = p.y; p.y *= max(h, 0.0001);
        p.xz += aInst.xy; p.y += ${GROUND_Y.toFixed(2)};
        vH = h; vR = r; vSd = aInst.w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime, uRing; varying float vY; varying float vH; varying float vR; varying float vSd;
      void main(){
        vec3 cy = vec3(0.10,0.67,0.89), rd = vec3(0.91,0.16,0.19);
        float ring = exp(-pow((vR - uRing)*1.6, 2.0));
        float top = smoothstep(0.9, 1.0, vY);
        float seam = step(0.985, vSd) * (0.5+0.5*sin(uTime*6.0+vSd*40.0));
        vec3 base = mix(vec3(0.012,0.018,0.03), cy*0.22, pow(vY, 3.0));
        vec3 col = base + cy * top * (0.35 + ring*1.6) + cy * ring * 0.5 * vY + cy * 0.12 * smoothstep(0.6, 1.0, vY);
        col = mix(col, rd * (0.4 + top*1.6), seam);
        float fade = 1.0 - smoothstep(4.5, 7.0, vR);
        gl_FragColor = vec4(col * (0.35 + 0.65*fade), 1.0);
      }`,
  });
  const pillars = new THREE.Mesh(inst, pillarMat);
  pillars.frustumCulled = false;
  world.add(pillars);

  // Glowing tips on the taller shards
  const tall = pts.filter((p) => p.h > 0.55);
  const tipAttr = new Float32Array(tall.length * 4);
  tall.forEach((p, k) => tipAttr.set([p.x, p.z, p.h, p.sd], k * 4));
  const tipGeo = new THREE.BufferGeometry();
  tipGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tall.length * 3), 3));
  tipGeo.setAttribute("aInst", new THREE.BufferAttribute(tipAttr, 4));
  const tipMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uPx: { value: renderer.getPixelRatio() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec4 aInst; uniform float uTime, uRise, uLift, uPx, uRing; varying float vA; varying float vRed;
      void main(){
        float r = length(aInst.xy);
        float delay = 0.25 + r*0.18 + aInst.w*0.35;
        float g = clamp((uRise*3.2 - delay)/1.1, 0.0, 1.0); g = 1.0 - pow(1.0-g, 3.0);
        float h = aInst.z * g * (1.0 + 0.06*sin(uTime*0.8 + aInst.w*20.0)) * (1.0 - uLift*0.35);
        vec4 mv = modelViewMatrix * vec4(aInst.x, ${GROUND_Y.toFixed(2)} + h, aInst.y, 1.0);
        gl_Position = projectionMatrix * mv;
        float ring = exp(-pow((r - uRing)*1.6, 2.0));
        gl_PointSize = (3.0 + aInst.z*1.6 + ring*6.0) * uPx * (10.0 / -mv.z);
        vA = g * (0.55 + 0.45*sin(uTime*2.0 + aInst.w*30.0)) + ring;
        vRed = step(0.985, aInst.w);
      }`,
    fragmentShader: `varying float vA; varying float vRed; void main(){ float d = length(gl_PointCoord-0.5); float a = pow(smoothstep(0.5, 0.0, d), 2.0); vec3 c = mix(vec3(0.6,0.92,1.0), vec3(1.0,0.3,0.33), vRed); gl_FragColor = vec4(c*a*vA*1.4, a); }`,
  });
  const tips = new THREE.Points(tipGeo, tipMat);
  tips.frustumCulled = false;
  world.add(tips);

  // Roof: construct lines joining neighbouring crown tops
  {
    const key = (i, j) => i + "," + j;
    const map = new Map(pts.map((p) => [key(p.i, p.j), p]));
    const seg = [];
    pts.forEach((p) => {
      if (p.h < 1.1) return;
      [[1, 0], [0, 1], [-1, 1]].forEach(([di, dj]) => {
        const q = map.get(key(p.i + di, p.j + dj));
        if (q && q.h > 1.1) seg.push(p, q);
      });
    });
    const pos = new Float32Array(seg.length * 3);
    const at = new Float32Array(seg.length * 4);
    seg.forEach((p, k) => { pos.set([p.x, 1, p.z], k * 3); at.set([p.x, p.z, p.h, p.sd], k * 4); });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aInst", new THREE.BufferAttribute(at, 4));
    const m = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec4 aInst; uniform float uTime, uRise, uLift; varying float vR;
        void main(){
          float r = length(aInst.xy);
          float delay = 0.25 + r*0.18 + aInst.w*0.35;
          float g = clamp((uRise*3.2 - delay - 0.4)/1.1, 0.0, 1.0); g = 1.0 - pow(1.0-g, 3.0);
          float h = aInst.z * g * (1.0 + 0.06*sin(uTime*0.8 + aInst.w*20.0)) * (1.0 - uLift*0.35);
          vR = r;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(aInst.x, ${GROUND_Y.toFixed(2)} + h, aInst.y, 1.0);
        }`,
      fragmentShader: `uniform float uRing; varying float vR; void main(){ float ring = exp(-pow((vR-uRing)*1.4,2.0)); gl_FragColor = vec4(vec3(0.10,0.67,0.89)*(0.35+ring*1.5), 0.6); }`,
    });
    const roof = new THREE.LineSegments(g, m);
    roof.frustumCulled = false;
    world.add(roof);
  }

  // ---------- Citadel: the extruded mark ----------
  const citadel = new THREE.Group();
  citadel.position.set(0, 0.25, 0);
  world.add(citadel);
  const markGroup = new THREE.Group();
  citadel.add(markGroup);
  const depth = 0.46;
  const matR = new THREE.MeshPhysicalMaterial({ color: RED, metalness: 0.15, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, emissive: RED, emissiveIntensity: 0.3, envMapIntensity: 0.22 });
  const matB = new THREE.MeshPhysicalMaterial({ color: CYAN, metalness: 0.15, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, emissive: CYAN, emissiveIntensity: 0.3, envMapIntensity: 0.22 });
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color("#bfefff"), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const facets = FACETS.map((f, idx) => {
    const v = f.d.split(" ").map((s) => { const [x, y] = s.split(",").map(Number); return toLocal(x, y); });
    const shape = new THREE.Shape(v);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.022, bevelSegments: 2, curveSegments: 1 });
    geo.translate(0, 0, -depth / 2);
    geo.computeBoundingBox();
    const ctr = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-ctr.x, -ctr.y, 0); // pivot at facet centre for nicer tumbling
    const mesh = new THREE.Mesh(geo, f.c === "r" ? matR : matB);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
    mesh.add(edges);
    const home = new THREE.Vector3(ctr.x, ctr.y, 0);
    const dir = new THREE.Vector3(f.dx, f.dy, 0).normalize();
    const from = home.clone().addScaledVector(dir, 7 + hash(idx) * 3).add(new THREE.Vector3(0, 0, (hash(idx + 9) - 0.5) * 8));
    const spin = new THREE.Euler((hash(idx + 2) - 0.5) * 5, (hash(idx + 4) - 0.5) * 5, (hash(idx + 6) - 0.5) * 3);
    mesh.position.copy(from);
    markGroup.add(mesh);
    return { mesh, home, from, dir, spin, delay: 0.35 + idx * 0.1 };
  });

  // Halo behind the citadel for silhouette
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color("#0f5f86"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.set(0, 0.1, -1.6);
  citadel.add(halo);

  // Gyroscopic triangle frames around the citadel
  function triRing(scale, thickness) {
    const outer = TRI.map((p) => p.clone().multiplyScalar(scale));
    const cen = new THREE.Vector2((outer[0].x + outer[1].x + outer[2].x) / 3, (outer[0].y + outer[1].y + outer[2].y) / 3);
    const inner = outer.map((p) => p.clone().sub(cen).multiplyScalar(1 - thickness / scale).add(cen)).reverse();
    const s = new THREE.Shape(outer);
    s.holes.push(new THREE.Path(inner));
    const g = new THREE.ShapeGeometry(s);
    g.translate(-cen.x, -cen.y, 0);
    return { geo: g, cen };
  }
  const ringBase = triRing(1, 0.035);
  const triCentre = ringBase.cen;
  const gyros = [1.55, 2.05].map((s, k) => {
    const { geo } = triRing(s, 0.012 * s);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: k ? CYAN : new THREE.Color("#8fdcff"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(triCentre.x, triCentre.y, 0);
    citadel.add(m);
    return m;
  });
  // Shield pulses
  const pulses = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(ringBase.geo, new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(triCentre.x, triCentre.y, 0);
    citadel.add(m);
    return m;
  });
  // C·I·A beacons
  const beaconGeo = new THREE.BufferGeometry().setFromPoints(TRI.map((p) => new THREE.Vector3(p.x, p.y, 0)));
  const beaconMat = new THREE.PointsMaterial({ color: new THREE.Color("#cfefff"), size: high ? 0.32 : 0.4, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const beacons = new THREE.Points(beaconGeo, beaconMat);
  citadel.add(beacons);

  // Lights
  scene.add(new THREE.AmbientLight(0x223344, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(CYAN, 2.2); rim.position.set(-6, 2, -6); scene.add(rim);
  const core = new THREE.PointLight(CYAN, 6, 9, 1.6); core.position.set(0, -1.2, 1.5); citadel.add(core);

  // ---------- Data motes streaming up the crown into the citadel ----------
  const crownPts = pts.filter((p) => p.h > 0.8);
  const NM = high ? 700 : 260;
  const mPos = new Float32Array(NM * 3), mAt = new Float32Array(NM * 4);
  for (let k = 0; k < NM; k++) {
    const p = crownPts[Math.floor(hash(k * 3.1) * crownPts.length)] || { x: 0, z: 0, h: 1 };
    mAt.set([p.x, p.z, p.h, hash(k * 7.7)], k * 4);
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
  mg.setAttribute("aInst", new THREE.BufferAttribute(mAt, 4));
  const moteMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uPx: { value: renderer.getPixelRatio() }, uTarget: { value: new THREE.Vector3(0, 0.25, 0) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec4 aInst; uniform float uTime, uRise, uPx; uniform vec3 uTarget; varying float vA; varying float vRed;
      void main(){
        float f = fract(uTime*(0.07 + aInst.w*0.08) + aInst.w*7.0);
        vec3 p = vec3(aInst.x, ${GROUND_Y.toFixed(2)} + f*aInst.z*1.6, aInst.y);
        float k = smoothstep(0.55, 1.0, f);
        p = mix(p, uTarget + vec3(0.0, 0.0, 0.3), k*k);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + aInst.w*3.0) * uPx * (8.0 / -mv.z);
        vA = sin(f*3.14159) * clamp(uRise*2.0 - 1.0, 0.0, 1.0);
        vRed = step(0.93, aInst.w);
      }`,
    fragmentShader: `varying float vA; varying float vRed; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.0, d); vec3 c = mix(vec3(0.55,0.88,1.0), vec3(1.0,0.35,0.38), vRed); gl_FragColor = vec4(c*a*vA, a*vA); }`,
  });
  const motes = new THREE.Points(mg, moteMat);
  motes.frustumCulled = false;
  world.add(motes);

  // ---------- Post ----------
  let composer = null;
  if (high) {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
    ]);
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    composer.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.3, 0.9);
    composer.addPass(composer.bloom);
    composer.addPass(new OutputPass());
  }

  // ---------- Layout ----------
  let W = 1, H = 1, portrait = false;
  const look = new THREE.Vector3();
  const camBase = new THREE.Vector3();
  function layout() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    // Cap the internal render size (~2560 px wide) so 4K screens keep the same look and frame budget.
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, opts.dprCap || 1.5, 2560 / W));
    renderer.setSize(W, H, false);
    if (composer) {
      composer.setSize(W, H);
      composer.bloom.resolution.set(W / 2, H / 2);
      composer.setPixelRatio(renderer.getPixelRatio());
    }
    camera.aspect = W / H;
    portrait = camera.aspect < 0.9;
    const fovR = THREE.MathUtils.degToRad(camera.fov);
    if (portrait) {
      // Fit the citadel to ~92% of the width; put it in the upper part (copy sits low on mobile)
      const dist = 5.6 / (2 * Math.tan(fovR / 2) * camera.aspect);
      camBase.set(0, 1.2, Math.max(9, dist));
      look.set(0, -2.9, 0);
      world.position.x = 0;
    } else {
      camBase.set(0, 0.9, 12);
      look.set(0, -0.55, 0);
      const visW = 2 * Math.tan(fovR / 2) * camBase.z * camera.aspect;
      world.position.x = Math.min(visW * 0.22, 4.6) * (camera.aspect > 1.25 ? 1 : 0.4);
    }
    scene.fog.density = 0.33 / camBase.z; // fog relative to camera distance so the citadel stays vivid
    camera.updateProjectionMatrix();
  }
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(canvas);

  // ---------- Input ----------
  const ptr = new THREE.Vector2(), ptrS = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
  const hit = new THREE.Vector3();
  let boost = 0;
  const onPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    boost = 1;
  };
  addEventListener("pointermove", onPointer, { passive: true });

  // ---------- Loop ----------
  let running = true, visible = true, raf = 0, first = true, lost = false, progress = 0, progS = 0, chapter = "top";
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const anchors = TRI.map(() => ({ x: 0, y: 0, visible: false }));
  let lockT = -1;
  const stats = { frames: 0, t: 0 };

  function frame() {
    if (!running || lost) return;
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    stats.frames++; stats.t = t;
    U.uTime.value = t;
    U.uRise.value = clamp01(t / 2.4);
    progS += (progress - progS) * 0.08;
    U.uLift.value = progS;

    // Assembly
    let done = true;
    facets.forEach((f) => {
      const k = easeOutExpo(clamp01((t - f.delay) / 1.9));
      if (k < 1) done = false;
      f.mesh.position.lerpVectors(f.from, f.home, k);
      f.mesh.position.addScaledVector(f.dir, progS * 0.9).z += progS * (f.dir.y > 0 ? 0.6 : -0.3);
      f.mesh.rotation.set(f.spin.x * (1 - k), f.spin.y * (1 - k), f.spin.z * (1 - k));
    });
    if (done && lockT < 0) lockT = t;
    const sinceLock = lockT < 0 ? -1 : t - lockT;

    // Lock flash, then breathing emissive
    const flash = sinceLock >= 0 ? Math.exp(-sinceLock * 2.2) : 0;
    matR.emissiveIntensity = 0.3 + flash * 1.4 + 0.05 * Math.sin(t * 1.3);
    matB.emissiveIntensity = 0.3 + flash * 1.6 + 0.06 * Math.sin(t * 1.3 + 1);
    edgeMat.opacity = 0.2 + 0.35 * clamp01(t / 3) + flash * 0.4;
    core.intensity = 2.5 + flash * 20 + 1.2 * Math.sin(t * 2.0);

    // Scan ring: first sweep fires on lock, then every 6.5s
    if (sinceLock >= 0) U.uRing.value = (sinceLock % 6.5) * 4.2 - 0.5; else U.uRing.value = -10;

    // Shield pulses + gyros + beacons
    pulses.forEach((m, i) => {
      if (sinceLock < 0) { m.material.opacity = 0; return; }
      const k = ((sinceLock / 3.6) + i / 3) % 1;
      const s = 1.02 + easeInOut(k) * 2.6;
      m.scale.set(s, s, s);
      m.material.opacity = Math.pow(1 - k, 2) * 0.55 * clamp01(sinceLock * 2);
    });
    gyros.forEach((g, i) => {
      g.rotation.y = t * (i ? -0.22 : 0.31) + (i ? 0.6 : 0);
      g.rotation.x = Math.sin(t * 0.17 + i) * 0.35;
      g.material.opacity = clamp01((t - 1.8) / 1.5) * (i ? 0.28 : 0.42);
    });
    beaconMat.opacity = clamp01((t - 2.2) / 0.8) * (0.75 + 0.25 * Math.sin(t * 3));
    halo.material.opacity = clamp01((t - 0.6) / 2) * (0.36 + 0.08 * Math.sin(t * 0.8)) + flash * 0.6;

    // Pointer + camera
    ptrS.lerp(ptr, 0.06);
    boost *= 0.97;
    U.uBoost.value = boost;
    citadel.rotation.y = ptrS.x * 0.42 + Math.sin(t * 0.25) * 0.08;
    citadel.rotation.x = -ptrS.y * 0.16;
    citadel.position.y = 0.25 + Math.sin(t * 0.9) * 0.06 + progS * 0.6;
    world.rotation.y = ptrS.x * 0.06 + t * 0.012;
    camera.position.set(camBase.x + ptrS.x * 0.5, camBase.y + ptrS.y * 0.3 + progS * 5.5, camBase.z - progS * 2.2);
    tmp.copy(look); tmp.y -= progS * 1.2;
    camera.lookAt(tmp.x + world.position.x * 0.0, tmp.y, tmp.z);
    // keep the world offset in screen space (citadel right of copy) by shifting the view instead of the look target
    camera.updateMatrixWorld();

    // Ground pointer hover
    ray.setFromCamera(ptrS, camera);
    if (ray.ray.intersectPlane(plane, hit)) { world.worldToLocal(hit); U.uPointer.value.set(hit.x, hit.z); }

    if (composer) {
      composer.bloom.strength = 0.45 + flash * 0.7;
      composer.render();
    } else renderer.render(scene, camera);

    // Anchors for HTML C·I·A labels
    if (opts.onAnchors) {
      citadel.updateMatrixWorld();
      TRI.forEach((p, i) => {
        tmp.set(p.x, p.y, 0).applyMatrix4(citadel.matrixWorld).project(camera);
        anchors[i].x = (tmp.x * 0.5 + 0.5) * W;
        anchors[i].y = (-tmp.y * 0.5 + 0.5) * H;
        anchors[i].visible = t > 2.4 && progS < 0.35 && !portrait && tmp.z < 1;
      });
      opts.onAnchors(anchors);
    }
    if (first) { first = false; requestAnimationFrame(() => opts.onFirstFrame && opts.onFirstFrame()); }
  }

  // Run only while on screen and tab visible
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: "100px" });
  io.observe(canvas);
  const onVis = () => sync();
  document.addEventListener("visibilitychange", onVis);
  let paused = false;
  function sync() {
    const should = visible && !document.hidden && !paused && !lost;
    if (should && !running) { running = true; clock.start(); clock.elapsedTime = lastT; raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; lastT = clock.getElapsedTime(); cancelAnimationFrame(raf); }
  }
  let lastT = 0;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; cancelAnimationFrame(raf); opts.onContextLost && opts.onContextLost(); }, { once: true });

  raf = requestAnimationFrame(frame);

  return {
    setChapter(id) { chapter = id; },
    setProgress(p) { progress = clamp01(p); },
    resize() { layout(); },
    pause() { paused = true; sync(); },
    resume() { paused = false; sync(); },
    destroy() {
      paused = true; sync(); io.disconnect(); ro.disconnect();
      removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
      renderer.dispose(); envTex.dispose();
    },
    get chapter() { return chapter; },
    stats,
  };
}
