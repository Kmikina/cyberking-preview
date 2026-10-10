// Chapter ids = the original site's `data-chapter` attributes / rail entries
// (index.html) in page order. `approach` and `commitment` are the light
// "paper" chapters (main.js `lightChapters`).
export const CHAPTERS = ['top', 'environment', 'challenge', 'company', 'capabilities', 'approach', 'commitment', 'contact'];
export const LIGHT_CHAPTERS = { approach: true, commitment: true };

// Background lattice presets per chapter.
//  spacing  triangle side in CSS px          tilt   plane tilt (deg, 0 = flat page)
//  rot      in-plane rotation (deg)          accent share of lines that carry accent (0..1)
//  red      share of accent lines that are red (rest cyan)
//  drift    [x, y] CSS px / s                 alpha  base line opacity
//  light    1 = ink lines for paper chapters pulse  avg small pulse events per 10 s
//  speed    accent "traffic" speed            nodes  intersection dot strength
export const BG_PRESETS = {
  top:          { spacing: 72, tilt: 0,  rot: 0,   accent: 0.00, red: 0.3, drift: [0, -2],  alpha: 0.00, light: 0, pulse: 0.0, speed: 0.05, nodes: 0.0 },
  environment:  { spacing: 58, tilt: 58, rot: 0,   accent: 0.05, red: 0.1, drift: [0, 10],  alpha: 0.85, light: 0, pulse: 1.2, speed: 0.10, nodes: 0.6 },
  challenge:    { spacing: 76, tilt: 18, rot: -4,  accent: 0.06, red: 0.75, drift: [3, -3],  alpha: 0.65, light: 0, pulse: 2.0, speed: 0.06, nodes: 0.3 },
  company:      { spacing: 64, tilt: 0,  rot: 0,   accent: 0.04, red: 0.4, drift: [0, -3],  alpha: 0.80, light: 0, pulse: 1.0, speed: 0.05, nodes: 0.8 },
  capabilities: { spacing: 46, tilt: 40, rot: 8,   accent: 0.10, red: 0.12, drift: [14, 0],  alpha: 0.75, light: 0, pulse: 2.6, speed: 0.16, nodes: 0.4 },
  approach:     { spacing: 64, tilt: 30, rot: 0,   accent: 0.03, red: 0.2, drift: [0, 6],   alpha: 0.75, light: 1, pulse: 0.8, speed: 0.07, nodes: 0.5 },
  commitment:   { spacing: 96, tilt: 0,  rot: 0,   accent: 0.015, red: 0.5, drift: [0, -1.5], alpha: 0.55, light: 1, pulse: 0.3, speed: 0.03, nodes: 0.2 },
  contact:      { spacing: 56, tilt: 62, rot: 0,   accent: 0.06, red: 0.25, drift: [0, 16],  alpha: 0.80, light: 0, pulse: 1.6, speed: 0.12, nodes: 0.6 },
};
BG_PRESETS.default = BG_PRESETS.company;
