import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/client"),
      "@shared": resolve(__dirname, "src/shared"),
      "@server": resolve(__dirname, "src/server"),
    },
  },
  build: {
    outDir: "dist",
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    watch: null,
  },
  server: {
    port: 5173,
    hmr: {
      overlay: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
});
