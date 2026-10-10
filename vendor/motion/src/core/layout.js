/**
 * defaultLayout(w, h) → { markPx, focus0:[x,y], focus1:[x,y], frac, box:[x0,y0,x1,y1] }
 *  markPx  rendered width of the mark (px) in the opening frame (= the poster)
 *  focus0  mark centre in the opening frame (0..1 of the canvas)
 *  focus1  fortress centre after it has risen
 *  frac    share of the canvas width the risen fortress aims to span
 *  box     the mark + fortress are kept inside this rectangle for the WHOLE
 *          timeline (camera pulls back / re-centres as needed). Lattice and
 *          long construct guides are environment and may cross it
 *          (latticeR / guideR shorten them; mobile keeps the text area clear).
 * Desktop: right ~47% of the frame, clear of a left-column H1, with margin for
 * the C / I / A labels around the mark. Mobile (≤900px): top third.
 * Override with opts.layout. Poster CSS (poster/poster.css) mirrors this.
 */
export function defaultLayout(w, h) {
  if (w <= 900) {
    const mw = Math.min(0.5 * w, 300, 0.27 * h);
    const top = 80;
    const cy = top + (mw * 180) / 186 / 2;
    return { markPx: mw, focus0: [0.5, cy / h], focus1: [0.5, cy / h + 0.01], frac: 0.88, box: [0.06, 72 / h, 0.94, 0.34], latticeR: 15, guideR: 13 };
  }
  const mw = Math.min(0.34 * w, 560, 0.56 * h);
  return { markPx: mw, focus0: [0.74, 0.47], focus1: [0.745, 0.54], frac: 0.4, box: [0.53, 0.1, 0.96, 0.92] };
}
