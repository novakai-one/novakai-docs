import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
import { mdApiPlugin } from "./server/plugin"

// The external Novakai-Command record stores this viewer renders (read-only).
// Env override wins so a different checkout can point elsewhere; otherwise the
// absolute default is the one machine-specific value we commit.
const STORES_DIR =
  process.env.NVK_STORES_DIR ||
  "/Users/christopherdasca/Programming/Novakai-Command/.novakai/stores"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react(), mdApiPlugin({ appDir: __dirname, storesDir: STORES_DIR })],
  server: {
    port: 7100,
    strictPort: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
