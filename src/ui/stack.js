/** 02 Environment: isometric system-of-systems stack on the mark's 30° grid (SVG, built once). */
export const LAYERS = [
  { id: "net", label: "Networks", note: "Design · implementation · integration" },
  { id: "dc", label: "Data centers", note: "Design · build · consolidation · migration" },
  { id: "app", label: "Applications", note: "System & application integration" },
  { id: "av", label: "Conference & AV", note: "Video teleconferencing · streaming" },
  { id: "c2", label: "Command & control", note: "Video walls · digital signage" },
  { id: "bld", label: "Building systems", note: "Wayfinding · room scheduling · emergency" },
];
const NS = "http://www.w3.org/2000/svg";
const sv = (tag, attrs, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
};
const f = (n) => n.toFixed(1);

export function buildStack(svg) {
  if (!svg) return null;
  const cx = 290, w = 190, h = w * Math.tan(Math.PI / 6), t = 14, gap = 100, top0 = 130;
  const n = LAYERS.length, seamAt = 2; // seam between Applications (2) and Conference & AV (3)
  const cy = (i) => top0 + (n - 1 - i) * gap;
  const pt = (y, u, v) => [cx - w + (u + v) * w, y + (v - u) * h];
  const plates = [], links = [], pulses = [], labels = [];

  // Soft floor glow under the stack
  const defs = sv("defs", {}, svg);
  const rg = sv("radialGradient", { id: "stackGlow" }, defs);
  sv("stop", { offset: "0", "stop-color": "#1aaae4", "stop-opacity": ".22" }, rg);
  sv("stop", { offset: "1", "stop-color": "#1aaae4", "stop-opacity": "0" }, rg);
  sv("ellipse", { cx, cy: cy(0) + h + 30, rx: w * 1.6, ry: h * 1.1, fill: "url(#stackGlow)", class: "stack-floor" }, svg);

  const linkCols = [[-0.42, 0.12], [0, 0], [0.42, -0.12]];
  LAYERS.forEach((layer, i) => {
    const y = cy(i);
    // Links from the plate below into this one (drawn before the plate so it occludes them)
    if (i > 0) {
      const yl = cy(i - 1);
      linkCols.forEach(([dx, dy], k) => {
        const x = cx + dx * w, y1 = yl + dy * h, y2 = y + dy * h + t;
        const seam = i - 1 === seamAt;
        const len = Math.abs(y1 - y2);
        const l = sv("line", { x1: f(x), y1: f(y1), x2: f(x), y2: f(y2), class: "link" + (seam ? " is-seam" : ""), "stroke-dasharray": f(len), "stroke-dashoffset": f(len) }, svg);
        links.push({ el: l, len, i, seam, x, y1, y2 });
        if (k !== 1 || seam) {
          const p = sv("circle", { cx: f(x), cy: f(y1), r: seam ? 3.5 : 2.6, class: "pulse", opacity: 0 }, svg);
          if (seam) p.setAttribute("fill", "#e92830");
          pulses.push({ el: p, x, y1, y2, seam, i });
        }
      });
    }
    const g = sv("g", { class: "plate", "data-i": i }, svg);
    const L = [cx - w, y], T = [cx, y - h], R = [cx + w, y], B = [cx, y + h];
    const P = (a) => a.map((p) => f(p[0]) + "," + f(p[1])).join(" ");
    sv("polygon", { class: "side-l", points: P([L, B, [B[0], B[1] + t], [L[0], L[1] + t]]) }, g);
    sv("polygon", { class: "side-r", points: P([B, R, [R[0], R[1] + t], [B[0], B[1] + t]]) }, g);
    sv("polygon", { class: "top", points: P([L, T, R, B]) }, g);
    let d = "";
    const seg = (a, b) => { d += "M" + f(a[0]) + "," + f(a[1]) + "L" + f(b[0]) + "," + f(b[1]); };
    const kind = i % 3;
    const fr = kind === 1 ? [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6] : [0.25, 0.5, 0.75];
    fr.forEach((q) => { seg(pt(y, q, 0), pt(y, q, 1)); if (kind !== 2) seg(pt(y, 0, q), pt(y, 1, q)); });
    if (kind === 2) { seg(pt(y, 0.3, 0.3), pt(y, 0.7, 0.3)); seg(pt(y, 0.7, 0.3), pt(y, 0.7, 0.7)); seg(pt(y, 0.7, 0.7), pt(y, 0.3, 0.7)); seg(pt(y, 0.3, 0.7), pt(y, 0.3, 0.3)); }
    sv("path", { class: "pattern", d }, g);
    sv("polygon", { class: "glow", points: P([L, T, R, B]) }, g);
    [[0.5, 0.5], i % 2 ? [0.25, 0.75] : [0.75, 0.25]].forEach(([u, v]) => { const p = pt(y, u, v); sv("circle", { class: "dotp", cx: f(p[0]), cy: f(p[1]), r: 2.4 }, g); });
    plates.push(g);

    const lab = sv("g", { class: "plate-label" }, svg);
    sv("line", { x1: f(R[0] + 14), y1: f(y), x2: f(R[0] + 54), y2: f(y) }, lab);
    const t1 = sv("text", { x: f(R[0] + 64), y: f(y - 3), class: "lbl-main" }, lab); t1.textContent = layer.label;
    const t2 = sv("text", { x: f(R[0] + 64), y: f(y + 15) }, lab); t2.textContent = layer.note;
    labels.push(lab);
  });

  // Seam tag
  const yS = (cy(seamAt) + cy(seamAt + 1)) / 2 + 20;
  const tag = sv("g", { class: "seam-tag", opacity: 0 }, svg);
  sv("rect", { x: f(cx - w - 128), y: f(yS - 13), width: 96, height: 24 }, tag);
  const tt = sv("text", { x: f(cx - w - 118), y: f(yS + 4) }, tag); tt.textContent = "SEAM";
  sv("line", { x1: f(cx - w - 32), y1: f(yS), x2: f(cx - w * 0.42 - 6), y2: f(yS), stroke: "rgba(233,40,48,.6)" }, tag);

  svg._stack = { plates, links, pulses, labels, tag, gap };
  return svg._stack;
}
