# Cyber King Services: 3D motion layer (local preview only)

Plain ES modules: three.js r180 and GSAP 3 (ScrollTrigger) only. No Lenis, no deploys, no external services.
The Site Designer owns all page DOM and copy. These modules draw only on the canvases you pass in, and they draw no text.

```
motion/
  src/hero.js            → init(canvas, opts)   (mount point: src/motion/hero.js)
  src/background.js      → init(canvas, opts)   (mount point: src/motion/background.js)
  src/core/              env/tier detection, shared rAF + FPS governor, chapters, palette, mark data, layout
  src/gl/                WebGL scenes (code-split, loaded after first paint + idle)
  src/fallback/          2D SVG/CSS fallbacks (code-split)
  poster/                poster.html + poster.css (inline these), hero-poster-mark.svg
  demo/                  standalone Vite demo (live-site copy, verbatim; film layer on)
  video/                 rendered loops (MP4 + WebM), posters (JPG + AVIF)
  video-snippet.html     poster → film → live WebGL drop-in
  shots/                 headless screenshots
```

## Using it from the Designer's preview
Either copy `src/` into `src/motion/ck/`, or import it directly. Re-export it at the mount points:

```js
// src/motion/hero.js
export { init } from '../../../motion/src/hero.js';
// src/motion/background.js
export { init } from '../../../motion/src/background.js';
```
`three` and `gsap` must be dependencies of the preview. `hero.js` and `background.js` are small and do not import three.js.
They resolve a controller synchronously. three.js and GSAP load later through dynamic `import()`, after `load` → rAF → `requestIdleCallback`.
That keeps them off the LCP path.

```js
import { init as initHero } from './motion/hero.js';
import { init as initBg } from './motion/background.js';
const hero = initHero(heroCanvas, { poster: document.getElementById('heroPoster'), trigger: heroSection });
const bg   = initBg(bgCanvas, { initialChapter: 'top' });
// on chapter change (the original site uses a hairline at 40% of the viewport):
hero.setChapter(id); bg.setChapter(id);
```

## Contract
`init(canvas, opts)` returns a controller immediately. All of these methods are always safe to call, including before load, after destroy, and in no-op mode:

| method | |
|---|---|
| `setChapter(id)` | background: morphs to that chapter's preset. hero: only renders while the hero chapter is active or the canvas is on screen |
| `setProgress(p)` | 0..1. hero: scroll timeline, smoothed. Only needed with `scroll:false`, because by default the hero creates its own ScrollTrigger. background: parallax offset when `scroll:false` |
| `resize()` | Usually not needed, because a ResizeObserver handles it. Height-only changes under 120px (mobile URL bar) are ignored |
| `pause()` / `resume()` | |
| `destroy()` | Disposes GL, kills the ScrollTrigger, removes fallback DOM and restores the poster |
| `ready` | Promise that resolves when the real implementation is live |
| `info` | `{ mode: 'gl'/'2d'/'off', tier, reasons[], renderer, software, ... }` |
| `renderFrame(t)` | Render mode only (`opts.render`). See below |
| `seek({intro, progress})` / `seek({chapter, time})` | QA only, on `ctrl._impl()`: freezes at an exact state for screenshots |

### opts (hero)
| opt | default | |
|---|---|---|
| `poster` | null | Element faded out after the first WebGL frame (or replaced by the 2D fallback). Restored on destroy |
| `trigger` | closest `section`/`[data-chapter]` | ScrollTrigger trigger |
| `scrollStart` / `scrollEnd` | `'top top'` / `'bottom bottom'` | Progress 0→1 over this range. Use a tall hero with a sticky stage (the demo uses 260vh) or your own pin |
| `scroll` | true | Set false to drive progress yourself with `setProgress` |
| `layout(w,h)` | `defaultLayout` | Returns `{markPx, focus0, focus1, frac, box, latticeR?, guideR?}`. See **Framing** below |
| `fit` | true | Keep the mark + fortress inside `layout.box` for the whole timeline |
| `lineScale` | 1 | Multiplies every line width (CSS px; lines are screen-space quads, not 1-px GL lines) |
| `introDuration` | 3.6 | Seconds for the on-load intro |
| `mode` / `tier` | auto | Force `'gl'/'2d'/'off'` or `'high'/'mid'/'low'` (QA) |
| `adaptive` | true | FPS governor on or off |
| `targetFps` | 55 | Governor threshold |
| `defer` | true | false = mount immediately instead of after first paint + idle |
| `fallbackParent` | canvas.parentElement | Where the 2D hero fallback is inserted. The canvas should fill this element |
| `hold` | false | Keep the live canvas invisible after its first frame until `reveal()` is called, then crossfade (650 ms) from `poster` to WebGL. Used by the film layer |
| `onFirstFrame` | | Callback |

Controller extras: `reveal()` (with `hold`; a no-op on the 2D/off paths), `renderFrame(t)` (render mode only).

### opts (background)
`initialChapter` ('top'), `presets` (override or add chapter presets, see `src/core/chapters.js`), `morphDuration` (1.6s), `scroll` (true: reads `scrollY` for parallax), `mode`, `tier`, `adaptive`, `targetFps`, `defer`.
The canvas should be `position:fixed; inset:0` behind the content.
It clears to transparent, so the page ground shows through.
**Light chapters:** the lattice switches to ink lines. They are only visible if the paper colour is painted *beneath* the canvas, for example a body/html background that switches per chapter (the demo does this). An opaque paper section will cover it.

## Chapter ids
`top, environment, challenge, company, capabilities, approach, commitment, contact`
I took these verbatim from the original site's `data-chapter` attributes. They match the `id`s and the chapter rail `#rail li[data-for]` (01–08), in page order.
`approach` and `commitment` are the light/paper chapters (`lightChapters` in the original main.js). Unknown ids fall back to `company`'s preset.

| id | background preset |
|---|---|
| top | hidden (the hero owns the lattice) |
| environment | tilt 58°, drift up, cyan traffic, node dots |
| challenge | sparse, rotated −4°, red-led "seam" accents, more pulses |
| company | flat, lit nodes (convergence) |
| capabilities | dense, tilt 40°, sideways drift, the most traffic |
| approach | ink on paper, tilt 30° |
| commitment | ink on paper, very sparse and calm |
| contact | steep 62° horizon, forward drift |

## Deterministic render mode (hero)
```js
const hero = init(canvas, { render: { fps: 30, duration: 10 /*, width: 3840 */ } });
await hero.ready;
for (let f = 0; f < 300; f++) { hero.renderFrame(f / 30); /* grab canvas */ }
```
- Turns off the rAF loop, the adaptive tiers/governor, ScrollTrigger and the idle deferral. Quality is fixed at tier `high` (bloom, full dust, MSAA 4) unless `tier` is passed. Reduced-motion and device checks are skipped, because this is a capture tool.
- `renderFrame(t)`: t is in seconds. It renders synchronously, so read the canvas (`toDataURL`/`toBlob`) in the same task. The output is a pure function of t. **It is seamless at t = duration**, because frame(duration) equals frame(0). The dust uses whole-number cycles per loop.
- Loop timeline as a fraction of the duration:
  - 0–38%: intro. Poster frame → lattice and fortress lines draw on, the camera rises, the mark rebuilds in 3D.
  - 38–76%: scroll 0→1. Extrude, orbit, push-in, the fortress opens, the mark stands up.
  - 76–100%: eased rewind to the poster frame, with zero velocity at both ends.
- `width` (optional) is the exact drawing-buffer width in px, for example 3840 on a 1920×1080 canvas gives 4K. Without it, `pixelRatio` or devicePixelRatio is used, with no DPR cap.
- `controller.render` returns `{fps, duration, width, frames}`.
- Demo: `?render=30x10x3840` mounts only the hero in this mode and hides the placeholder copy.

## Framing (desktop + mobile)
`src/core/layout.js` and `poster/poster.css` hold the same numbers.
- **Desktop (>900px).**
  - The mark is `min(34vw, 560px, 56vh)` wide and centred at 74% / 47%. That keeps it clear of a left-column H1 (the left ~45%), with room for the C / I / A labels around it.
  - `box` = x 0.53–0.96, y 0.10–0.92.
  - Every frame, the hero projects the mark's vertices plus the fortress and accent extents. If anything would leave the box, it pulls the camera back or re-centres.
  - Measured across all 300 frames of the 10 s loop, the leftmost extent was **53.0% of the width**.
- **Mobile (≤900px).**
  - The mark is `min(50vw, 300px, 27vh)` wide, starting 80px from the top.
  - `box` = top third (y ≤ 0.34). The lattice and guides are shortened (`latticeR` 15, `guideR` 13), so the text area below stays clear.
- Fortress and accent points join the fit only as they draw on, so the opening frame still equals the poster.
- The long construct guides (desktop) and the lattice are environment, like the original's construct lines, and may cross the H1 at low alpha.

## What the hero does
State is a pure function of `(intro, progress)`, so scrubbing is exact in both directions.
1. **Poster frame.** The flat mark plus its triangle construct guides, seen top-down. This is the same picture as the static poster, at the same position (see Framing).
2. **Intro (3.6 s, on load).** The ground lattice draws on outward from the centre, segment by segment, with bright leading tips. The camera rises off the page into a 3/4 view. Fortress construct lines draw (wall plates, hex bastions, a stepped triangular keep). Plates begin to extrude and fill. Cyan corner verticals and convergence rays plus a red plan outline draw last. The 8 mark pieces lift along the original site's own 30°/60° assembly vectors, gain extruded depth, re-seat, and tilt halfway up.
3. **Scroll.** Plates extrude to full height and fill. The camera orbits about 53° and pushes in. From 55% the fortress opens: wall plates hinge outward with a stagger, bastions slide out, keep tiers lift and twist, and a cyan ring runs across the lattice. The mark stands up and turns to face the viewer.

Bloom is UnrealBloomPass with threshold 0.62, so only accent lines (HDR >1) glow. The mark fills and grey lines do not. Fine dust is up to 1,400 additive points.

## Quality and fallbacks
- **Tiers** (`src/core/env.js`), from cores, deviceMemory, coarse pointer + small screen, and the WebGL renderer string. Software renderers (SwiftShader/llvmpipe) are tier `low`.
  - high: bloom on, full dust, MSAA 4, DPR cap 1.5
  - mid: bloom on, 50% dust, background at 0.75 resolution, DPR cap 1.25
  - low: no bloom, no dust, background at 0.5 resolution, DPR cap 1
  - Mobile DPR cap is always ≤ 1.25.
- **Runtime governor** (`src/core/governor.js`). One shared rAF loop for both modules. Average FPS is measured after a warm-up, over a window of 90 rendered frames or 1.5 s, whichever closes first. Below 55 it steps **down only**, one step at a time with settle time in between: bloom off → dust 40% → dust off → background res 0.75 → 0.5 + sparser lattice → hero res 0.75 → DPR 1. The log is at `window.__ckMotion.governor.log`.
- **Pausing.** The hero pauses offscreen (IntersectionObserver) and skips re-rendering a static scene. The background skips rendering when its chapter alpha is 0 or the tab is hidden.
- **Poster-first.** Inline `poster/poster.html` + `poster/poster.css` in the hero stage. They are pure SVG/CSS with no JS and cost about 2 KB. WebGL mounts after first paint + idle, starts at opacity 0, and fades in after its first rendered frame. The poster is hidden only after that.
- **2D fallback** (SVG + CSS, no rAF, no infinite animations). Used for Save-Data, 2G, a weak device (≤2 cores or ≤2 GB), no WebGL2, a GL init error, or a `webglcontextlost` event (live swap).
  - Hero: lattice tile, guides draw, the mark assembles along its vectors, scroll drives a CSS variable.
  - Background: an SVG lattice tile on a CSS-tilted plane that morphs per chapter through transitions.
- **prefers-reduced-motion.** `init` returns a no-op controller and loads nothing. If the preference turns on mid-session, the controller destroys itself and the poster comes back.

## Palette (verified from the original `styles.css :root` and brand SVGs)
ink `#07090d`, ink-2 `#0b0f16`, graphite `#111620`/`#171d29`, line `rgba(160,174,196,.13/.24)`, mute `#7d8798`/`#a3acba`, soft `#e9edf2`, white `#f6f8fa`, **red `#e92830`**, **cyan `#1aaae4`**, paper `#eceef1`, paper-ink `#0b0f16`.
Fonts: Archivo (display), IBM Plex Sans (body), IBM Plex Mono (labels).

## Demo
```
cd /workspace/cyberking/motion
npm run build && npm run preview     # http://127.0.0.1:4791/
npm run dev                          # http://127.0.0.1:4792/
```
Query params: `?motion=2d|off`, `?tier=high|mid|low`, `?adaptive=0`, `?hud` (mode/tier/fps/governor overlay), `?film=0` (SVG poster → WebGL, no film), `?copy=placeholder` (old placeholder blocks), `?render=30x10x3840` (capture).
The demo uses the live site's copy verbatim by default (hero eyebrow, H1, lede, CTAs and meta row; each chapter's eyebrow, headline and first paragraph, taken from `original/index.html`). There is no nav or footer, because the Designer owns the page DOM.
`demo/public/video` is a symlink to `../../video`, so `vite build` copies the loops and posters into `dist/video/`.
Port 4173 is used by another process on the box and was left alone.

## Measurements (headless, software-rendered, on the shared box; NOT real devices)
These were measured with headless Chrome using SwiftShader. There is no GPU, so tier detection picks `low` on its own.
Each config is one run (n=1) in a fresh context with the cache disabled, against the production build on `vite preview`.
FPS is sampled from rAF deltas during a scripted 14 s scroll from top to bottom, after the 3.6 s intro.
LCP is read before scrolling. Raw JSON: `perf/perf-auto.json` and `perf/perf-forced-high.json`. Scripts: `perf/scripts/`.
Results vary noticeably between runs on this box.

JS (gzip -9): the entry is about 3.5 KB and includes the demo wiring; nothing heavy loads before idle. Lazy chunks:
- WebGL path: three 128.2 KB + gsap 44.1 KB + hero-gl about 6 KB + bg-gl 3.5 KB + core about 1.5 KB ≈ 184 KB.
- 2D path: gsap + about 4 KB.

## Video (`video/`)
All loops are rendered with `init(canvas, { render: { fps: 30, duration: 10, width } })` and `renderFrame(t)` at tier high (bloom, full dust, MSAA). They are seamless: frame(t = 10 s) equals frame(0) pixel for pixel (max channel difference 0, checked on the rendered PNGs for both the desktop and mobile renders).

| file | codec | size | resolution | duration |
|---|---|---|---|---|
| `hero-loop-mobile-1080x1920-30fps-10s.mp4` | H.264 two-pass 1750k | 2,152,906 B | 1080×1920 | 10.0 s / 300 frames |
| `hero-loop-mobile-1080x1920-30fps-10s.webm` | VP9 two-pass 1650k | 2,064,701 B | 1080×1920 | 10.0 s / 300 frames |
| `hero-loop-1920x1080-30fps-10s.mp4` | H.264 CRF 18 | 9,495,995 B | 1920×1080 | 10.0 s / 300 frames |
| `hero-loop-1920x1080-30fps-10s.webm` | VP9 CRF 30 | 6,479,011 B | 1920×1080 | 10.0 s / 300 frames |
| `hero-loop-3840x2160-30fps-10s.mp4` | H.264 CRF 17 | 26,230,997 B | 3840×2160 | 10.0 s / 300 frames |
| `hero-loop-3840x2160-30fps-10s.webm` | VP9 CRF 32 | 15,004,616 B | 3840×2160 | 10.0 s / 300 frames |
| `hero-poster-mobile-1080x1920.{jpg,avif}` | JPEG q82 / AVIF q55 | 22,055 / 6,635 B | 1080×1920 | |
| `hero-poster-1920x1080.{jpg,avif}` | | 28,600 / 7,565 B | 1920×1080 | |
| `hero-poster-3840x2160.{jpg,avif}` | | 74,962 / 16,228 B | 3840×2160 | |
| `*-frame0-*.png` | lossless frame 0 (poster source) | | | |

The 1080p files are downscaled (lanczos) from the 4K frames. Desktop renders use the 1920×1080 CSS viewport at pixel ratio 2, so lines are 2–3 device px at 4K.
Framing checks: across the 300 desktop frames the leftmost solid mark pixel is at 57.1% of the width (frame 249). The render bbox gives 56.6% for the mark alone and 53.0% for mark + fortress + accents. On mobile the mark + fortress sit in y 7.7–34.0% (render bbox), and only one red accent dash reaches 35.1%.

### Film layer: `video-snippet.html`
Poster `<picture>` (AVIF/JPG, mobile and desktop art) → `<video muted loop playsinline>` with `<source media>`: ≤900px gets the vertical cut, ≥2400px gets 4K, everything else gets 1080p, with WebM before MP4. A small script also picks the source for engines that ignore `media` on `<video>`.
- The video loads only after `load` + idle, and never under `prefers-reduced-motion` or Save-Data, where the poster stays. It fades in once it is `playing`.
- On the first scroll, `hero.reveal()` crossfades to the live WebGL hero (`init(canvas, { poster: film, hold: true })`), and the video is paused after the fade.
- The demo uses the same logic (`demo/film.js`). `?film=0` turns it off.
- Caveat: with `object-fit: cover` the film is cropped differently from the live layout on non-16:9 (desktop) or non-9:16 (mobile) viewports. At 1440×900 the film mark sits a few % right of, and larger than, the live hero's, so the C/I/A labels (placed from `defaultLayout`) touch the film mark's corners. The crossfade hides the jump.
