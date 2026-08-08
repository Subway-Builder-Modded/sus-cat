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
  const variables = Object.fromEntries(
    requiredDeploymentVariables.map((name) => [name, Boolean(source[name]?.trim())]),
  ) as Record<RequiredDeploymentVariable, boolean>;

  return {
    variables,
    missing: requiredDeploymentVariables.filter((name) => !variables[name]),
    railwayService: source.RAILWAY_SERVICE_NAME?.trim() || null,
    railwayEnvironment: source.RAILWAY_ENVIRONMENT_NAME?.trim() || null,
    nodeEnvironment: source.NODE_ENV?.trim() || null,
  };
}
