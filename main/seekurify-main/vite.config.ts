import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000", // backend server
        changeOrigin: true,              // handles CORS & virtual hosted sites
        secure: false,                   // allow self-signed SSL if needed
        ws: true,                        // proxy WebSocket connections too
        rewrite: (path) => path,
      },
    },
  },
  plugins: [react()],
  base: "/", // use "/" unless deploying under a subfolder
});

