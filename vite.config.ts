import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

/**
 * ARICIMAP web build.
 *
 * Manus'a özel eklentiler (vite-plugin-manus-runtime, jsx-loc, debug collector,
 * storage proxy) kaldırıldı. Bunlar üretim paketine hata raporlama kodu ve
 * localStorage okuması enjekte ediyordu; proje Manus dışına taşındığı için
 * artık karşılığı olmayan çağrılardı.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
  },
});
