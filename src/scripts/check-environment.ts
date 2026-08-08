import { inspectDeploymentEnvironment } from "../core/environment/deployment-environment.js";
import { logDeploymentEnvironment } from "../core/shared/log-deployment-environment.js";
import { logger } from "../core/shared/logger.js";

function checkEnvironment(): void {
  const report = inspectDeploymentEnvironment();
  logDeploymentEnvironment(report);

  if (report.missing.length > 0) {
    logger.error("[deploy] Deployment environment validation failed", {
      missing: report.missing.join(", "),
      railwayService: report.railwayService ?? "not detected",
      railwayEnvironment: report.railwayEnvironment ?? "not detected",
      guidance: "Required variables must exist on this bot service in this Railway environment and staged variable changes must be deployed.",
      secretsPrinted: false,
    });
    process.exitCode = 1;
    return;
  }

  logger.info("[deploy] Environment validation passed");
}

checkEnvironment();
