// Capability + tier detection. Pure DOM, no three.js, so it is safe to run on
// the critical path. Result is cached and shared by hero.js and background.js.
let cached = null;

const mm = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;

function probeWebGL() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) || null;
    if (!gl) return { ok: false, renderer: '' };
    let renderer = '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return { ok: true, renderer };
  } catch (e) {
    return { ok: false, renderer: '' };
  }
}

/**
 * detect(opts) → { mode: 'off'|'2d'|'gl', tier: 'high'|'mid'|'low'|null, reasons: [], ... }
 * opts.mode / opts.tier force a result (useful for QA: ?motion=2d, ?tier=low).
 */
export function detect(opts = {}) {
  if (cached && !opts.mode && !opts.tier) return cached;
  const reasons = [];
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const conn = nav.connection || {};
  const reduced = mm('(prefers-reduced-motion: reduce)');
  const saveData = !!conn.saveData;
  const slowNet = /(^|-)2g$/.test(conn.effectiveType || '');
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory; // undefined outside Chromium
  const coarse = mm('(pointer: coarse)');
  const small = typeof screen !== 'undefined' ? Math.min(screen.width, screen.height) < 820 : false;
  const mobile = coarse && small;

  let mode = 'gl';
  if (reduced) { mode = 'off'; reasons.push('prefers-reduced-motion'); }
  else if (saveData) { mode = '2d'; reasons.push('save-data'); }
  else if (slowNet) { mode = '2d'; reasons.push('2g connection'); }
  else if ((mem && mem <= 2) || cores <= 2) { mode = '2d'; reasons.push(`weak device (cores ${cores}, mem ${mem ?? '?'})`); }

  let gl = { ok: false, renderer: '' };
  if (mode === 'gl') {
    gl = probeWebGL();
    if (!gl.ok) { mode = '2d'; reasons.push('no WebGL2'); }
  }
  const software = /swiftshader|llvmpipe|software|softpipe|basic render/i.test(gl.renderer);

  let tier = null;
  if (mode === 'gl') {
    if (software) { tier = 'low'; reasons.push('software renderer'); }
    else if (!mobile && cores >= 8 && (!mem || mem >= 8)) tier = 'high';
    else if ((!mobile && cores >= 4) || (mobile && cores >= 6 && (!mem || mem >= 4))) tier = 'mid';
    else tier = 'low';
  }

  if (opts.mode) { mode = opts.mode; reasons.push(`forced mode ${opts.mode}`); }
  if (opts.tier && mode === 'gl') { tier = opts.tier; reasons.push(`forced tier ${opts.tier}`); }

  const res = { mode, tier, reasons, reduced, saveData, mobile, cores, mem: mem ?? null, renderer: gl.renderer, software };
  if (!opts.mode && !opts.tier) cached = res;
  return res;
}

// Starting quality per tier. The runtime governor only ever steps DOWN from here.
export const TIERS = {
  high: { bloom: true,  particles: 1.0, bgScale: 1.0,  dprCap: 1.5,  heroScale: 1.0, msaa: 4 },
  mid:  { bloom: true,  particles: 0.5, bgScale: 0.75, dprCap: 1.25, heroScale: 1.0, msaa: 0 },
  low:  { bloom: false, particles: 0.0, bgScale: 0.5,  dprCap: 1.0,  heroScale: 1.0, msaa: 0 },
};
