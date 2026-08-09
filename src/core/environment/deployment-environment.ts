import type { EnvironmentSource } from "./environment.js";

export const requiredDeploymentVariables = [
  "DATABASE_URL",
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
] as const;

export type RequiredDeploymentVariable = (typeof requiredDeploymentVariables)[number];

export interface DeploymentEnvironmentReport {
  readonly variables: Record<RequiredDeploymentVariable, boolean>;
  readonly missing: RequiredDeploymentVariable[];
  readonly railwayService: string | null;
  readonly railwayEnvironment: string | null;
  readonly nodeEnvironment: string | null;
}

export function inspectDeploymentEnvironment(
  source: EnvironmentSource = process.env,
): DeploymentEnvironmentReport {
  const variables: Record<RequiredDeploymentVariable, boolean> = {
    DATABASE_URL: Boolean(source.DATABASE_URL?.trim()),
    DISCORD_TOKEN: Boolean(source.DISCORD_TOKEN?.trim()),
    DISCORD_CLIENT_ID: Boolean(source.DISCORD_CLIENT_ID?.trim()),
  };

  return {
    variables,
    missing: requiredDeploymentVariables.filter((name) => !variables[name]),
    railwayService: source.RAILWAY_SERVICE_NAME?.trim() || null,
    railwayEnvironment: source.RAILWAY_ENVIRONMENT_NAME?.trim() || null,
    nodeEnvironment: source.NODE_ENV?.trim() || null,
  };
}
