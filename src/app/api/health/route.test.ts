import { afterEach, describe, expect, it, vi } from "vitest";

const { getReadOnlyDatabase } = vi.hoisted(() => ({
  getReadOnlyDatabase: vi.fn()
}));

vi.mock("../../../server/db", () => ({
  getReadOnlyDatabase
}));

import { GET } from "./route";

describe("health endpoint", () => {
  afterEach(() => {
    getReadOnlyDatabase.mockReset();
  });

  it("reports healthy process and readable database", async () => {
    const get = vi.fn().mockReturnValue({ ok: 1 });
    getReadOnlyDatabase.mockReturnValue({ prepare: vi.fn().mockReturnValue({ get }) });

    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "ok" });
    expect(get).toHaveBeenCalledOnce();
  });

  it("returns a deployment-visible failure when SQLite is unavailable", async () => {
    getReadOnlyDatabase.mockImplementation(() => {
      throw new Error("database is missing");
    });

    const response = GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded", database: "unavailable" });
  });
});
