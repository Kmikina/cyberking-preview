// The Cyber King mark: 8 polygons from assets/brand/cyberking-mark.svg
// (viewBox 48 6 186 180). dx/dy are the outward assembly vectors the original
// hero uses (index.html data-dx / data-dy on #heroMark .mk).
export const MARK_VIEWBOX = [48, 6, 186, 180];
export const MARK_CENTER = [141, 96];
export const MARK_PIECES = [
  { c: 'r', dx: -1, dy: -0.577, d: 'M135.53,10.35 L194.13,10.35 L108.15,59.99 L108.15,125.4 L77.85,72.92 L77.85,43.65Z' },
  { c: 'r', dx: 0,  dy: -1,     d: 'M110.85,130.08 L110.85,62.59 L172.3,27.09 L201.22,43.29 L140.15,78.13 L140.15,180.83Z' },
  { c: 'r', dx: 1,  dy: -0.577, d: 'M172.85,62.33 L201.15,45.99 L201.15,78.12 L172.85,127.13Z' },
  { c: 'b', dx: -1, dy: 0,      d: 'M52.38,26.35 L103.62,26.35 L78,41.15Z' },
  { c: 'b', dx: -1, dy: 0.577,  d: 'M52.74,29.44 L76.15,42.86 L76.15,69.98Z' },
  { c: 'b', dx: 1,  dy: 0,      d: 'M175.84,26.35 L229.98,26.35 L203.41,42Z' },
  { c: 'b', dx: 1,  dy: 0.577,  d: 'M228.8,30.23 L203.85,44.57 L203.85,73.44Z' },
  { c: 'b', dx: 0,  dy: 1,      d: 'M142.85,179.1 L142.85,79.53 L170.15,63.77 L170.15,131.81Z' },
];
export const parsePoly = (d) => d.replace(/[MZ]/g, '').trim().split(/\s*L\s*/).map((p) => p.split(',').map(Number));
