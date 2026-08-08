import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";

import { requiredVariable } from "../core/environment/environment.js";
import { inspectDeploymentEnvironment } from "../core/environment/deployment-environment.js";
import { createDatabase } from "../core/database/client.js";
import { logDeploymentEnvironment } from "../core/shared/log-deployment-environment.js";
import { logger } from "../core/shared/logger.js";
import { toError } from "../core/shared/to-error.js";

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
