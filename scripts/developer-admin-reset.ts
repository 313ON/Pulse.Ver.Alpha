#!/usr/bin/env node
import process from "node:process";
// @ts-expect-error Node's type-stripping loader resolves the explicit .ts entrypoint.
import { assertDeveloperRecoveryEnvironment, recoverDeveloperAdminPassword } from "../src/server/developerAdminRecovery.ts";

function readHiddenPassword(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("An interactive terminal is required for developer admin recovery.");
  }

  return new Promise((resolve, reject) => {
    let password = "";
    const input = process.stdin;

    const cleanup = () => {
      input.setRawMode?.(false);
      input.pause();
      input.removeListener("data", onData);
      input.removeListener("error", onError);
    };

    const finish = () => {
      cleanup();
      process.stdout.write("\n");
      resolve(password);
    };

    const onError = (error: Error) => {
      cleanup();
      process.stdout.write("\n");
      reject(error);
    };

    const onData = (chunk: Buffer | string) => {
      const text = String(chunk);
      for (const character of text) {
        if (character === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Developer admin recovery cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = password.slice(0, -1);
          continue;
        }
        password += character;
      }
    };

    input.setRawMode?.(true);
    input.resume();
    input.on("data", onData);
    input.on("error", onError);
  });
}

async function main() {
  assertDeveloperRecoveryEnvironment();
  process.stdout.write("Developer admin password: ");
  const password = await readHiddenPassword();
  recoverDeveloperAdminPassword(password);
  process.stdout.write("Developer admin password reset completed.\n");
  process.stdout.write("Audit event recorded for the existing admin account.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Developer admin recovery failed.";
  process.stderr.write(`Developer admin recovery failed: ${message}\n`);
  process.exitCode = 1;
});
