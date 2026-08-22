import { closeDatabase, checkDatabaseReadiness, getDatabase } from "./db";
import { seedBaseline } from "./seed";
import { seedAuthFoundation } from "./auth";

const databasePath = process.argv[2];
if (!databasePath) throw new Error("A database path is required.");

(process.env as Record<string, string | undefined>).NODE_ENV = "development";
process.env.PULSE_DB_PATH = databasePath;
process.env.PULSE_ADMIN_PASSWORD = "concurrency-test-password-123";

try {
  getDatabase();
  seedBaseline();
  seedAuthFoundation();
  checkDatabaseReadiness();
} finally {
  closeDatabase();
}
