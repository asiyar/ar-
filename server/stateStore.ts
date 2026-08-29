import fs from "node:fs/promises";
import path from "node:path";

export type AricimapState = Record<string, unknown>;

const dataDir = process.env.ARICIMAP_DATA_DIR || path.resolve(process.cwd(), "data");
const dataFile = path.join(dataDir, "aricimap-state.json");
const initialState: AricimapState = {
  apiaries: [],
  inspections: [],
  audit: [],
  notifications: [],
  ads: [],
  announcements: [],
  shares: [],
  staffRequests: [],
  staff: [],
  staffRecords: [],
  staffAssignments: [],
  stayRequests: [],
};

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(initialState, null, 2), "utf8");
  }
}

export async function readState(): Promise<AricimapState> {
  await ensureStore();
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile, "utf8"));
    return { ...initialState, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...initialState };
  }
}

export async function writeState(next: AricimapState): Promise<AricimapState> {
  await ensureStore();
  const safeState = { ...initialState, ...next };
  const tempFile = `${dataFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(safeState, null, 2), "utf8");
  await fs.rename(tempFile, dataFile);
  return safeState;
}
