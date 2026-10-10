import { chapterBus } from "./chapters.js";

export function initUI() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // ---------- Mobile menu ----------
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("menu");
  let open = false, timer = 0;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function setMenu(next) {
    if (next === open) return;
    open = next;
    clearTimeout(timer);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
    // a11y: keep keyboard/AT focus inside the open menu
    ["main", "rail"].forEach((id) => { const el = document.getElementById(id); if (el) el.inert = open; });
    const foot = document.querySelector(".foot"); if (foot) foot.inert = open;
    if (open) {
      menu.hidden = false;
      void menu.offsetWidth;
      menu.classList.add("is-open");
      const first = menu.querySelector("a");
      if (first) first.focus({ preventScroll: true });
    } else {
      menu.classList.remove("is-open");
      timer = setTimeout(() => { if (!open) menu.hidden = true; }, reduced() ? 0 : 700);
    }
  }
  toggle.addEventListener("click", () => setMenu(!open));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) { setMenu(false); toggle.focus(); } });
  matchMedia("(min-width: 961px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  // ---------- In-page anchors: smooth scroll + focus management ----------
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    const go = () => {
      target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", "#" + id);
      const focusEl = id === "main" ? target : target;
      if (!focusEl.hasAttribute("tabindex")) focusEl.setAttribute("tabindex", "-1");
      focusEl.focus({ preventScroll: true });
    };
    if (open) { setMenu(false); setTimeout(go, reduced() ? 0 : 250); } else go();
  });

  // ---------- Nav: solid after leaving the top, hide on scroll down ----------
  const nav = document.getElementById("nav");
  let lastY = scrollY, ticking = false;
  function update() {
    const y = scrollY;
    nav.classList.toggle("is-solid", y > 40);
    const down = y > lastY + 4, up = y < lastY - 4;
    if (down && y > window.innerHeight * 0.8 && !nav.contains(document.activeElement) && !open) nav.classList.add("is-hidden");
    else if (up || y < 80) nav.classList.remove("is-hidden");
    lastY = y; ticking = false;
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));
  update();

  // ---------- Current nav link ----------
  const navLinks = [...document.querySelectorAll(".nav__links a")];
  chapterBus.on((id) => {
    navLinks.forEach((a) => {
      const on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("is-current", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
  });
}
