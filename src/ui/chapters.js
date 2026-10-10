export const CHAPTERS = ["top", "environment", "challenge", "company", "capabilities", "approach", "commitment", "contact"];
export const LIGHT = new Set(["approach", "commitment"]);

const subs = new Set();
export const chapterBus = {
  current: "top",
  on(fn) { subs.add(fn); return () => subs.delete(fn); },
  set(id) {
    if (!id || id === this.current) return;
    this.current = id;
    subs.forEach((fn) => fn(id));
  },
};
