import { defineConfig } from "vite";

// GitHub Pages ではリポジトリ名がURLのパスになる（https://<ユーザー名>.github.io/parts-print-list/）
export default defineConfig({
  build: { chunkSizeWarningLimit: 700 }, // Firebase SDK が大半（gzip 約170KB）
  base: process.env.VITE_BASE ?? "./",
});
