import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vite'ın root'u client/ olduğu için vitest varsayılan olarak yalnızca
 * client/ altındaki testleri buluyordu; server/ testleri hiç çalışmıyordu.
 * Bu yapılandırma her ikisini de kapsar.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["client/src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
  },
});
