/**
 * BACKGROUND MOUNT POINT. Same contract and aliasing as hero.js:
 *   default  → vendor/motion/src/background.js (vendored)
 *   CK_MOTION=standin → ./standin/background.js (raw WebGL shader; 2D fallback in ./standin/lite2d.js)
 */
export { init } from "@ck/motion-bg";
