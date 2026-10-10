import { MARK_PIECES, MARK_CENTER } from '../core/mark.js';
import { PALETTE } from '../core/palette.js';

export const SVGNS = 'http://www.w3.org/2000/svg';

// Isometric lattice tile (triangle side s): two horizontals + one 60° and one 120° line.
export function latticeTile(s, stroke, opacity) {
  const h = +(s * Math.sqrt(3)).toFixed(3);
  const half = +(h / 2).toFixed(3);
  const svg = `<svg xmlns='${SVGNS}' width='${s}' height='${h}' viewBox='0 0 ${s} ${h}'><g stroke='${stroke}' stroke-opacity='${opacity}' stroke-width='1' fill='none'><path d='M0 0.5H${s}M0 ${half}H${s}M0 0L${s} ${h}M${s} 0L0 ${h}'/></g></svg>`;
  return { url: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, w: s, h };
}

// The mark with the original's 30°/60° assembly vectors (same markup as the poster).
export function markSVG(cls = '') {
  const paths = MARK_PIECES.map((p, i) => `<path class="ckm-mk" style="--dx:${p.dx};--dy:${p.dy};--i:${i}" fill="${p.c === 'r' ? PALETTE.red : PALETTE.cyan}" d="${p.d}"/>`).join('');
  // Guides: the mark triangle's three edges, extended far past the mark.
  const tri = [[52.38, 26.35], [229.98, 26.35], [141, 180.83]];
  const ext = (a, b, L = 900) => { const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy); return [a[0] - dx / n * L, a[1] - dy / n * L, b[0] + dx / n * L, b[1] + dy / n * L].map((v) => v.toFixed(1)); };
  const guides = [ext(tri[0], tri[1]), ext(tri[1], tri[2]), ext(tri[2], tri[0])]
    .map(([x1, y1, x2, y2]) => `<line class="ckm-guide" vector-effect="non-scaling-stroke" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('');
  // mask used on mobile (poster.css) so guides fade like the WebGL guideR fade
  const defs = `<defs><radialGradient id="ckm-gf" gradientUnits="userSpaceOnUse" cx="141" cy="96" r="325"><stop offset=".15" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="ckm-gm" maskUnits="userSpaceOnUse" x="-900" y="-900" width="2000" height="2000"><rect x="-900" y="-900" width="2000" height="2000" fill="url(#ckm-gf)"/></mask></defs>`;
  return `<svg class="${cls}" viewBox="48 6 186 180" overflow="visible" aria-hidden="true">${defs}<g class="ckm-guides" stroke="rgb(160,174,196)" stroke-opacity=".16" stroke-width="1">${guides}</g>${paths}</svg>`;
}
export { MARK_CENTER };

export function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id; s.textContent = css;
  document.head.appendChild(s);
}
