import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// Retro Bowl's own sprites (scripts/private_nfl_sprites.py, scripts/private_sprites.py) in public/private-sprites/,
// committed and deployed by the owner's choice (2026-11-14). The site fetches them whenever the folder is there, the
// Pages build included; a checkout without it builds the classic art.
const PRIVATE_SPRITES = fs.existsSync(path.resolve(__dirname, "public/private-sprites"));

// https://vitejs.dev/config/
export default defineConfig(() => ({
  // GitHub Pages serves the site from /RetroVault/; the deploy workflow sets BASE_PATH. Local dev stays at /.
  base: process.env.BASE_PATH || "/",
  define: { __PRIVATE_SPRITES__: JSON.stringify(PRIVATE_SPRITES) },
  // Source maps beside the bundles (not linked from them), so a crash screen's minified stack can be mapped back
  build: {
    sourcemap: "hidden",
    // Rollup splits shared code into many 1 KB chunks (one per icon, one per helper); each costs a request on a phone, so
    // chunks under 20 KB are merged into the ones that import them
    rollupOptions: { output: { experimentalMinChunkSize: 20000 } },
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Belt and braces: a build that isn't showing the private sprites never ships a copy of them either
    !PRIVATE_SPRITES &&
      ((): Plugin => {
        let outDir = "dist";
        return {
          name: "drop-private-sprites",
          apply: "build",
          configResolved(config) {
            outDir = path.resolve(config.root, config.build.outDir);
          },
          closeBundle() {
            fs.rmSync(path.join(outDir, "private-sprites"), { recursive: true, force: true });
          },
        };
      })(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
