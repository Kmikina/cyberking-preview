/** Scroll choreography (GSAP + ScrollTrigger). Loaded only for full/lite tiers. */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CHAPTERS, chapterBus } from "./chapters.js";
import { initInstrument } from "./instrument.js";

gsap.registerPlugin(ScrollTrigger);

function splitWords(el, keyWords = []) {
  const text = el.textContent.trim();
  const words = text.split(/\s+/);
  el.innerHTML = "";
  // a11y: aria-label is prohibited on <p>; keep the sentence readable as one string via a visually-hidden copy.
  const sr = document.createElement("span");
  sr.textContent = text;
  sr.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0";
  el.appendChild(sr);
  return words.map((w, i) => {
    const s = document.createElement("span");
    s.className = "w" + (keyWords.some((k) => w.toLowerCase().startsWith(k)) ? " key" : "");
    s.setAttribute("aria-hidden", "true");
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    return s;
  });
}

export function initChoreo({ tier, isMobile }) {
  // ---------- 01 Hero: copy drifts up and dims as the citadel lifts ----------
  gsap.to(".hero__content", { yPercent: -14, opacity: 0, ease: "none", scrollTrigger: { trigger: "#top", start: "top top", end: "30% top", scrub: true } });
  gsap.fromTo(".hero__strip", { opacity: 1 }, { opacity: 0, immediateRender: false, ease: "none", scrollTrigger: { trigger: "#top", start: "2% top", end: "15% top", scrub: true } });

  // ---------- 02 Environment: pinned stack assembly ----------
  const stack = document.getElementById("stack")._stack;
  const steps = gsap.utils.toArray("#envSteps .step");
  const bar = document.getElementById("envProgress");
  if (stack) {
    const { plates, links, pulses, labels, tag } = stack;
    gsap.set(plates, { opacity: 0, y: (i) => 70 + i * 26 });
    gsap.set(labels, { opacity: 0, x: 18 });
    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      scrollTrigger: {
        trigger: "#environment", start: "top top", end: isMobile ? "+=220%" : "+=260%", pin: ".environment__sticky", scrub: 0.6,
        onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress.toFixed(3)})`; },
      },
    });
    // Step 1: plates rise into a stack
    tl.to(plates, { opacity: 1, y: 0, duration: 1, stagger: 0.14 }, 0)
      .to(labels, { opacity: 1, x: 0, duration: 0.6, stagger: 0.12 }, 0.35)
      // Step 2: dependencies draw upward, plate edges light in sequence
      .to(steps[0], { opacity: 0, y: -30, duration: 0.4 }, 1.7)
      .fromTo(steps[1], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 1.9)
      .to(links.filter((l) => !l.seam).map((l) => l.el), { strokeDashoffset: 0, duration: 0.5, stagger: 0.06, ease: "none" }, 1.9)
      .to(plates.map((p) => p.querySelector(".glow")), { opacity: 0.85, duration: 0.25, stagger: { each: 0.12, yoyo: true, repeat: 1 } }, 2.0)
      // Step 3: the seam ignites
      .to(steps[1], { opacity: 0, y: -30, duration: 0.4 }, 3.3)
      .fromTo(steps[2], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 3.5)
      .to(links.filter((l) => l.seam).map((l) => l.el), { strokeDashoffset: 0, duration: 0.4, ease: "none" }, 3.5)
      .to(tag, { opacity: 1, duration: 0.3 }, 3.7)
      .to(plates[2].querySelector(".glow"), { opacity: 1, stroke: "#e92830", duration: 0.3 }, 3.7)
      .to(plates[3].querySelector(".glow"), { opacity: 1, stroke: "#e92830", duration: 0.3 }, 3.75)
      .to({}, { duration: 0.6 });

    // Pulses climb the links continuously while the section is on screen
    const pulseTl = gsap.timeline({ repeat: -1, paused: true });
    pulses.forEach((p, k) => {
      pulseTl.fromTo(p.el, { attr: { cy: p.y1 }, opacity: 0 }, { attr: { cy: p.y2 + 8 }, opacity: 1, duration: 1.1, ease: "none" }, (k % 5) * 0.22 + (p.i * 0.1));
      pulseTl.to(p.el, { opacity: 0, duration: 0.2 }, ">-0.2");
    });
    ScrollTrigger.create({ trigger: "#environment", start: "top 60%", end: "bottom top", onToggle: (s) => (s.isActive ? pulseTl.play() : pulseTl.pause()) });
  }

  // ---------- 03 Challenge: statement lights word by word ----------
  const words = splitWords(document.getElementById("statement"), ["seams"]);
  gsap.fromTo(words, { opacity: (i, el) => (el.classList.contains("key") ? 0.75 : 0.42) }, { opacity: 1, stagger: 0.08, ease: "none", scrollTrigger: { trigger: "#statement", start: "top 80%", end: "bottom 45%", scrub: true } });
  gsap.utils.toArray(".triad__item").forEach((item, i) => {
    gsap.from(item, { y: 60, opacity: 0, duration: 1.1, delay: i * 0.12, ease: "power3.out", scrollTrigger: { trigger: ".triad", start: "top 85%" } });
    gsap.to(item, { "--w": "100%", duration: 1.2, delay: 0.2 + i * 0.12, ease: "power3.inOut", scrollTrigger: { trigger: ".triad", start: "top 85%" } });
    gsap.from(item.querySelector(".triad__k"), { yPercent: 40, scale: 0.9, transformOrigin: "left bottom", ease: "none", scrollTrigger: { trigger: item, start: "top bottom", end: "top 40%", scrub: true } });
  });

  // ---------- 04 Company: three sides converge into the mark ----------
  (function converge() {
    const root = document.getElementById("converge");
    const raysG = root.querySelector(".cv-rays");
    const V = [[70, 70], [530, 70], [300, 468]];
    const C = [300, 262];
    const rays = [];
    V.forEach(([x, y]) => {
      [-10, 0, 10].forEach((deg) => {
        const a = Math.atan2(C[1] - y, C[0] - x) + (deg * Math.PI) / 180;
        const len = Math.hypot(C[0] - x, C[1] - y) * 0.82;
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", x); l.setAttribute("y1", y);
        l.setAttribute("x2", (x + Math.cos(a) * len).toFixed(1)); l.setAttribute("y2", (y + Math.sin(a) * len).toFixed(1));
        l.setAttribute("stroke-dasharray", len.toFixed(1)); l.setAttribute("stroke-dashoffset", len.toFixed(1));
        raysG.appendChild(l); rays.push(l);
      });
    });
    const tri = root.querySelector(".cv-tri");
    const triIn = root.querySelector(".cv-tri--in");
    const triLen = tri.getTotalLength();
    gsap.set(tri, { strokeDasharray: triLen, strokeDashoffset: triLen });
    const pieces = gsap.utils.toArray("#converge .cv-p");
    const vec = [[-1, -0.577], [0, -1], [1, -0.577], [-1, 0], [-1, 0.577], [1, 0], [1, 0.577], [0, 1]];
    const tl = gsap.timeline({ scrollTrigger: { trigger: "#company", start: "top 75%", end: "center 45%", scrub: 0.8 } });
    tl.to(tri, { strokeDashoffset: 0, duration: 1, ease: "none" }, 0)
      .from("#converge .cv-nodes circle", { scale: 0, transformOrigin: "center", transformBox: "fill-box", stagger: 0.1, duration: 0.3 }, 0.1)
      .from("#converge .cv-labels text", { opacity: 0, y: 8, stagger: 0.1, duration: 0.3 }, 0.2)
      .to(rays, { strokeDashoffset: 0, stagger: 0.03, duration: 0.6, ease: "power2.in" }, 0.3)
      .from(triIn, { opacity: 0, scale: 1.3, transformOrigin: "center", transformBox: "fill-box", duration: 0.6 }, 0.6)
      .from(pieces, { x: (i) => vec[i][0] * 140, y: (i) => vec[i][1] * 140, opacity: 0, rotate: (i) => (i % 2 ? 30 : -30), stagger: 0.05, duration: 0.8, ease: "power3.out" }, 0.7)
      .to(rays, { opacity: 0.25, duration: 0.4 }, 1.4);
    gsap.from(".company__copy > *", { y: 40, opacity: 0, stagger: 0.08, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".company__copy", start: "top 80%" } });
  })();

  // ---------- 05 Capabilities: sticky instrument follows the active discipline ----------
  const inst = initInstrument(document.getElementById("instCanvas"));
  const caps = gsap.utils.toArray(".cap");
  const instId = document.getElementById("instId"), instName = document.getElementById("instName");
  const ticks = [...document.querySelectorAll("#instTicks li")];
  function setCap(i) {
    caps.forEach((c, k) => c.classList.toggle("is-active", k === i));
    ticks.forEach((t, k) => t.classList.toggle("is-on", k <= i));
    instId.textContent = String(i + 1).padStart(2, "0");
    instName.textContent = caps[i].dataset.name;
    inst.set(caps[i].dataset.cap);
  }
  setCap(0);
  caps.forEach((c, i) => {
    ScrollTrigger.create({ trigger: c, start: "top 55%", end: "bottom 55%", onToggle: (s) => s.isActive && setCap(i) });
    gsap.from(c.querySelectorAll(".cap__items li"), { opacity: 0, x: -14, stagger: 0.04, duration: 0.6, ease: "power2.out", scrollTrigger: { trigger: c, start: "top 70%" } });
  });
  ScrollTrigger.create({ trigger: "#capabilities", start: "top bottom", end: "bottom top", onToggle: (s) => inst.run(s.isActive) });
  gsap.from(".caps__head > *", { y: 40, opacity: 0, stagger: 0.1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".caps__head", start: "top 80%" } });
  gsap.from(".also article", { y: 40, opacity: 0, stagger: 0.12, duration: 1, ease: "power3.out", scrollTrigger: { trigger: "#capsAlso", start: "top 85%" } });

  // ---------- 06 Approach: path draws through five phases ----------
  const path = document.getElementById("path");
  const lis = [...path.children];
  gsap.to(path, {
    "--path": 1, ease: "none",
    scrollTrigger: {
      trigger: path, start: "top 75%", end: isMobile ? "bottom 60%" : "top 30%", scrub: true,
      onUpdate: (s) => lis.forEach((li, i) => li.classList.toggle("is-on", s.progress > 0.02 && s.progress >= i / lis.length)),
    },
  });
  gsap.from(".approach__head > *", { y: 40, opacity: 0, stagger: 0.1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".approach__head", start: "top 80%" } });
  gsap.from(".approach", { clipPath: "polygon(0 14vw, 100% 0, 100% 100%, 0 100%)", ease: "none", scrollTrigger: { trigger: ".approach", start: "top bottom", end: "top 40%", scrub: true } });

  // ---------- 07 Commitment: the quote resolves word by word ----------
  const qWords = splitWords(document.getElementById("quote"));
  gsap.fromTo(qWords, { opacity: 0.5 }, { opacity: 1, stagger: 0.05, ease: "none", scrollTrigger: { trigger: "#quote", start: "top 80%", end: "bottom 50%", scrub: true } });

  // ---------- 08 Contact: outline title fills ----------
  gsap.fromTo(".contact__outline", { backgroundPosition: "100% 0" }, { backgroundPosition: "0% 0", ease: "none", scrollTrigger: { trigger: ".contact__title", start: "top 85%", end: "bottom 45%", scrub: true } });
  gsap.from(".contact__title > span:first-child", { xPercent: -12, opacity: 0, ease: "none", scrollTrigger: { trigger: ".contact__title", start: "top bottom", end: "top 50%", scrub: true } });
  gsap.from(".contact__direct > *, .brief", { y: 40, opacity: 0, stagger: 0.1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".contact__grid", start: "top 85%" } });

  // ---------- Chapter tracking (created last so pin spacing above is accounted for) ----------
  CHAPTERS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el, start: "top 40%", end: "bottom 40%",
      onToggle: (self) => { if (self.isActive) chapterBus.set(id); },
    });
  });

  ScrollTrigger.sort();

  // Fonts can shift layout: refresh once they settle.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  return { tier };
}
