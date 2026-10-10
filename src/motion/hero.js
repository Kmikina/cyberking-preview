/**
 * HERO MOUNT POINT.
 * Contract: init(canvas, opts) → controller { setChapter(id), setProgress(p), resize(), destroy(), pause?(), resume?() }
 * (sync or Promise). Chapter ids = the original site's section anchors:
 *   top · environment · challenge · company · capabilities · approach · commitment · contact
 * `@ck/motion-hero` is aliased in vite.config.js:
 *   default  → /workspace/cyberking/motion/src/hero.js   (3D motion engineer's module, if present)
 *   CK_MOTION=standin → ./standin/hero.js                (designer's working stand-in, same contract)
 */
export { init } from "@ck/motion-hero";
