import type { DeploymentEnvironmentReport } from "../environment/deployment-environment.js";
import { logger } from "./logger.js";

export function logDeploymentEnvironment(report: DeploymentEnvironmentReport): void {
  logger.info("[deploy] Deployment environment check", {
    databaseUrlPresent: report.variables.DATABASE_URL,
    discordTokenPresent: report.variables.DISCORD_TOKEN,
    discordClientIdPresent: report.variables.DISCORD_CLIENT_ID,
    railwayService: report.railwayService ?? "not detected",
    railwayEnvironment: report.railwayEnvironment ?? "not detected",
    nodeEnvironment: report.nodeEnvironment ?? "not set",
  });

  for (const name of ["DATABASE_URL", "DISCORD_TOKEN", "DISCORD_CLIENT_ID"] as const) {
    logger.info(`[deploy] ${name} ${report.variables[name] ? "✓ present" : "✗ missing"}`);
  }
}
