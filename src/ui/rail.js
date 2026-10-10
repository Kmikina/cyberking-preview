import { CHAPTERS, LIGHT, chapterBus } from "./chapters.js";

/** Chapter rail: real links, active tick fills with in-chapter progress, counter, light inversion. */
export function initRail(rail) {
  if (!rail) return;
  const links = [...rail.querySelectorAll("a[data-for]")];
  const num = document.getElementById("railNum");
  const sections = CHAPTERS.map((id) => document.getElementById(id));

  function setActive(id) {
    links.forEach((a) => {
      const on = a.dataset.for === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
    });
    if (num) num.textContent = String(CHAPTERS.indexOf(id) + 1).padStart(2, "0");
    rail.classList.toggle("on-light", LIGHT.has(id));
  }
  chapterBus.on(setActive);
  setActive(chapterBus.current);

  // Per-chapter progress (0..1) drives each tick's fill. Cheap: one rect read per chapter per frame while scrolling.
  let ticking = false;
  function update() {
    ticking = false;
    const vh = innerHeight;
    rail.classList.toggle("is-visible", scrollY > vh * 0.5);
    sections.forEach((s, i) => {
      if (!s) return;
      const r = s.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.4 - r.top) / Math.max(1, r.height)));
      links[i].style.setProperty("--p", p.toFixed(3));
    });
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update);
  update();
}
