import { CHAPTERS, chapterBus } from "./chapters.js";
// Reduced-motion: decide the active chapter with an IntersectionObserver hairline at 40% height.
export function trackChapters() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) chapterBus.set(e.target.id); });
  }, { rootMargin: "-40% 0px -59% 0px" });
  CHAPTERS.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}
