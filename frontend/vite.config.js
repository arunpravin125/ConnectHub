import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // Allow access from network (equivalent to --host flag)
    port: 3005,
    // Prevent direct access to source files
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:4900",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // Improve error handling for source files
  build: {
    sourcemap: true,
  },
});
