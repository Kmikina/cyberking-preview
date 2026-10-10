import { ShaderMaterial, Color, AdditiveBlending, BufferAttribute, InstancedBufferGeometry, InstancedBufferAttribute, Mesh, Vector2 } from 'three';

// Construct-line material: screen-space quads (true pixel width, AA edges).
// Segments draw on (vT 0→1 along each segment, iDelay staggers segments) with
// a brighter leading tip. Colours above 1.0 are intentional: only those
// (the accent lines) cross the bloom threshold.
export function lineMaterial({ color = '#a0aec4', intensity = 1, opacity = 0.3, fadeR = 0, span = 0.35, tip = 1.2, width = 1 } = {}) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new Color(color).multiplyScalar(intensity) },
      uOpacity: { value: opacity },
      uDraw: { value: 0 },
      uSpan: { value: span },
      uFadeR: { value: fadeR },
      uTip: { value: tip },
      uRing: { value: 0 },
      uRingI: { value: 0 },
      uRingColor: { value: new Color('#1aaae4').multiplyScalar(1.8) },
      uRes: { value: new Vector2(1, 1) },
      uWidthCss: { value: width },   // CSS px
      uPx: { value: 1 },             // drawing-buffer px per CSS px
    },
    vertexShader: /* glsl */`
      attribute vec3 iA; attribute vec3 iB; attribute float iDelay;
      uniform float uDraw, uSpan, uFadeR, uWidthCss, uPx; uniform vec2 uRes;
      varying float vT, vLocal, vFade, vR, vSide, vHW, vCov;
      void main(){
        vec4 wa = modelMatrix * vec4(iA, 1.0), wb = modelMatrix * vec4(iB, 1.0);
        vec4 ca = projectionMatrix * viewMatrix * wa, cb = projectionMatrix * viewMatrix * wb;
        float t = position.x;
        vT = t;
        vLocal = clamp((uDraw - iDelay * (1.0 - uSpan)) / uSpan, 0.0, 1.0);
        vec4 wp = mix(wa, wb, t);
        vR = length(wp.xz);
        vFade = uFadeR > 0.0 ? 1.0 - smoothstep(uFadeR * 0.15, uFadeR, vR) : 1.0;
        float w = uWidthCss * uPx;
        vCov = clamp(w, 0.0, 1.0);          // sub-pixel lines fade instead of thinning
        vHW = max(w, 1.0) * 0.5;
        if (ca.w < 0.01 || cb.w < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec2 sa = ca.xy / ca.w * uRes, sb = cb.xy / cb.w * uRes;
        vec2 dir = sb - sa; float L = length(dir); dir = L > 1e-5 ? dir / L : vec2(1.0, 0.0);
        vec2 n = vec2(-dir.y, dir.x);
        vec4 c = mix(ca, cb, t);
        float side = position.y * (vHW + 1.0);
        vSide = side;
        c.xy += n * side / uRes * c.w;
        gl_Position = c;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uRingColor; uniform float uOpacity, uTip, uRing, uRingI;
      varying float vT, vLocal, vFade, vR, vSide, vHW, vCov;
      void main(){
        if (vLocal <= 0.0 || vT > vLocal) discard;
        float edge = clamp(vHW + 0.5 - abs(vSide), 0.0, 1.0) * vCov;
        float tip = vLocal < 1.0 ? smoothstep(vLocal - 0.2, vLocal, vT) * uTip : 0.0;
        float ring = uRingI * exp(-pow((vR - uRing) / 1.1, 2.0));
        vec3 c = uColor * (1.0 + tip) + uRingColor * ring;
        float a = (uOpacity + ring * 0.5) * vFade * edge;
        if (a < 0.002) discard;
        gl_FragColor = vec4(c, min(a, 1.0));
        #include <colorspace_fragment>
      }`,
  });
}

// Turn a (non-indexed) LineSegments geometry with aDelay into instanced quads.
export function fatLines(lineGeo, material) {
  const pos = lineGeo.attributes.position, del = lineGeo.attributes.aDelay;
  const n = pos.count / 2;
  const A = new Float32Array(n * 3), B = new Float32Array(n * 3), D = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    A[i * 3] = pos.getX(2 * i); A[i * 3 + 1] = pos.getY(2 * i); A[i * 3 + 2] = pos.getZ(2 * i);
    B[i * 3] = pos.getX(2 * i + 1); B[i * 3 + 1] = pos.getY(2 * i + 1); B[i * 3 + 2] = pos.getZ(2 * i + 1);
    D[i] = del ? del.getX(2 * i) : 0;
  }
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  g.setAttribute('iA', new InstancedBufferAttribute(A, 3));
  g.setAttribute('iB', new InstancedBufferAttribute(B, 3));
  g.setAttribute('iDelay', new InstancedBufferAttribute(D, 1));
  g.instanceCount = n;
  lineGeo.dispose();
  const m = new Mesh(g, material);
  m.frustumCulled = false;
  return m;
}

// Attach aT/aDelay to a non-indexed LineSegments geometry. delayFn(midpoint, i) → 0..1
export function addDrawAttrs(geo, delayFn) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const t = new Float32Array(n);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    t[i] = 0; t[i + 1] = 1;
    const mx = (pos.getX(i) + pos.getX(i + 1)) / 2, my = (pos.getY(i) + pos.getY(i + 1)) / 2, mz = (pos.getZ(i) + pos.getZ(i + 1)) / 2;
    const v = Math.min(1, Math.max(0, delayFn(mx, my, mz, i / 2)));
    d[i] = d[i + 1] = v;
  }
  geo.setAttribute('aT', new BufferAttribute(t, 1));
  geo.setAttribute('aDelay', new BufferAttribute(d, 1));
  return geo;
}

// Plates: faceted graphite like the original's SVG plates (.top / .side-l / .side-r).
export function plateMaterial({ top = '#161c28', left = '#0c1018', right = '#121825', opacity = 1 } = {}) {
  return new ShaderMaterial({
    transparent: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, // keep edge lines on top of faces
    uniforms: {
      uTop: { value: new Color(top) }, uL: { value: new Color(left) }, uR: { value: new Color(right) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying float vY;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uL, uR; uniform float uOpacity;
      varying vec3 vN; varying float vY;
      void main(){
        vec3 n = normalize(vN);
        float k = clamp(dot(normalize(n.xz + 1e-4), normalize(vec2(0.55, 0.83))) * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = n.y > 0.5 ? uTop : mix(uL, uR, k);
        c *= n.y > 0.5 ? 1.0 : (0.75 + 0.25 * vY); // faint vertical gradient on walls
        gl_FragColor = vec4(c, uOpacity);
        #include <colorspace_fragment>
      }`,
  });
}

// Mark pieces: flat brand colour on the faces, darker extruded sides.
export function markMaterial(color) {
  return new ShaderMaterial({
    transparent: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */`
      varying vec3 vN;
      void main(){ vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; varying vec3 vN;
      void main(){
        float face = step(0.5, abs(vN.z));
        vec3 c = uColor * mix(0.42 + 0.18 * abs(vN.x), 1.0, face);
        gl_FragColor = vec4(c, uOpacity);
        #include <colorspace_fragment>
      }`,
  });
}

// Fine dust. Additive, tiny, slow; a few accent motes.
export function dustMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPx: { value: 1 }, uH: { value: 12 }, uLoop: { value: -1 } },
    vertexShader: /* glsl */`
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
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying vec3 vCol; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.1, length(d)) * vA * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vCol, a);
        #include <colorspace_fragment>
      }`,
  });
}
