import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { closeDatabase } from "./db";
import Database from "better-sqlite3";
import { schemaContractErrors } from "./schema-contract";

const root = path.join(os.tmpdir(), `pulse-concurrency-${Date.now()}-${Math.random()}`);
const databasePath = path.join(root, "pulse.sqlite");
const workerPath = path.join(process.cwd(), "src", "server", "db-concurrency.worker.ts");
const viteNodePath = path.join(process.cwd(), "node_modules", "vite-node", "vite-node.mjs");

afterEach(() => {
  closeDatabase();
  fs.rmSync(root, { recursive: true, force: true });
});

function runWorker(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [viteNodePath, workerPath, databasePath], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Concurrency worker failed with code ${code}: ${stderr}`));
    });
  });
}

describe("SQLite concurrent startup", () => {
  it.each([2, 5, 10])("keeps the database deterministic with %i simultaneous initializers", async (count) => {
    fs.mkdirSync(root, { recursive: true });
    await Promise.all(Array.from({ length: count }, () => runWorker()));

    const database = new Database(databasePath, { readonly: true });
    expect(database.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(schemaContractErrors(database)).toEqual([]);
    expect(database.prepare("SELECT COUNT(*) AS count FROM strategic_goals").get()).toEqual({ count: 10 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM users WHERE username = 'admin'").get()).toEqual({ count: 1 });
    database.close();
  });
});
