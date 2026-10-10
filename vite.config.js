import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const EXT = path.resolve(__dirname, "../motion");
const VIDEO_DIR = path.resolve(EXT, "video");
const useExternal = process.env.CK_MOTION !== "standin" && fs.existsSync(path.join(EXT, "src/hero.js"));
const motion = useExternal
  ? { hero: path.join(EXT, "src/hero.js"), bg: path.join(EXT, "src/background.js"), kind: "external" }
  : { hero: path.resolve(__dirname, "src/motion/standin/hero.js"), bg: path.resolve(__dirname, "src/motion/standin/background.js"), kind: "standin" };

/**
 * Hero video slot: if the motion engineer's renders exist in ../motion/video/, copy them into the build at
 * /motion/video/ and emit video-manifest.json classifying them (4k / 1080 / mobile / poster, mp4 / webm).
 */
function heroVideo() {
  const classify = (f) => {
    const n = f.toLowerCase();
    if (/\.(jpe?g|png|webp|avif)$/.test(n)) return { kind: "poster", mobile: /mobile|portrait|vert|9x16/.test(n) };
    if (!/\.(mp4|webm|mov)$/.test(n)) return null;
    return {
      kind: "video",
      type: n.endsWith(".webm") ? "video/webm" : "video/mp4",
      mobile: /mobile|portrait|vert|9x16/.test(n),
      res: /2160|4k|uhd/.test(n) ? 2160 : /1440/.test(n) ? 1440 : /1080|fhd/.test(n) ? 1080 : /720/.test(n) ? 720 : 1080,
    };
  };
  // Mark bounds per clip (so the page can frame any re-render without hand-tuned numbers). Cached by mtime.
  const cache = new Map();
  const measure = (f) => {
    const full = path.join(VIDEO_DIR, f), key = f + ":" + fs.statSync(full).mtimeMs;
    if (!cache.has(key)) {
      try { cache.set(key, JSON.parse(execFileSync("python3", [path.resolve(__dirname, "scripts/measure-mark.py"), full], { encoding: "utf8" }))); }
      catch (e) { console.warn("[cyberking] could not measure", f, e.message); cache.set(key, null); }
    }
    return cache.get(key);
  };
  const list = () => (fs.existsSync(VIDEO_DIR) ? fs.readdirSync(VIDEO_DIR).filter((f) => fs.statSync(path.join(VIDEO_DIR, f)).isFile()) : []);
  const manifest = () => {
    const files = list().map((f) => ({ src: "/motion/video/" + f, ...classify(f) })).filter((x) => x.kind);
    for (let i = files.length - 1; i >= 0; i--) if (files[i].kind === "video" && !measure(path.basename(files[i].src))) { console.warn("[cyberking] skipping unreadable clip", files[i].src); files.splice(i, 1); }
    files.forEach((x) => { if (x.kind === "video") { const m = measure(path.basename(x.src)); if (m) { x.size = [m.w, m.h]; x.mobile = x.mobile || m.h > m.w; x.markUnion = m.union; x.markF0 = m.f0; } } });
    return { generated: new Date().toISOString(), videos: files.filter((f) => f.kind === "video"), posters: files.filter((f) => f.kind === "poster") };
  };
  return {
    name: "ck-hero-video",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/motion/video/video-manifest.json") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(manifest())); }
        if (req.url && req.url.startsWith("/motion/video/")) {
          const f = path.join(VIDEO_DIR, decodeURIComponent(req.url.slice(14).split("?")[0]));
          if (f.startsWith(VIDEO_DIR) && fs.existsSync(f)) return fs.createReadStream(f).pipe(res);
        }
        next();
      });
    },
    generateBundle() {
      const keep = new Set(manifest().videos.concat(manifest().posters).map((x) => path.basename(x.src)));
      for (const f of list()) {
        if (!classify(f) || !keep.has(f)) continue;
        this.emitFile({ type: "asset", fileName: "motion/video/" + f, source: fs.readFileSync(path.join(VIDEO_DIR, f)) });
      }
      this.emitFile({ type: "asset", fileName: "motion/video/video-manifest.json", source: JSON.stringify(manifest(), null, 2) });
    },
  };
}

// Bake the desktop clip's measured mark bounds into the bundle so the first layout already matches the clip (no CLS).
function bakedVideoMeta(mobile) {
  try {
    const isMob = (n) => /mobile|portrait|vert|9x16/i.test(n);
    const files = fs.readdirSync(VIDEO_DIR).filter((n) => /\.(mp4|webm)$/i.test(n) && isMob(n) === mobile).sort((a, b) => (/1080/.test(a) ? -1 : 1));
    let out = null;
    for (const f of files) {
      if (!mobile && out) break; // desktop: the 1080 clip is representative
      const m = JSON.parse(execFileSync("python3", [path.resolve(__dirname, "scripts/measure-mark.py"), path.join(VIDEO_DIR, f)], { encoding: "utf8" }));
      if (!m || !m.union) continue;
      // union across encodes of the same cut, so either source fits the same box
      out = out ? { ...out, union: [Math.min(out.union[0], m.union[0]), Math.min(out.union[1], m.union[1]), Math.max(out.union[2], m.union[2]), Math.max(out.union[3], m.union[3])] } : { union: m.union, f0: m.f0, size: [m.w, m.h] };
    }
    return out;
  } catch (_) { return null; }
}
const VMETA = bakedVideoMeta(false);
const VMETA_MOBILE = bakedVideoMeta(true);

console.log(`[cyberking] motion modules: ${motion.kind} (${motion.hero})`);

export default defineConfig({
  define: { __CK_MOTION__: JSON.stringify(motion.kind), __CK_VMETA__: JSON.stringify(VMETA), __CK_VMETA_MOBILE__: JSON.stringify(VMETA_MOBILE) },
  resolve: {
    alias: { "@ck/motion-hero": motion.hero, "@ck/motion-bg": motion.bg },
    dedupe: ["three", "gsap"],
  },
  server: { fs: { allow: [__dirname, EXT] } },
  plugins: [heroVideo()],
  build: {
    target: "es2020", chunkSizeWarningLimit: 700, modulePreload: { polyfill: false },
    // perf/caching: keep three + gsap in stable vendor chunks (otherwise three gets merged into a motion-core chunk
    // whose hash changes on every motion edit). Same split the motion demo uses.
    rollupOptions: { output: { manualChunks: (id) => (id.includes("node_modules/three") ? "three" : id.includes("node_modules/gsap") ? "gsap" : undefined) } },
  },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
