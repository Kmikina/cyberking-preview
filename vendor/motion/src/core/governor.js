// One shared rAF ticker + a step-down-only FPS governor for both modules.
// Steps (in order): bloom off → particles halved → particles off →
// background resolution 0.75 → 0.5 (+ sparser lattice) → hero resolution 0.75.
import { TIERS } from './env.js';

const subs = new Set();
const listeners = new Set();
let raf = 0;
let last = 0;

const state = {
  tier: null,
  q: null,          // current quality object
  steps: 0,
  log: [],          // [{ t, fps, action }]
  target: 55,
  frames: [],       // recent frame deltas (ms)
  warmUntil: 0,
  winStart: 0,
  allDeltas: [],    // for perf measurement (capped)
};

const STEPS = [
  (q) => (q.bloom ? ((q.bloom = false), 'bloom off') : null),
  (q) => (q.particles > 0.5 ? ((q.particles = 0.4), 'particles 40%') : null),
  (q) => (q.particles > 0 ? ((q.particles = 0), 'particles off') : null),
  (q) => (q.bgScale > 0.75 ? ((q.bgScale = 0.75), 'background res 0.75') : null),
  (q) => (q.bgScale > 0.5 ? ((q.bgScale = 0.5), (q.bgSparse = 1.25), 'background res 0.5 + sparser') : null),
  (q) => (q.heroScale > 0.75 ? ((q.heroScale = 0.75), 'hero res 0.75') : null),
  (q) => (q.dprCap > 1 ? ((q.dprCap = 1), 'dpr cap 1') : null),
];

export function setTier(tier, opts = {}) {
  if (state.q) return state.q; // first module to start wins; both share it
  state.tier = tier;
  state.q = { ...TIERS[tier], bgSparse: 1 };
  if (opts.mobile) state.q.dprCap = Math.min(state.q.dprCap, 1.25);
  if (opts.targetFps) state.target = opts.targetFps;
  state.adaptive = opts.adaptive !== false;
  state.warmUntil = performance.now() + 1500;
  return state.q;
}

export const quality = () => state.q;
export const governorState = () => state;
export function onQuality(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function evaluate(now) {
  if (!state.q || !state.adaptive) return;
  if (now < state.warmUntil) { state.frames = []; state.winStart = now; return; }
  // judge after 90 frames, or after 1.5 s if frames are slow (so weak devices step down quickly)
  if (state.frames.length < 90 && !(now - state.winStart > 1500 && state.frames.length >= 10)) return;
  const f = state.frames;
  const avg = f.reduce((a, b) => a + b, 0) / f.length;
  const fps = 1000 / avg;
  state.frames = []; state.winStart = now;
  if (fps >= state.target) return;
  for (const step of STEPS) {
    const action = step(state.q);
    if (action) {
      state.steps++;
      state.log.push({ t: Math.round(now), fps: Math.round(fps * 10) / 10, action });
      state.warmUntil = now + 1200; // let the change settle before judging again
      listeners.forEach((fn) => fn(state.q, action));
      return;
    }
  }
}

function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = last ? now - last : 16.7;
  last = now;
  let drew = false;
  for (const fn of subs) if (fn(now, Math.min(dt, 100) / 1000) !== false) drew = true;
  // Only judge frames where something actually rendered; ignore stalls (tab switch, debugger).
  if (drew && dt < 1000 && !document.hidden) { // >1 s gaps = tab switch / debugger, not render cost
    state.frames.push(dt);
    if (state.allDeltas.length < 20000) state.allDeltas.push(dt);
    evaluate(now);
  }
}

/** Register a per-frame callback. Return false from it when nothing was drawn. */
export function addTicker(fn) {
  subs.add(fn);
  if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  return () => {
    subs.delete(fn);
    if (!subs.size && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
}

if (typeof window !== 'undefined') {
  // Expose for QA / perf scripts (read-only use).
  window.__ckMotion = window.__ckMotion || {};
  window.__ckMotion.governor = state;
}
