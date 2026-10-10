/**
 * Lightweight 2D fallback for the living background (saveData / low memory / few cores / no WebGL / context lost).
 * Same contract as background.js: init(canvas, opts) → { setChapter, pause, resume, destroy }.
 * Draws the isometric lattice once per resize into an offscreen buffer, then composites a slow scan band at ~20 fps.
 */
const TINT = { top: "26,170,228", environment: "26,170,228", challenge: "233,40,48", company: "26,170,228", capabilities: "26,170,228", approach: "26,170,228", commitment: "26,170,228", contact: "233,40,48" };

export function init(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  const lattice = document.createElement("canvas");
  const lctx = lattice.getContext("2d");
  let w = 0, h = 0, raf = 0, running = true, last = 0, tint = TINT.top;
  const dpr = 1; // background is soft; 1x keeps it cheap

  function drawLattice() {
    w = innerWidth; h = innerHeight;
    canvas.width = lattice.width = w * dpr; canvas.height = lattice.height = h * dpr;
    lctx.clearRect(0, 0, w, h);
    lctx.strokeStyle = "rgba(160,174,196,0.07)";
    lctx.lineWidth = 1;
    const s = opts.isMobile ? 48 : 64, k = Math.tan(Math.PI / 6);
    lctx.beginPath();
    for (let y = 0; y < h + s; y += s) { lctx.moveTo(0, y); lctx.lineTo(w, y); }
    for (let x = -h / k; x < w + h / k; x += s / k) {
      lctx.moveTo(x, 0); lctx.lineTo(x + h / k / 1, h);
      lctx.moveTo(x, 0); lctx.lineTo(x - h / k / 1, h);
    }
    lctx.stroke();
  }
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 50) return;
    last = now;
    ctx.fillStyle = "#07090d"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(lattice, 0, 0);
    const y = ((now * 0.05) % (h * 1.6)) - h * 0.3;
    const g = ctx.createLinearGradient(0, y - 160, 0, y);
    g.addColorStop(0, `rgba(${tint},0)`); g.addColorStop(1, `rgba(${tint},0.10)`);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g; ctx.fillRect(0, y - 160, w, 160);
    ctx.globalCompositeOperation = "source-over";
  }
  drawLattice();
  addEventListener("resize", drawLattice);
  raf = requestAnimationFrame(frame);
  return {
    setChapter(id) { tint = TINT[id] || TINT.top; },
    setProgress() {},
    resize() { drawLattice(); },
    pause() { running = false; cancelAnimationFrame(raf); },
    resume() { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
    destroy() { this.pause(); removeEventListener("resize", drawLattice); },
  };
}
