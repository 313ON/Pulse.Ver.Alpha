import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "./db";

const environment = process.env as Record<string, string | undefined>;
const originalNodeEnv = environment.NODE_ENV;
const originalDatabasePath = environment.PULSE_DB_PATH;

afterEach(() => {
  closeDatabase();
  if (originalNodeEnv === undefined) delete environment.NODE_ENV;
  else environment.NODE_ENV = originalNodeEnv;
  if (originalDatabasePath === undefined) delete environment.PULSE_DB_PATH;
  else environment.PULSE_DB_PATH = originalDatabasePath;
});

describe("production database configuration", () => {
  it("fails closed when PULSE_DB_PATH is missing in production", () => {
    environment.NODE_ENV = "production";
    delete environment.PULSE_DB_PATH;

    expect(() => getDatabase()).toThrow("PULSE_DB_PATH must be configured in production.");
  });
});
