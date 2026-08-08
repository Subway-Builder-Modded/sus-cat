import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";

import { requiredVariable } from "../config/environment.js";
import { inspectDeploymentEnvironment } from "../config/deployment-environment.js";
import { createDatabase } from "../database/client.js";
import { logDeploymentEnvironment } from "../shared/log-deployment-environment.js";
import { logger } from "../shared/logger.js";
import { toError } from "../shared/to-error.js";

async function runMigrations(): Promise<void> {
  logDeploymentEnvironment(inspectDeploymentEnvironment());
  const database = createDatabase(requiredVariable("DATABASE_URL"));
  const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
  logger.info("[database] Running migrations");
  try {
    await migrate(database.db, { migrationsFolder });
    logger.info("[database] Migration complete");
  } finally {
    await database.close();
  }
}

runMigrations().catch((error: unknown) => {
  logger.error("[database] Migration failed", toError(error));
  process.exitCode = 1;
});
