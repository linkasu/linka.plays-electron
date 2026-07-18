import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    include: ["src/frontend/**/*.{test,spec}.ts", "src/electron/**/*.{test,spec}.ts"]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
