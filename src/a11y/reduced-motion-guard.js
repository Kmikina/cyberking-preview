/**
 * Live prefers-reduced-motion guard (perf/a11y scope; no visual changes).
 * The tier is decided once at load (static tier = no motion at all). If the OS setting flips to "reduce"
 * mid-session, this freezes what is still moving: any <video> (hero film) and any motion controllers exposed
 * on window.__ck (stand-in hero/bg; the external motion modules already stand down on their own).
 * Safe to import anywhere; it has no dependencies.
 */
const mq = matchMedia("(prefers-reduced-motion: reduce)");

function freeze() {
  if (!mq.matches) return;
  document.querySelectorAll("video").forEach((v) => { if (!v.paused) v.pause(); });
  const ck = window.__ck;
  if (ck) for (const l of [ck.hero, ck.bg]) if (l && typeof l.pause === "function") { try { l.pause(); } catch (_) {} }
}

// Any video that tries to (re)start while reduced motion is on gets paused (play events don't bubble; capture does).
document.addEventListener("play", (e) => { if (mq.matches && e.target instanceof HTMLMediaElement) e.target.pause(); }, true);
if (mq.addEventListener) mq.addEventListener("change", freeze);
// Layers auto-resume on tab focus; re-freeze after that.
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(freeze, 0); });
