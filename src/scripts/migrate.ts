import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";

import { requiredVariable } from "../config/environment.js";
import { createDatabase } from "../database/client.js";
import { logger } from "../shared/logger.js";
import { toError } from "../shared/to-error.js";

async function runMigrations(): Promise<void> {
  const database = createDatabase(requiredVariable("DATABASE_URL"));
  const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
  logger.info("Applying database migrations");
  try {
    await migrate(database.db, { migrationsFolder });
    logger.info("Database migrations complete");
  } finally {
    await database.close();
  }
}

runMigrations().catch((error: unknown) => {
  logger.error("Database migration failed", toError(error));
  process.exitCode = 1;
});
