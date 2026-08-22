import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureRuntimeData: vi.fn(),
  requirePermission: vi.fn(),
  json: vi.fn((data: unknown) => Response.json(data)),
  handleApiError: vi.fn(() => Response.json({ error: "safe" }, { status: 503 })),
  getDatabase: vi.fn()
}));

vi.mock("../_lib", () => mocks);
vi.mock("../../../server/db", () => ({ getDatabase: mocks.getDatabase }));

import { GET } from "./route";

describe("search API boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ scope: "COMPANY" });
    mocks.getDatabase.mockReturnValue({
      prepare: () => ({ all: () => [] })
    });
  });

  it("returns scoped search results through the existing permission boundary", async () => {
    const response = await GET(new Request("http://localhost/api/search?q=برنامه"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
    expect(mocks.requirePermission).toHaveBeenCalledWith("actions.view");
  });

  it("converts unexpected search failures into a safe response", async () => {
    mocks.ensureRuntimeData.mockImplementation(() => {
      throw new Error("database internals");
    });

    const response = await GET(new Request("http://localhost/api/search?q=برنامه"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "safe" });
    expect(mocks.handleApiError).toHaveBeenCalledOnce();
  });
});
