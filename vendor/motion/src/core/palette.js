// Cyber King Services palette — taken verbatim from the original site's
// :root custom properties (assets/css/styles.css) and brand SVGs.
export const PALETTE = {
  ink: '#07090d',        // --ink (page ground)
  ink2: '#0b0f16',       // --ink-2
  graphite: '#111620',   // --graphite (plate tops)
  graphite2: '#171d29',  // --graphite-2
  sideL: '#0c1018',      // .plate .side-l
  sideR: '#0e131c',      // .plate .side-r
  line: [160, 174, 196], // --line / --line-2 base rgb (alpha .13 / .24)
  mute: '#7d8798',
  mute2: '#a3acba',
  soft: '#e9edf2',
  white: '#f6f8fa',
  red: '#e92830',        // --red (mark)
  cyan: '#1aaae4',       // --cyan (mark)
  paper: '#eceef1',      // light chapters (approach, commitment)
  paperInk: '#0b0f16',
};

export const hexToRgb01 = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
