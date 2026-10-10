// 2D hero fallback (Save-Data, weak device, no WebGL, context loss).
// SVG + CSS only: lattice fades in, guides draw, the mark assembles along its
// own vectors (as on the original site), and scroll drives a gentle
// transform via a CSS variable. No rAF loop.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { latticeTile, markSVG, injectStyle } from './shared.js';
import { PALETTE } from '../core/palette.js';
import { defaultLayout } from '../core/layout.js';

gsap.registerPlugin(ScrollTrigger);

const CSS = `
.ckm-hero2d{position:absolute;inset:0;overflow:hidden;pointer-events:none;background:${PALETTE.ink};--p:0}
.ckm-hero2d__lat{position:absolute;inset:-20%;opacity:0;transition:opacity 1.6s ease .2s;
  -webkit-mask-image:radial-gradient(closest-side at var(--fx) var(--fy),#000 10%,transparent 85%);mask-image:radial-gradient(closest-side at var(--fx) var(--fy),#000 10%,transparent 85%);
  transform:translate3d(0,calc(var(--p) * -6%),0)}
.ckm-hero2d.is-on .ckm-hero2d__lat{opacity:1}
.ckm-hero2d__mark{position:absolute;transform:translate(-50%,-50%) scale(calc(1 + var(--p) * .14));transform-origin:50% 50%}
.ckm-hero2d__mark svg{width:100%;height:100%;overflow:visible}
.ckm-hero2d .ckm-mk{transform:translate(calc(var(--dx) * 46px),calc(var(--dy) * 46px));opacity:0;transition:transform 1.6s cubic-bezier(.2,.7,0,1) calc(var(--i) * 40ms),opacity 1.2s cubic-bezier(.2,.7,0,1) calc(var(--i) * 40ms)}
.ckm-hero2d.is-on .ckm-mk{transform:none;opacity:1}
.ckm-hero2d .ckm-guide{stroke-dasharray:2400;stroke-dashoffset:2400;transition:stroke-dashoffset 2.4s cubic-bezier(.65,0,.35,1)}
.ckm-hero2d.is-on .ckm-guide{stroke-dashoffset:0}
`;

export function create(canvas, opts, info) {
  injectStyle('ckm-hero2d-css', CSS);
  const parent = opts.fallbackParent || canvas.parentElement;
  const root = document.createElement('div');
  root.className = 'ckm-hero2d';
  root.setAttribute('aria-hidden', 'true');
  const tile = latticeTile(64, '#a0aec4', 0.18);
  root.innerHTML = `<div class="ckm-hero2d__lat" style="background-image:${tile.url};background-size:${tile.w}px ${tile.h}px"></div><div class="ckm-hero2d__mark">${markSVG()}</div>`;
  canvas.style.opacity = '0';
  canvas.insertAdjacentElement('afterend', root);
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  const markEl = root.querySelector('.ckm-hero2d__mark');

  const layout = () => {
    const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
    const L = (opts.layout || defaultLayout)(w, h);
    markEl.style.width = `${L.markPx}px`;
    markEl.style.height = `${(L.markPx * 180) / 186}px`;
    markEl.style.left = `${L.focus0[0] * 100}%`;
    markEl.style.top = `${L.focus0[1] * 100}%`;
    root.style.setProperty('--fx', `${L.focus0[0] * 100}%`);
    root.style.setProperty('--fy', `${L.focus0[1] * 100}%`);
  };
  layout();
  const ro = new ResizeObserver(layout); ro.observe(root);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.classList.add('is-on');
    if (opts.poster) { opts.poster.style.visibility = 'hidden'; }
    opts.onFirstFrame && opts.onFirstFrame();
  }));

  let st = null;
  const setP = (p) => root.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(4));
  if (opts.scroll !== false) {
    st = ScrollTrigger.create({
      trigger: opts.trigger || canvas.closest('[data-chapter], section') || parent,
      start: opts.scrollStart || 'top top', end: opts.scrollEnd || 'bottom bottom',
      onUpdate: (s) => setP(s.progress),
    });
  }
  return {
    setChapter() {}, setProgress: setP, reveal() {},
    resize: layout, pause() {}, resume() {},
    seek({ progress } = {}) { if (progress != null) setP(progress); root.classList.add('is-on'); },
    get state() { return { mode: '2d', reasons: info.reasons }; },
    destroy() { ro.disconnect(); st && st.kill(); root.remove(); if (opts.poster) opts.poster.style.visibility = ''; },
  };
}
