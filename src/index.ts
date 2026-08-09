import { createApplicationClient } from "./create-application-client.js";
import { startBot } from "./core/bot/start-bot.js";
import { loadEnvironment } from "./core/environment/environment.js";
import { HealthServer } from "./core/health/health-server.js";
import { logger } from "./core/shared/logger.js";
import { toError } from "./core/shared/to-error.js";

async function main(): Promise<void> {
  const environment = loadEnvironment({ requireDatabase: true });
  const client = createApplicationClient(environment.databaseUrl);
  const health = new HealthServer(client, environment.port);
  let shuttingDown = false;

  const shutdown = async (reason: string, exitCode: number): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down bot", { reason, exitCode });
    await health.close().catch((error: unknown) => logger.warn("Health server shutdown failed", toError(error)));
    client.destroy();
    await client.closeModuleServices();
    await client.runtime?.database.close().catch((error: unknown) => logger.warn("Database shutdown failed", toError(error)));
    process.exitCode = exitCode;
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM", 0));
  process.once("SIGINT", () => void shutdown("SIGINT", 0));
  process.once("uncaughtException", (error) => {
    logger.error("Uncaught exception", toError(error));
    void shutdown("uncaughtException", 1).finally(() => process.exit(1));
  });
  process.once("unhandledRejection", (error) => {
    logger.error("Unhandled rejection", toError(error));
    void shutdown("unhandledRejection", 1).finally(() => process.exit(1));
  });

  logger.info("Starting bot runtime", {
    nodeVersion: process.version,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? "development",
    service: process.env.RAILWAY_SERVICE_NAME ?? "local",
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? "none",
  });

  try {
    await health.start();
    await startBot(client, environment.discordToken);
  } catch (error: unknown) {
    await shutdown("startup failure", 1);
    throw error;
  }
}

main().catch((error: unknown) => {
  logger.error("Bot failed to start", toError(error));
  process.exitCode = 1;
});
