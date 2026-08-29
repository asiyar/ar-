import { afterEach, describe, expect, it } from "vitest";

const originalDataDir = process.env.ARICIMAP_DATA_DIR;

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.ARICIMAP_DATA_DIR;
  else process.env.ARICIMAP_DATA_DIR = originalDataDir;
});

describe("ARICIMAP merkezi state store", () => {
  it("merkezi kaydı yazıp okuyabilir", async () => {
    const tempDir = `/tmp/aricimap-state-test-${Date.now()}`;
    process.env.ARICIMAP_DATA_DIR = tempDir;
    const { readState, writeState } = await import(`./stateStore?test=${Date.now()}`);
    await writeState({ apiaries: [{ id: "a1", lat: 38.1, lng: 40.4 }], notifications: [] });
    const result = await readState();
    expect(result.apiaries).toEqual([{ id: "a1", lat: 38.1, lng: 40.4 }]);
  });
});
