/*
 * Cyber King Services: preview entry.
 * Order of operations:
 *   1. CSS + fonts paint the hero (H1 = LCP) with the inline SVG poster.
 *   2. UI (nav, menu, rail, form) and GSAP choreography wire up.
 *   3. After `load` + idle, the motion layer lazy-loads per tier:
 *        full   → src/motion/background.js (raw WebGL) + src/motion/hero.js (three.js)
 *        lite   → src/motion/lite2d.js (2D canvas background), poster hero
 *        static → nothing (prefers-reduced-motion)
 */
import "@fontsource/ibm-plex-sans/latin-300.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/fonts.css";
import "./styles/poster.css";
import "./styles/main.css";
import "./a11y/reduced-motion-guard.js"; // live reduced-motion switch (perf/a11y)

import { initUI } from "./ui/ui.js";
import { initRail } from "./ui/rail.js";
import { buildStack } from "./ui/stack.js";
import { initForm } from "./ui/form.js";
import { CHAPTERS, LIGHT, chapterBus } from "./ui/chapters.js";

const root = document.documentElement;
let tier = root.dataset.tier || "full";
const isMobile = matchMedia("(max-width: 960px), (pointer: coarse)").matches;

initUI();
initForm();
buildStack(document.getElementById("stack"));
initRail(document.getElementById("rail"));

// ---------- Choreography (GSAP) ----------
if (tier !== "static") {
  // Choreography is below-the-fold work: wire it after load + idle so it stays out of the LCP/TBT window.
  const startChoreo = () => import("./ui/choreo.js").then((m) => m.initChoreo({ tier, isMobile }));
  if (document.readyState === "complete") ("requestIdleCallback" in window ? requestIdleCallback(startChoreo, { timeout: 800 }) : setTimeout(startChoreo, 0));
  else addEventListener("load", () => ("requestIdleCallback" in window ? requestIdleCallback(startChoreo, { timeout: 800 }) : setTimeout(startChoreo, 0)), { once: true });
} else {
  // Static: chapter tracking without scroll scrubbing.
  import("./ui/chapters-static.js").then((m) => m.trackChapters());
  import("./ui/instrument.js").then((m) => { const inst = m.initInstrument(document.getElementById("instCanvas")); inst.set("cyber"); });
}

// ---------- Motion layer ----------
// __CK_MOTION__ is "external" (3D engineer's modules under /workspace/cyberking/motion/src, which do their own tiering,
// deferral, 2D fallback and reduced-motion no-op) or "standin" (this repo's src/motion/standin/*).
const MOTION_KIND = typeof __CK_MOTION__ !== "undefined" ? __CK_MOTION__ : "standin";
const idle = (fn) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
const afterLoad = (fn) => (document.readyState === "complete" ? idle(fn) : addEventListener("load", () => idle(fn), { once: true }));

const heroEl = document.getElementById("top");
let bg = null;
let hero = null;
const heroProgress = () => Math.min(1, Math.max(0, scrollY / Math.max(1, heroEl.offsetHeight - innerHeight)));

async function startLite(reason) {
  if (reason) console.info("[cyberking] lite motion:", reason);
  root.dataset.tier = tier = "lite";
  if (hero) { try { hero.destroy(); } catch (_) {} hero = null; }
  heroEl.classList.remove("gl-on");
  if (bg && bg.kind === "lite") return;
  if (bg) { try { bg.destroy(); } catch (_) {} }
  const old = document.getElementById("bg");
  const fresh = old.cloneNode(false); // a canvas that had a WebGL context cannot become 2D
  old.replaceWith(fresh);
  const m = await import("./motion/standin/lite2d.js");
  bg = m.init(fresh, { isMobile });
  bg.kind = "lite";
  bg.setChapter(chapterBus.current);
  fresh.classList.add("is-on");
}

async function startStandin() {
  const bgCanvas = document.getElementById("bg");
  const heroCanvas = document.getElementById("heroCanvas");
  try {
    const B = await import("./motion/background.js");
    bg = await B.init(bgCanvas, { dprCap: isMobile ? 0.75 : 1, onContextLost: () => startLite("background context lost") });
    bg.kind = "gl";
    bg.setChapter(chapterBus.current);
    bgCanvas.classList.add("is-on");
  } catch (e) { return startLite(e.message); }
  try {
    const H = await import("./motion/hero.js");
    hero = await H.init(heroCanvas, {
      dprCap: isMobile ? 1.5 : 2,
      quality: /[?&]quality=low/.test(location.search) || isMobile ? "low" : "high",
      onFirstFrame: () => heroEl.classList.add("gl-on"),
      onContextLost: () => startLite("hero context lost"),
    });
    hero.setChapter(chapterBus.current);
    const onScroll = () => hero && hero.setProgress(heroProgress());
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  } catch (e) {
    console.warn("[cyberking] hero failed", e);
    heroEl.classList.remove("gl-on");
  }
}

/**
 * Hero composition. One measured box drives everything so the mark never crosses the copy column:
 *   - M (the "mark zone") sits between the right edge of the hero copy and the right gutter, above the stat strip.
 *   - The rendered video is scaled/positioned so the union of the mark across the whole loop fills M.
 *   - The live scene's first frame (layout.focus0/markPx) and the SVG poster land on the video's frame 0.
 *   - The C / I / A labels are anchored to M's corners (as on the original site: top-left, top-right, bottom).
 * Video mark bounds, measured from hero-loop-1920x1080 (normalised to the frame): see VIDEO_U / VIDEO_F0.
 */
// Mark bounds inside the clip (0..1 of the frame). Defaults = hero-loop-1920x1080 v1; the build measures every clip and
// writes markUnion/markF0 into video-manifest.json, which replaces these once the manifest is read (setVideoMeta).
let VMETA = (typeof __CK_VMETA__ !== "undefined" && __CK_VMETA__) || { union: [0.462, 0.133, 0.91, 0.889], f0: [0.512, 0.152, 0.883, 0.785], size: [1920, 1080] };
let VMETA_MOBILE = (typeof __CK_VMETA_MOBILE__ !== "undefined" && __CK_VMETA_MOBILE__) || null; // only set when a portrait cut exists
function setVideoMeta(v) {
  if (!v || !v.markUnion || !v.markF0) return;
  const m = { union: v.markUnion, f0: v.markF0, size: v.size || [1920, 1080] };
  if (v.mobile) VMETA_MOBILE = m; else VMETA = m;
}
const stageEl = heroEl.querySelector(".hero__stage");
let lastBox = null;

function textRight() {
  const st = stageEl.getBoundingClientRect();
  let r = 0;
  heroEl.querySelectorAll(".hero__eyebrow, .hero__title, .hero__lede, .hero__actions").forEach((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    for (const q of range.getClientRects()) if (q.width > 0) r = Math.max(r, q.right - st.left);
  });
  return r;
}

/** Fit the clip so the union of the mark fills zone (x0..x1, y0..y1); return video rect + frame-0 mark. */
function frameVideo(meta, x0, x1, y0, y1, maxW) {
  const [u0, v0, u1, v1] = meta.union, [fw, fh] = meta.size;
  const uAspect = ((u1 - u0) * fw) / ((v1 - v0) * fh);
  const Mw = Math.max(80, Math.min(x1 - x0, (y1 - y0) * uAspect, maxW));
  const Mh = Mw / uAspect;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const Vw = Mw / (u1 - u0), Vh = (Vw * fh) / fw;
  const vx = cx - ((u0 + u1) / 2) * Vw, vy = cy - ((v0 + v1) / 2) * Vh;
  const f = meta.f0;
  return {
    M: { x: cx - Mw / 2, y: cy - Mh / 2, w: Mw, h: Mh },
    V: { x: vx, y: vy, w: Vw, h: Vh },
    markPx: (f[2] - f[0]) * Vw,
    cx: vx + ((f[0] + f[2]) / 2) * Vw,
    cy: vy + ((f[1] + f[3]) / 2) * Vh,
  };
}

function computeBox(w, h) {
  if (w <= 900) {
    const mw = Math.min(0.76 * w, 440), mh = (mw * 180) / 186;
    if (VMETA_MOBILE && h > w) {
      // Portrait cut: union of the mark fills the slot above the eyebrow.
      const st = stageEl.getBoundingClientRect();
      const eb = heroEl.querySelector(".hero__eyebrow");
      const yMax = (eb ? eb.getBoundingClientRect().top - st.top : 92 + mh) - 34;
      const fr = frameVideo(VMETA_MOBILE, (w - mw) / 2, (w + mw) / 2, 92, Math.max(92 + mh * 0.6, yMax), mw);
      // Phones: keep the cut full-bleed horizontally (no side fades), shifting the whole composition if needed.
      const dx = fr.V.w >= w ? Math.min(0, Math.max(w - fr.V.w, fr.V.x)) - fr.V.x : (w - fr.V.w) / 2 - fr.V.x;
      fr.V.x += dx; fr.M.x += dx; fr.cx += dx;
      return { mobile: true, w, h, ...fr };
    }
    // Mobile without a portrait cut: the motion package default (mark centred above the copy).
    const cy = 64 + 28 + mh / 2;
    return { mobile: true, w, h, markPx: mw, cx: w / 2, cy, M: { x: w / 2 - mw / 2, y: cy - mh / 2, w: mw, h: mh } };
  }
  const st = stageEl.getBoundingClientRect();
  const nav = document.getElementById("nav");
  const strip = heroEl.querySelector(".hero__strip");
  const x0 = textRight() + Math.max(40, 0.03 * w);
  const x1 = w - Math.max(56, 0.05 * w);
  const y0 = (nav ? nav.offsetHeight : 72) + 44; // room for the C / I labels
  const stripTop = strip ? strip.getBoundingClientRect().top - st.top : h - 96;
  const y1 = Math.min(h, stripTop) - 40; // room for the A label
  // Preferred: the clip full-bleed (object-fit: cover), if its mark already stays clear of the copy column.
  {
    const [fw, fh] = VMETA.size, sc = Math.max(w / fw, h / fh), Vw = fw * sc, Vh = fh * sc;
    const vx = (w - Vw) / 2, vy = (h - Vh) / 2, u = VMETA.union, f = VMETA.f0;
    const ux0 = vx + u[0] * Vw, ux1 = vx + u[2] * Vw, uy0 = vy + u[1] * Vh, uy1 = vy + u[3] * Vh;
    if (ux0 >= x0 + 0.03 * w && ux1 <= w - 24 && uy0 >= y0 - 20) {
      return {
        mobile: false, cover: true, w, h, zone: { x0: ux0, x1: ux1 },
        M: { x: ux0, y: uy0, w: ux1 - ux0, h: Math.min(uy1, h) - uy0 }, V: { x: vx, y: vy, w: Vw, h: Vh },
        markPx: (f[2] - f[0]) * Vw, cx: vx + ((f[0] + f[2]) / 2) * Vw, cy: vy + ((f[1] + f[3]) / 2) * Vh,
      };
    }
  }
  // Otherwise scale the clip down so the mark's full range of motion fits between the copy and the right gutter.
  return { mobile: false, w, h, zone: { x0, x1 }, ...frameVideo(VMETA, x0, x1, y0, y1, 0.92 * h) };
}

function applyBox(b) {
  lastBox = b;
  const s = heroEl.style;
  s.setProperty("--mk-w", b.markPx.toFixed(1) + "px");
  s.setProperty("--mk-x", (b.cx - b.markPx / 2).toFixed(1) + "px");
  s.setProperty("--mk-cy", b.cy.toFixed(1) + "px");
  s.setProperty("--mb-x", b.M.x.toFixed(1) + "px");
  s.setProperty("--mb-y", b.M.y.toFixed(1) + "px");
  s.setProperty("--mb-w", b.M.w.toFixed(1) + "px");
  s.setProperty("--mb-h", b.M.h.toFixed(1) + "px");
  if (b.V) {
    s.setProperty("--v-x", b.V.x.toFixed(1) + "px");
    s.setProperty("--v-y", b.V.y.toFixed(1) + "px");
    s.setProperty("--v-w", b.V.w.toFixed(1) + "px");
    s.setProperty("--v-h", b.V.h.toFixed(1) + "px");
  }
  heroEl.classList.add("has-layout");
  heroEl.classList.toggle("is-mobile-layout", b.mobile);
  heroEl.classList.toggle("has-vframe", !!b.V);
  heroEl.classList.toggle("v-cover", !!b.cover);
  heroEl.classList.toggle("annot-side", !!b.cover && b.M.y + b.M.h > b.h - 64);
}

function relayout() {
  const r = stageEl.getBoundingClientRect();
  applyBox(computeBox(r.width, r.height));
}
// Measure once the display face is in (it is preloaded), so the mark is placed once and never shifts (CLS).
// Until then the poster mark is hidden by CSS (.hero:not(.has-layout)).
let laidOut = false;
const firstLayout = () => { if (laidOut) return; laidOut = true; relayout(); if (hero && hero.resize) hero.resize(); };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(firstLayout);
setTimeout(firstLayout, 1200);
let rlT = 0;
addEventListener("resize", () => { cancelAnimationFrame(rlT); rlT = requestAnimationFrame(relayout); });

function heroLayout(w, h) {
  if (!lastBox) relayout();
  const b = lastBox && Math.abs(lastBox.w - w) < 2 && Math.abs(lastBox.h - h) < 2 ? lastBox : computeBox(w, h);
  if (b.mobile) return { markPx: b.markPx, focus0: [b.cx / w, b.cy / h], focus1: [0.5, 0.33], frac: 0.92 };
  // Risen fortress stays inside the same right-hand zone, so it never crosses the copy while the copy is visible.
  const zx = (b.zone.x0 + b.zone.x1) / 2;
  return { markPx: b.markPx, focus0: [b.cx / w, b.cy / h], focus1: [zx / w, 0.5], frac: Math.min(0.46, ((b.zone.x1 - b.zone.x0) / w) * 0.95) };
}

async function startExternal() {
  // Their init() is synchronous and defers its own heavy loading until after first paint + idle.
  const [H, B] = await Promise.all([import("./motion/hero.js"), import("./motion/background.js")]);
  const bgCanvas = document.getElementById("bg");
  bg = B.init(bgCanvas, { initialChapter: chapterBus.current });
  bg.kind = "external";
  bgCanvas.classList.add("is-on");
  root.classList.add("bg-live");
  hero = H.init(document.getElementById("heroCanvas"), {
    poster: document.getElementById("heroPoster"),
    trigger: heroEl,
    scrollStart: "top top",
    scrollEnd: "bottom bottom",
    layout: heroLayout,
    onFirstFrame: () => heroEl.classList.add("gl-on"),
  });
  hero.setChapter(chapterBus.current);
  heroEl.classList.add("ext-motion");
  window.__ckMotionCtl = { hero, bg };
}

// ---------- Hero video slot (renders from the motion engineer, if delivered) ----------
/**
 * Phones: paint the portrait cut through a <canvas> (same box, same fades) and keep the <video> element itself as a
 * tiny, near-transparent decoder. Reason: Chrome counts a playing <video> as an LCP candidate, so a clip that fades in
 * at ~2-4 s on a throttled phone would replace the hero text (already painted at ~1-2 s) as the LCP element even though
 * the SVG poster showing the same frame was there from first paint. Desktop keeps the plain <video>.
 */
function blitToCanvas(video) {
  const cv = document.createElement("canvas");
  cv.className = "hero__video hero__video--canvas";
  cv.setAttribute("aria-hidden", "true");
  video.after(cv);
  video.classList.add("hero__video--decoder");
  const ctx = cv.getContext("2d", { alpha: false });
  const size = () => {
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.max(2, Math.round(r.width * d)); cv.height = Math.max(2, Math.round(r.height * d));
  };
  size();
  addEventListener("resize", size);
  let raf = 0, lastT = -1;
  const draw = () => {
    raf = 0;
    if (video.readyState >= 2 && video.currentTime !== lastT) { lastT = video.currentTime; ctx.drawImage(video, 0, 0, cv.width, cv.height); }
    if (!video.paused) raf = requestAnimationFrame(draw);
  };
  video.addEventListener("play", () => { if (!raf) raf = requestAnimationFrame(draw); });
  video.addEventListener("seeked", () => { if (!raf) raf = requestAnimationFrame(draw); });
}

async function initHeroVideo() {
  const video = document.getElementById("heroVideo");
  if (!video || tier !== "full" || /[?&]video=0/.test(location.search)) return; // reduced motion: poster only, never autoplay
  let man;
  try { const r = await fetch("/motion/video/video-manifest.json", { cache: "no-store" }); if (!r.ok) return; man = await r.json(); } catch (_) { return; }
  if (!man.videos || !man.videos.length) return;
  const portrait = innerHeight > innerWidth;
  const saveData = navigator.connection && navigator.connection.saveData;
  const want = portrait ? 0 : innerWidth * Math.min(devicePixelRatio || 1, 2) > 2400 ? 2160 : 1080;
  let pool = man.videos.filter((v) => v.mobile === portrait);
  // No portrait encode yet: don't ship a 10 MB landscape film to phones; the live scene covers the hero.
  if (!pool.length && portrait) return;
  if (!pool.length) pool = man.videos;
  pool.sort((a, b) => Math.abs(a.res - want) - Math.abs(b.res - want) || (a.type === "video/webm" ? -1 : 1));
  const poster = (man.posters.find((p) => p.mobile === portrait) || man.posters[0] || {}).src;
  // No poster attribute: the inline SVG poster underneath already matches frame 0, and a late poster image would
  // become a new (late) LCP candidate. The clip fades in only once it is actually playing.
  void poster;
  // Prefer the closest resolution; offer webm + mp4 of that resolution.
  const best = pool.filter((v) => v.res === pool[0].res);
  const measured = best.filter((v) => v.markUnion && v.markF0);
  if (measured.length) {
    const u = measured.reduce((a, v) => [Math.min(a[0], v.markUnion[0]), Math.min(a[1], v.markUnion[1]), Math.max(a[2], v.markUnion[2]), Math.max(a[3], v.markUnion[3])], [1, 1, 0, 0]);
    setVideoMeta({ ...measured[0], markUnion: u });
  }
  relayout();
  if (hero && hero.resize) hero.resize();
  best.forEach((v) => { const so = document.createElement("source"); so.src = v.src; so.type = v.type; video.appendChild(so); });
  video.hidden = false;
  if (saveData) { video.hidden = true; return; } // save-data: keep the SVG poster + live scene, no download
  video.preload = "auto";
  if (portrait) blitToCanvas(video);
  video.addEventListener("playing", () => heroEl.classList.add("video-on"), { once: true });
  video.play().catch(() => {}); // autoplay refused: stay on the SVG poster / live scene
  // Crossfade into the live scroll scene as soon as scrolling starts; return to the film at the very top.
  const onScroll = () => {
    const live = scrollY > 24;
    heroEl.classList.toggle("is-live", live);
    if (live && !video.paused) video.pause();
    else if (!live && video.paused && !saveData) video.play().catch(() => {});
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

chapterBus.on((id) => {
  root.classList.toggle("bg-paper", LIGHT.has(id));
  if (bg) bg.setChapter(id);
  if (hero) hero.setChapter(id);
});

if (MOTION_KIND === "external" && tier !== "static") {
  startExternal();
} else if (tier === "full") afterLoad(startStandin);
else if (tier === "lite") afterLoad(() => startLite());
afterLoad(initHeroVideo);

// Debug hooks for screenshots/tests
window.__ck = { motion: MOTION_KIND, get tier() { return tier; }, get hero() { return hero; }, get bg() { return bg; }, CHAPTERS };
