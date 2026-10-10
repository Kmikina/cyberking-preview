// A controller that exists synchronously and forwards to the real
// implementation once it has loaded. Calls made earlier are replayed (last
// value wins). All methods are safe no-ops after destroy().
export function createProxy(info) {
  let impl = null;
  let dead = false;
  const pending = { chapter: null, progress: null, reveal: false };
  const ctrl = {
    info,                              // { mode, tier, reasons, ... }
    get mode() { return info.mode; },
    setChapter(id) { if (dead) return; impl ? impl.setChapter(id) : (pending.chapter = id); },
    setProgress(p) { if (dead) return; impl ? impl.setProgress(p) : (pending.progress = p); },
    resize() { if (!dead && impl) impl.resize(); },
    // Deterministic render mode only (opts.render): draw the frame at t seconds. No-op otherwise.
    // opts.hold only: crossfade from the poster/film to the live canvas.
    reveal() { if (dead) return; impl && impl.reveal ? impl.reveal() : (pending.reveal = true); },
    renderFrame(t) { if (!dead && impl && impl.renderFrame) impl.renderFrame(t); },
    pause() { if (!dead && impl && impl.pause) impl.pause(); },
    resume() { if (!dead && impl && impl.resume) impl.resume(); },
    destroy() { if (dead) return; dead = true; if (impl) impl.destroy(); impl = null; },
    ready: null,                       // Promise resolved when the implementation is live
  };
  ctrl._attach = (real) => {
    if (dead) { real.destroy(); return; }
    impl = real;
    if (pending.chapter != null) real.setChapter(pending.chapter);
    if (pending.progress != null) real.setProgress(pending.progress);
    if (pending.reveal && real.reveal) real.reveal();
  };
  ctrl._swap = (real, mode) => { if (impl) impl.destroy(); info.mode = mode; impl = null; ctrl._attach(real); };
  ctrl._impl = () => impl;
  return ctrl;
}

export const noopController = (info) => {
  const c = createProxy(info);
  c.ready = Promise.resolve(c);
  return c;
};

/** Resolve after first paint + idle (or timeout), so WebGL never competes with LCP. */
export function afterFirstPaintIdle(timeout = 1200) {
  return new Promise((resolve) => {
    const idle = () => {
      if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout });
      else setTimeout(resolve, 50);
    };
    const go = () => requestAnimationFrame(() => setTimeout(idle, 0));
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  });
}
