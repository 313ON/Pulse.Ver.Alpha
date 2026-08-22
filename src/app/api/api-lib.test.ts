import { describe, expect, it } from "vitest";
import { handleApiError } from "./_lib";

describe("API failure semantics", () => {
  it("returns a safe 503 response for unavailable database errors", async () => {
    const error = Object.assign(new Error("SQLITE_CANTOPEN: secret-path"), { code: "SQLITE_CANTOPEN" });
    const response = handleApiError(error);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "The request could not be completed.",
      code: "DATABASE_UNAVAILABLE"
    });
  });

  it("does not expose unexpected exception details", async () => {
    const response = handleApiError(new Error("secret password and /private/path"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The request could not be completed.",
      code: "INTERNAL_ERROR"
    });
  });
});
