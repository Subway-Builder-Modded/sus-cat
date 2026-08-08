import { config as loadDotEnv } from "dotenv";

// Railway injects production variables into process.env. A local .env file is
// optional and must never overwrite values already supplied by the process.
loadDotEnv({ override: false, quiet: true });

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export interface Environment {
  readonly discordToken: string;
  readonly discordClientId?: string;
  readonly discordGuildId?: string;
  readonly databaseUrl?: string;
  readonly port: number;
}

export function loadEnvironment(
  options: { requireDatabase?: boolean } = {},
  source: EnvironmentSource = process.env,
): Environment {
  const discordClientId = optionalVariable("DISCORD_CLIENT_ID", source);
  const discordGuildId = optionalVariable("DISCORD_GUILD_ID", source);
  const databaseUrl = options.requireDatabase
    ? requiredVariable("DATABASE_URL", source)
    : optionalVariable("DATABASE_URL", source);

  const port = parsePort(optionalVariable("PORT", source) ?? "3000");

  return {
    discordToken: requiredVariable("DISCORD_TOKEN", source),
    ...(discordClientId ? { discordClientId } : {}),
    ...(discordGuildId ? { discordGuildId } : {}),
    ...(databaseUrl ? { databaseUrl } : {}),
    port,
  };
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be an integer between 1 and 65535");
  return port;
}

export function requiredVariable(name: string, source: EnvironmentSource = process.env): string {
  const value = optionalVariable(name, source);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalVariable(name: string, source: EnvironmentSource): string | undefined {
  const value = source[name]?.trim();
  return value || undefined;
}
