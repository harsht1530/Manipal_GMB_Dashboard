import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  // 👇 IMPORTANT for subfolder hosting
  base: "/GMB/",

  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        // API_PROXY_TARGET lets a dev run the backend on another port without editing this
        // file - useful when port 5000 is already taken by another instance.
        target: process.env.API_PROXY_TARGET || "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
