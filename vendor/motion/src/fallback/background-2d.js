// 2D background fallback: the same isometric lattice as an SVG tile on a CSS
// plane. Chapters morph density / tilt / opacity / ink colour with CSS
// transitions only (no infinite animations, no rAF) — friendly to Save-Data
// and weak devices.
import { latticeTile, injectStyle } from './shared.js';
import { BG_PRESETS } from '../core/chapters.js';
import { PALETTE } from '../core/palette.js';

const CSS = `
.ckm-bg2d{inset:0;overflow:hidden;pointer-events:none;perspective:1100px;perspective-origin:50% 30%;
  -webkit-mask-image:radial-gradient(120% 90% at 50% 45%,#000 40%,transparent 100%);mask-image:radial-gradient(120% 90% at 50% 45%,#000 40%,transparent 100%)}
.ckm-bg2d__plane{position:absolute;inset:-60% -40%;transform-origin:50% 50%;
  transform:rotateX(var(--tilt,0deg)) rotate(var(--rot,0deg)) scale(var(--scale,1));
  transition:transform 1.6s cubic-bezier(.65,0,.35,1),opacity 1.6s ease;opacity:var(--a,0)}
.ckm-bg2d__ink,.ckm-bg2d__dark{position:absolute;inset:0;transition:opacity 1.6s ease}
.ckm-bg2d__ink{opacity:var(--light,0)}
.ckm-bg2d__dark{opacity:calc(1 - var(--light,0))}
.ckm-bg2d__acc{position:absolute;left:0;right:0;height:1px;opacity:var(--acc,0);transition:opacity 1.6s ease;
  background:linear-gradient(90deg,transparent,var(--c) 45%,var(--c) 55%,transparent)}
`;

export function create(canvas, opts, info) {
  injectStyle('ckm-bg2d-css', CSS);
  const presets = { ...BG_PRESETS, ...(opts.presets || {}) };
  const cs = getComputedStyle(canvas);
  const root = document.createElement('div');
  root.className = 'ckm-bg2d';
  root.setAttribute('aria-hidden', 'true');
  root.style.position = cs.position === 'fixed' ? 'fixed' : 'absolute';
  root.style.zIndex = cs.zIndex;
  const S = 64;
  const dark = latticeTile(S, '#a0aec4', 0.16);
  const ink = latticeTile(S, PALETTE.paperInk, 0.12);
  const acc = [[0.38, PALETTE.cyan, 0], [0.55, PALETTE.red, 60], [0.62, PALETTE.cyan, -60]]
    .map(([y, c, r]) => `<i class="ckm-bg2d__acc" style="top:${y * 100}%;--c:${c};transform:rotate(${r}deg)"></i>`).join('');
  root.innerHTML = `<div class="ckm-bg2d__plane">
    <div class="ckm-bg2d__dark" style="background-image:${dark.url};background-size:${dark.w}px ${dark.h}px"></div>
    <div class="ckm-bg2d__ink" style="background-image:${ink.url};background-size:${ink.w}px ${ink.h}px"></div>${acc}</div>`;
  canvas.style.opacity = '0';
  canvas.insertAdjacentElement('afterend', root);

  let current = null;
  function setChapter(id) {
    if (id === current) return;
    current = id;
    const p = presets[id] || presets.default;
    const st = root.style;
    st.setProperty('--tilt', `${p.tilt}deg`);
    st.setProperty('--rot', `${p.rot}deg`);
    st.setProperty('--scale', (p.spacing / S).toFixed(3));
    st.setProperty('--a', p.alpha.toFixed(3));
    st.setProperty('--light', String(p.light));
    st.setProperty('--acc', Math.min(0.5, p.accent * 6).toFixed(3));
  }
  setChapter(opts.initialChapter || 'top');
  opts.onFirstFrame && requestAnimationFrame(() => opts.onFirstFrame());
  return {
    setChapter, setProgress() {}, resize() {}, pause() {}, resume() {},
    seek({ chapter } = {}) { if (chapter) setChapter(chapter); },
    get state() { return { mode: '2d', chapter: current, reasons: info.reasons }; },
    destroy() { root.remove(); },
  };
}
