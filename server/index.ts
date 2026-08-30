/** ARICIMAP server entry and small public configuration endpoint. */
import express from "express";
import { readState, writeState } from "./stateStore";
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
    .then(purgeExpiredSessions)
    .catch((error) => console.error("Veritabanı hazırlanamadı:", error));
  app.get("/api/aricimap/state", async (_req, res) => {
    res.json(await readState());
  });
  app.put("/api/aricimap/state", async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({ error: "Geçersiz state gövdesi" });
      return;
    }
    res.json(await writeState(req.body));
  });

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
