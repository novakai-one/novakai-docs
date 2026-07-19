import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
import { mdApiPlugin } from "./server/plugin"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react(), mdApiPlugin({ appDir: __dirname })],
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
