// Cyber King motion — BACKGROUND module.
// Contract: init(canvas, opts) → controller { setChapter, setProgress, resize, destroy, pause, resume, ready, info }
// This file is tiny and three.js-free; the WebGL scene (or the 2D fallback)
// is code-split and loaded after first paint + idle.
import { detect } from './core/env.js';
import { createProxy, noopController, afterFirstPaintIdle } from './core/controller.js';
export { CHAPTERS, BG_PRESETS } from './core/chapters.js';

export function init(canvas, opts = {}) {
  const info = { ...detect(opts) };
  // Reduced motion (or no canvas): do nothing at all. The Designer's static state shows.
  if (info.mode === 'off' || !canvas) return noopController(info);

  const ctrl = createProxy(info);
  const load2d = () => import('./fallback/background-2d.js').then((m) => m.create(canvas, opts, info));
  const wait = opts.defer === false ? Promise.resolve() : afterFirstPaintIdle(opts.idleTimeout);

  ctrl.ready = wait.then(async () => {
    if (info.mode === '2d') { ctrl._attach(await load2d()); return ctrl; }
    try {
      const m = await import('./gl/background-gl.js');
      ctrl._attach(m.create(canvas, opts, info, {
        onContextLost: async () => {
          info.reasons.push('webgl context lost');
          ctrl._swap(await load2d(), '2d');
        },
      }));
    } catch (err) {
      console.warn('[ck-motion] background WebGL failed, using 2D fallback', err);
      info.reasons.push('webgl init failed');
      info.mode = '2d';
      ctrl._attach(await load2d());
    }
    return ctrl;
  });

  // If the user switches on reduced motion while running, stand down completely.
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const onMq = (e) => { if (e.matches) ctrl.destroy(); };
  mq.addEventListener && mq.addEventListener('change', onMq);
  const destroy = ctrl.destroy;
  ctrl.destroy = () => { mq.removeEventListener && mq.removeEventListener('change', onMq); destroy(); };
  return ctrl;
}
