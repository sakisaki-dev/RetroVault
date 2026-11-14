import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Retro Bowl's own sprites (scripts/private_nfl_sprites.py, scripts/private_sprites.py) live only on the owner's Mac
// in public/private-sprites/ (git-ignored). The site fetches them only when this machine has them; never in CI, so the
// Pages build never asks.
const PRIVATE_SPRITES = !process.env.GITHUB_ACTIONS && fs.existsSync(path.resolve(__dirname, "public/private-sprites"));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the site from /RetroVault/; the deploy workflow sets BASE_PATH. Local dev stays at /.
  base: process.env.BASE_PATH || "/",
  define: { __PRIVATE_SPRITES__: JSON.stringify(PRIVATE_SPRITES) },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
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
