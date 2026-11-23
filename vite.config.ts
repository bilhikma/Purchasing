import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run build:artifact` membangun versi demo untuk dibuka di claude.ai (mis. dari iPad).
const artifact = process.env.VITE_ARTIFACT === "1";

export default defineConfig({
  plugins: [react()],
  base: artifact ? "./" : "/",
  build: artifact
    ? { outDir: "dist-artifact", chunkSizeWarningLimit: 2000, rollupOptions: { output: { entryFileNames: "app.js", assetFileNames: "app.[ext]" } } }
    : { chunkSizeWarningLimit: 2000 },
});
