import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  base: "./",
  build: {
    outDir: path.resolve(__dirname, ".."),
    emptyOutDir: false,
    assetsDir: "build",
    rollupOptions: {
      output: {
        entryFileNames: "build/lumen-store-rush.js",
        chunkFileNames: "build/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "build/lumen-store-rush.css";
          }
          return "build/[name][extname]";
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4174,
  },
});
