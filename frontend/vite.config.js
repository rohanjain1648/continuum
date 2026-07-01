import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev` the API + WebSocket are proxied to the FastAPI backend
// on :8000. `npm run build` emits ./dist which the backend serves in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "http://localhost:8000", ws: true },
    },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 1500 },
});
