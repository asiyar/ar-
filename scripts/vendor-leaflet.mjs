/**
 * Copies Leaflet from node_modules into client/public/vendor/leaflet.
 *
 * The app originally loaded Leaflet from unpkg.com. Inside a Capacitor shell that
 * means the map silently fails without a network connection, and Apple review
 * treats remotely loaded script as an added risk. Vendoring the exact same
 * version keeps the behaviour identical while making the bundle self-contained.
 */
import { cp, mkdir, rm, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = path.join(root, "node_modules", "leaflet", "dist");
const target = path.join(root, "client", "public", "vendor", "leaflet");

try {
  await access(source);
} catch {
  console.error("leaflet not found in node_modules — run `pnpm install` first.");
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

for (const entry of ["leaflet.css", "leaflet.js", "leaflet.js.map", "images"]) {
  await cp(path.join(source, entry), path.join(target, entry), { recursive: true });
}

console.log("Leaflet vendored into client/public/vendor/leaflet");
