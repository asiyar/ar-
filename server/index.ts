/** ARICIMAP server entry and small public configuration endpoint. */
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { appConfigHandler } from "./appConfig";
import { registerAccountRoutes } from "./accountRoutes";
import { initSchema, purgeExpiredSessions } from "./accountStore";
import { initNotificationSchema } from "./notifications";
import { initDistrictSchema } from "./districts";
import { initContentSchema } from "./content";
import { initStaySchema } from "./stayRequests";
import { initPushSchema } from "./push";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/app-config", appConfigHandler);
  registerAccountRoutes(app);

  // Tablolar ilk istekten önce hazır olsun; süresi dolmuş oturumlar temizlensin.
  initSchema()
    .then(initDistrictSchema)
    .then(initNotificationSchema)
    .then(initContentSchema)
    .then(initStaySchema)
    .then(initPushSchema)
    .then(purgeExpiredSessions)
    .catch((error) => console.error("Veritabanı hazırlanamadı:", error));
  // NOT: Eski dosya tabanlı "/api/aricimap/state" uç noktası kaldırıldı.
  // Kimlik doğrulaması olmadığı için tüm saha verisi herkese açık biçimde
  // okunabiliyor ve üzerine yazılabiliyordu. Kayıtlar artık yalnızca kimliği
  // doğrulanmış /api/aricimap/* uç noktaları üzerinden yönetilir.

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
