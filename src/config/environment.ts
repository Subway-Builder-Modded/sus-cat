import "dotenv/config";

export interface Environment {
  readonly discordToken: string;
  readonly discordClientId?: string;
  readonly discordGuildId?: string;
  readonly databaseUrl?: string;
  readonly port: number;
}

export function loadEnvironment(options: { requireDatabase?: boolean } = {}): Environment {
  const discordClientId = optionalVariable("DISCORD_CLIENT_ID");
  const discordGuildId = optionalVariable("DISCORD_GUILD_ID");
  const databaseUrl = options.requireDatabase
    ? requiredVariable("DATABASE_URL")
    : optionalVariable("DATABASE_URL");

  const port = parsePort(optionalVariable("PORT") ?? "3000");

  return {
    discordToken: requiredVariable("DISCORD_TOKEN"),
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

export function requiredVariable(name: string): string {
  const value = optionalVariable(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalVariable(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}
