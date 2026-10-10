/** 05 Capabilities instrument: four live 2D scopes, one per discipline. Runs only while visible. */
const CY = "26,170,228", RD = "233,40,48", GR = "160,174,196";
const rgba = (c, a) => `rgba(${c},${a})`;

function tri(ctx, cx, cy, R) {
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + Math.PI + k * (2 * Math.PI / 3); // downward triangle
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

const NODES = [[0, -0.42], [-0.3, -0.12], [0.28, -0.2], [0.05, 0.12], [-0.12, 0.34], [0.36, 0.05], [-0.42, -0.36], [0.18, 0.42]];

const SCOPES = {
  // Assessment: radar sweep over the C·I·A triangle; one flagged finding turns red, then is sealed.
  cyber(ctx, w, h, t) {
    const cx = w / 2, cy = h * 0.53, R = Math.min(w, h) * 0.4;
    ctx.lineWidth = 1;
    [1, 0.7, 0.4].forEach((k, i) => { tri(ctx, cx, cy, R * k); ctx.strokeStyle = rgba(GR, 0.16 + i * 0.05); ctx.stroke(); });
    for (let r = 1; r <= 4; r++) { ctx.beginPath(); ctx.arc(cx, cy, (R * r) / 4, 0, Math.PI * 2); ctx.strokeStyle = rgba(GR, 0.06); ctx.stroke(); }
    const a = (t * 0.0011) % (Math.PI * 2);
    const g = ctx.createConicGradient ? ctx.createConicGradient(a - 0.9, cx, cy) : null;
    if (g) {
      g.addColorStop(0, rgba(CY, 0)); g.addColorStop(0.14, rgba(CY, 0.28)); g.addColorStop(0.145, rgba(CY, 0)); g.addColorStop(1, rgba(CY, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 1.05, cy + Math.sin(a) * R * 1.05); ctx.strokeStyle = rgba(CY, 0.9); ctx.stroke();
    NODES.forEach(([nx, ny], i) => {
      const x = cx + nx * R * 1.6, y = cy + ny * R * 1.6;
      let d = (a - Math.atan2(y - cy, x - cx)) % (Math.PI * 2); if (d < 0) d += Math.PI * 2;
      const lit = Math.max(0, 1 - d / 1.6);
      const flagged = i === 4 && Math.floor(t / 7000) % 2 === 0;
      const c = flagged ? RD : CY;
      ctx.fillStyle = rgba(c, 0.3 + lit * 0.7);
      ctx.fillRect(x - 3, y - 3, 6, 6);
      if (lit > 0.6 || flagged) { ctx.strokeStyle = rgba(c, flagged ? 0.5 + 0.5 * Math.sin(t * 0.008) : lit); ctx.strokeRect(x - 8, y - 8, 16, 16); }
      if (flagged) { ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.fillStyle = rgba(RD, 0.95); ctx.fillText("GAP", x + 12, y + 4); }
    });
    ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.fillStyle = rgba(GR, 0.7);
    const top = cy - R * 0.5;
    ctx.fillText("C", cx - R * 0.9, top - 8); ctx.fillText("I", cx + R * 0.86, top - 8); ctx.fillText("A", cx - 3, cy + R + 16);
  },
  // Integration: isometric lattice with packets travelling its rows.
  integration(ctx, w, h, t) {
    const cx = w / 2, cy = h * 0.5, s = Math.min(w, h) / 13, N = 5;
    const P = (i, j) => [cx + (i - j) * s * 0.866, cy + (i + j - N) * s * 0.5];
    ctx.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      let a = P(i, 0), b = P(i, N); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.strokeStyle = rgba(GR, 0.22); ctx.stroke();
      a = P(0, i); b = P(N, i); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const [x, y] = P(i, j); const on = (i * 7 + j * 3 + Math.floor(t / 600)) % 11 === 0;
      ctx.fillStyle = on ? rgba(CY, 1) : rgba(GR, 0.35); ctx.fillRect(x - 2, y - 2, 4, 4);
      if (on) { ctx.strokeStyle = rgba(CY, 0.5); ctx.strokeRect(x - 6, y - 6, 12, 12); }
    }
    [1, 2, 0, 3, 4, 2].forEach((row, k) => {
      const dir = k % 2;
      const p = ((t * 0.00025 + k * 0.23) % 1) * N;
      const [x, y] = dir ? P(row, p) : P(p, row);
      const [x0, y0] = dir ? P(row, Math.max(0, p - 0.8)) : P(Math.max(0, p - 0.8), row);
      const grd = ctx.createLinearGradient(x0, y0, x, y); grd.addColorStop(0, rgba(CY, 0)); grd.addColorStop(1, rgba(CY, 0.95));
      ctx.strokeStyle = grd; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = "#fff"; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    });
  },
  // AV / VTC: 3×3 video wall with refresh scanlines and a live signal trace.
  av(ctx, w, h, t) {
    const pad = w * 0.14, gw = w - pad * 2, gh = gw * 0.5625, x0 = pad, y0 = (h - gh) / 2 - h * 0.04, cw = gw / 3, ch = gh / 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = x0 + c * cw, y = y0 + r * ch, k = r * 3 + c;
      ctx.fillStyle = rgba(CY, 0.04 + 0.05 * ((Math.sin(t * 0.0012 + k * 1.7) + 1) / 2)); ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      ctx.strokeStyle = rgba(GR, 0.25); ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
      const sy = y + 2 + ((t * 0.05 + k * 23) % (ch - 4));
      ctx.fillStyle = rgba(CY, 0.25); ctx.fillRect(x + 2, sy, cw - 4, 1.5);
    }
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const x = x0 + (gw * i) / 120;
      const y = y0 + gh / 2 + Math.sin(i * 0.22 + t * 0.006) * ch * 0.35 * Math.sin(i * 0.05 + t * 0.001);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = rgba(CY, 0.9); ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = rgba(RD, 0.6 + 0.4 * Math.sin(t * 0.006)); ctx.beginPath(); ctx.arc(x0 + 10, y0 + gh + 22, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.fillStyle = rgba(GR, 0.75); ctx.fillText("LIVE · VTC", x0 + 22, y0 + gh + 26);
  },
  // Program support: five-phase schedule with a moving status line.
  pm(ctx, w, h, t) {
    const pad = w * 0.12, x0 = pad, x1 = w - pad, y0 = h * 0.22, rowH = (h * 0.56) / 5;
    const bars = [[0, 0.28], [0.18, 0.46], [0.36, 0.66], [0.56, 0.86], [0.76, 1]];
    const names = ["REVIEW", "ANALYZE", "DESIGN", "INTEGRATE", "SUSTAIN"];
    const now = (t * 0.00008) % 1;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    for (let i = 0; i <= 10; i++) { const x = x0 + ((x1 - x0) * i) / 10; ctx.strokeStyle = rgba(GR, 0.08); ctx.beginPath(); ctx.moveTo(x, y0 - 10); ctx.lineTo(x, y0 + rowH * 5); ctx.stroke(); }
    bars.forEach(([a, b], r) => {
      const y = y0 + r * rowH + rowH * 0.3, bw = (x1 - x0) * (b - a), bx = x0 + (x1 - x0) * a, bh = rowH * 0.4;
      ctx.fillStyle = rgba(GR, 0.12); ctx.fillRect(bx, y, bw, bh);
      const done = Math.max(0, Math.min(1, (now - a) / (b - a)));
      ctx.fillStyle = rgba(CY, done >= 1 ? 0.5 : 0.85); ctx.fillRect(bx, y, bw * done, bh);
      ctx.fillStyle = rgba(GR, 0.8); ctx.fillText(names[r], bx, y - 5);
    });
    const nx = x0 + (x1 - x0) * now;
    ctx.strokeStyle = rgba(RD, 0.9); ctx.beginPath(); ctx.moveTo(nx, y0 - 16); ctx.lineTo(nx, y0 + rowH * 5); ctx.stroke();
    ctx.fillStyle = rgba(RD, 0.9); ctx.beginPath(); ctx.moveTo(nx - 5, y0 - 22); ctx.lineTo(nx + 5, y0 - 22); ctx.lineTo(nx, y0 - 14); ctx.fill();
  },
};

export function initInstrument(canvas) {
  const ctx = canvas.getContext("2d");
  let id = "cyber", running = false, raf = 0, w = 0, h = 0, fade = 1;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  function size() {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(now) {
    if (!running) return;
    if (!w) size();
    ctx.clearRect(0, 0, w, h);
    fade = Math.min(1, fade + 0.06);
    ctx.globalAlpha = fade;
    SCOPES[id](ctx, w, h, now);
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  addEventListener("resize", () => { w = 0; });
  return {
    set(next) { if (SCOPES[next] && next !== id) { id = next; fade = 0; } if (!running) { size(); SCOPES[id](ctx, w, h, performance.now()); } },
    run(on) { if (on === running) return; running = on; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(frame); },
  };
}
