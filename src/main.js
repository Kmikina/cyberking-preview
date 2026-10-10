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
import { CHAPTERS, chapterBus } from "./ui/chapters.js";

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
    const annots = [...document.querySelectorAll(".hero__annot")];
    hero = await H.init(heroCanvas, {
      dprCap: isMobile ? 1.5 : 2,
      quality: /[?&]quality=low/.test(location.search) || isMobile ? "low" : "high",
      onFirstFrame: () => heroEl.classList.add("gl-on"),
      onContextLost: () => startLite("hero context lost"),
      onAnchors: (pts) => pts.forEach((p, i) => {
        const el = annots[i];
        if (!el) return;
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(${i === 1 ? "12px" : i === 0 ? "calc(-100% - 12px)" : "-50%"}, ${i === 2 ? "14px" : "-50%"})`;
        el.classList.toggle("is-placed", p.visible);
      }),
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
 * Hero composition for the external scene. Must stay in sync with the .ckm-poster__mark overrides in main.css so
 * the first WebGL frame lands on the poster. Desktop: mark sits right of the copy column inside the 90rem wrap.
 * Mobile (≤900px): the motion package's default (centred, top).
 */
function heroLayout(w, h) {
  if (w <= 900) {
    const mw = Math.min(0.76 * w, 440);
    return { markPx: mw, focus0: [0.5, (64 + 28 + (mw * 180) / 186 / 2) / h], focus1: [0.5, 0.33], frac: 0.92 };
  }
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const gutter = Math.min(Math.max(rem, 0.04 * w), 3.5 * rem);
  const mw = Math.min(0.3 * w, 0.55 * h);
  const right = Math.max(gutter, (w - 90 * rem) / 2 + 0.02 * w);
  const cx = w - right - mw / 2;
  const cy = 0.5 * h - 0.04 * ((mw * 180) / 186);
  return { markPx: mw, focus0: [cx / w, cy / h], focus1: [Math.min(cx / w, 0.68), 0.52], frac: 0.46 };
}

async function startExternal() {
  // Their init() is synchronous and defers its own heavy loading until after first paint + idle.
  const [H, B] = await Promise.all([import("./motion/hero.js"), import("./motion/background.js")]);
  const bgCanvas = document.getElementById("bg");
  bg = B.init(bgCanvas, { initialChapter: chapterBus.current });
  bg.kind = "external";
  bgCanvas.classList.add("is-on");
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
async function initHeroVideo() {
  const video = document.getElementById("heroVideo");
  if (!video || tier !== "full") return; // reduced motion: poster only, never autoplay
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
  if (poster) video.poster = poster;
  // Prefer the closest resolution; offer webm + mp4 of that resolution.
  const best = pool.filter((v) => v.res === pool[0].res);
  best.forEach((v) => { const so = document.createElement("source"); so.src = v.src; so.type = v.type; video.appendChild(so); });
  video.hidden = false;
  if (saveData) { heroEl.classList.add("video-on"); return; } // poster frame only
  video.preload = "auto";
  video.addEventListener("playing", () => heroEl.classList.add("video-on"), { once: true });
  video.play().catch(() => heroEl.classList.add("video-on"));
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
