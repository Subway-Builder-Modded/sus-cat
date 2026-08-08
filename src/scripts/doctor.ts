import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createBotClient } from "../core/bot/create-client.js";
import { loadCommands } from "../core/commands/load-commands.js";
import { createDatabase } from "../core/database/client.js";
import { inspectDeploymentEnvironment } from "../core/environment/deployment-environment.js";
import { logger } from "../core/shared/logger.js";
import { toError } from "../core/shared/to-error.js";

async function doctor(): Promise<void> {
  const report = inspectDeploymentEnvironment();
  logger.info("[doctor] Environment metadata", { missing: report.missing, railwayService: report.railwayService ?? "local", railwayEnvironment: report.railwayEnvironment ?? "local", secretsPrinted: false });
  const client = createBotClient();
  await loadCommands(client);
  await access(fileURLToPath(new URL("../../drizzle/meta/_journal.json", import.meta.url)));
  logger.info("[doctor] Registry and migrations valid", { modules: client.modules.all().length, commands: client.commands.size });
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const database = createDatabase(databaseUrl);
    try { await database.ping(); logger.info("[doctor] Database connectivity valid"); }
    finally { await database.close(); }
  } else logger.warn("[doctor] Database connectivity skipped: DATABASE_URL is absent");
}

doctor().catch((error: unknown) => {
  logger.error("[doctor] Validation failed", toError(error));
  process.exitCode = 1;
});
