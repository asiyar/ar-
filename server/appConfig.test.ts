import { describe, expect, it, vi } from "vitest";
import { appConfigHandler } from "./appConfig";

describe("GET /api/app-config", () => {
  it("returns the configured ARICIMAP public title", () => {
    const json = vi.fn();

    appConfigHandler({}, { json });

    expect(json).toHaveBeenCalledWith({ title: "ARICIMAP" });
  });
});
