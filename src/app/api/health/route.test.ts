import { afterEach, describe, expect, it, vi } from "vitest";

const { checkDatabaseReadiness } = vi.hoisted(() => ({
  checkDatabaseReadiness: vi.fn()
}));

vi.mock("../../../server/db", () => ({
  checkDatabaseReadiness
}));

import { GET } from "./route";

describe("health endpoint", () => {
  afterEach(() => {
    checkDatabaseReadiness.mockReset();
  });

  it("reports healthy process and readable database", async () => {
    checkDatabaseReadiness.mockImplementation(() => undefined);

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", database: "ok" });
    expect(checkDatabaseReadiness).toHaveBeenCalledOnce();
  });

  it("returns a deployment-visible failure when SQLite is unavailable", async () => {
    checkDatabaseReadiness.mockImplementation(() => {
      throw new Error("database is missing");
    });

    const response = GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "degraded", database: "unavailable" });
  });
});
