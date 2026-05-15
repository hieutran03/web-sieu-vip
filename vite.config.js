import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["chart.js", "react-chartjs-2"],
          maps: ["@vis.gl/react-google-maps"]
        }
      }
    }
  }
});
