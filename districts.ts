/**
 * ARICIMAP ilçe katmanı.
 *
 * Bir konumun hangi ilçeye düştüğünü belirlemek için gerçek idari sınır
 * poligonları kullanılır. Sınır kutusu (dikdörtgen) yeterli değildir: Diyarbakır
 * ilçelerinin kutuları birbirinin içine girer ve bildirim yanlış personele gider.
 *
 * Poligonlar OpenStreetMap'ten (Overpass) bir kez çekilip veritabanına yazılır;
 * sonraki sorgular ağa çıkmaz.
 */
import { pool, initSchema } from "./accountStore";

export interface DistrictRecord {
  id: string;
  province: string;
  name: string;
  /** Dış halkalar listesi. Her halka [lng, lat] çiftlerinden oluşur. */
  rings: number[][][];
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

let cache: DistrictRecord[] | null = null;

export async function initDistrictSchema(): Promise<void> {
  await initSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS districts (
      id       TEXT PRIMARY KEY,
      province TEXT NOT NULL,
      name     TEXT NOT NULL,
      rings    JSONB NOT NULL,
      min_lat  DOUBLE PRECISION NOT NULL,
      max_lat  DOUBLE PRECISION NOT NULL,
      min_lng  DOUBLE PRECISION NOT NULL,
      max_lng  DOUBLE PRECISION NOT NULL,
      UNIQUE (province, name)
    );
    CREATE INDEX IF NOT EXISTS districts_province ON districts(province);
  `);
}

/**
 * Işın atma (ray casting) yöntemiyle nokta-poligon testi.
 * Kenar üzerindeki noktalar için kesin bir garanti vermez; idari sınırda oturan
 * bir arılık için hangi ilçeye düştüğü belirsiz kalabilir. Bu, bildirim
 * yönlendirmesi için kabul edilebilir bir belirsizliktir.
 */
export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > lat !== yj > lat;
    if (!straddles) continue;
    const crossing = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (lng < crossing) inside = !inside;
  }
  return inside;
}

export function pointInDistrict(lng: number, lat: number, district: DistrictRecord): boolean {
  // Önce ucuz sınır kutusu elemesi, sonra pahalı poligon testi.
  if (lat < district.minLat || lat > district.maxLat) return false;
  if (lng < district.minLng || lng > district.maxLng) return false;
  return district.rings.some((ring) => pointInRing(lng, lat, ring));
}

export async function loadDistricts(force = false): Promise<DistrictRecord[]> {
  if (cache && !force) return cache;
  await initDistrictSchema();
  const result = await pool.query(`SELECT * FROM districts`);
  cache = result.rows.map((row) => ({
    id: row.id,
    province: row.province,
    name: row.name,
    rings: row.rings as number[][][],
    minLat: row.min_lat,
    maxLat: row.max_lat,
    minLng: row.min_lng,
    maxLng: row.max_lng,
  }));
  return cache;
}

/** Bir koordinatın düştüğü ilçeyi döner; hiçbirine düşmüyorsa null. */
export async function districtForPoint(lat: number, lng: number): Promise<DistrictRecord | null> {
  const districts = await loadDistricts();
  return districts.find((d) => pointInDistrict(lng, lat, d)) || null;
}

export async function listDistricts(province?: string): Promise<{ province: string; name: string }[]> {
  const districts = await loadDistricts();
  return districts
    .filter((d) => !province || d.province === province)
    .map((d) => ({ province: d.province, name: d.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

interface OverpassMember {
  type: string;
  role: string;
  geometry?: { lat: number; lon: number }[];
}

interface OverpassElement {
  id: number;
  tags?: Record<string, string>;
  members?: OverpassMember[];
}

/**
 * Overpass yanıtını poligon halkalarına çevirir.
 * İlçe sınırları "relation" olarak gelir ve dış sınır birden çok parçaya
 * bölünmüş olabilir; parçalar uç noktalarından birleştirilir.
 */
export function ringsFromRelation(element: OverpassElement): number[][][] {
  const segments = (element.members || [])
    .filter((m) => m.role === "outer" && Array.isArray(m.geometry) && m.geometry.length > 1)
    .map((m) => m.geometry!.map((p) => [p.lon, p.lat] as number[]));

  const rings: number[][][] = [];
  const pending = [...segments];

  while (pending.length) {
    let current = pending.shift()!;
    let joined = true;
    while (joined) {
      joined = false;
      const head = current[0];
      const tail = current[current.length - 1];
      const closed = head[0] === tail[0] && head[1] === tail[1];
      if (closed) break;
      for (let i = 0; i < pending.length; i++) {
        const candidate = pending[i];
        const cHead = candidate[0];
        const cTail = candidate[candidate.length - 1];
        if (tail[0] === cHead[0] && tail[1] === cHead[1]) {
          current = current.concat(candidate.slice(1));
        } else if (tail[0] === cTail[0] && tail[1] === cTail[1]) {
          current = current.concat([...candidate].reverse().slice(1));
        } else if (head[0] === cTail[0] && head[1] === cTail[1]) {
          current = candidate.slice(0, -1).concat(current);
        } else if (head[0] === cHead[0] && head[1] === cHead[1]) {
          current = [...candidate].reverse().slice(0, -1).concat(current);
        } else {
          continue;
        }
        pending.splice(i, 1);
        joined = true;
        break;
      }
    }
    if (current.length > 3) rings.push(current);
  }
  return rings;
}

export function boundsOf(rings: number[][][]) {
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  return { minLat, maxLat, minLng, maxLng };
}

export async function saveDistrict(province: string, name: string, rings: number[][][]): Promise<void> {
  await initDistrictSchema();
  const bounds = boundsOf(rings);
  await pool.query(
    `INSERT INTO districts (id, province, name, rings, min_lat, max_lat, min_lng, max_lng)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (province, name) DO UPDATE SET
       rings = EXCLUDED.rings, min_lat = EXCLUDED.min_lat, max_lat = EXCLUDED.max_lat,
       min_lng = EXCLUDED.min_lng, max_lng = EXCLUDED.max_lng`,
    [
      `district_${province}_${name}`.replace(/\s+/g, "_").toLowerCase(),
      province,
      name,
      JSON.stringify(rings),
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
    ],
  );
  cache = null;
}

/**
 * İl sınırlarındaki ilçe poligonlarını OpenStreetMap'ten çeker.
 * Yönetici tarafından elle tetiklenir; her açılışta çalıştırılmaz çünkü
 * Overpass'ın kullanım politikası tekrarlı otomatik sorguları kısıtlar.
 */
export async function syncProvince(province: string): Promise<{ saved: number; skipped: number }> {
  const query =
    `[out:json][timeout:180];` +
    `area["boundary"="administrative"]["admin_level"="4"]["name"="${province}"]->.il;` +
    `relation["boundary"="administrative"]["admin_level"~"^(5|6)$"](area.il);` +
    `out geom;`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: { "Content-Type": "text/plain" },
  });
  if (!response.ok) throw new Error(`Overpass yanıtı: ${response.status}`);
  const data = (await response.json()) as { elements?: OverpassElement[] };

  const elements = (data.elements || []).filter((e) => e.tags && e.tags.name);
  const level6 = elements.filter((e) => e.tags!.admin_level === "6");
  const usable = level6.length ? level6 : elements;

  let saved = 0;
  let skipped = 0;
  for (const element of usable) {
    const rings = ringsFromRelation(element);
    if (!rings.length) {
      skipped += 1;
      continue;
    }
    await saveDistrict(province, element.tags!.name, rings);
    saved += 1;
  }
  cache = null;
  return { saved, skipped };
}

/** Yalnızca testler için. */
export function clearDistrictCache() {
  cache = null;
}
