import { populate } from "dotenv";
import { afterEach, describe, expect, it } from "vitest";

import { inspectDeploymentEnvironment } from "../src/config/deployment-environment.js";
import { loadEnvironment, requiredVariable } from "../src/config/environment.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("environment loading", () => {
  it("loads a required database URL from the provided process environment", () => {
    const environment = loadEnvironment(
      { requireDatabase: true },
      {
        DATABASE_URL: "postgresql://example",
        DISCORD_TOKEN: "test-token",
        DISCORD_CLIENT_ID: "test-client",
      },
    );

    expect(environment.databaseUrl).toBe("postgresql://example");
  });

  it("rejects a missing database URL", () => {
    expect(() => requiredVariable("DATABASE_URL", {})).toThrow(
      "Missing required environment variable: DATABASE_URL",
    );
  });

  it.each(["", "   "])("treats %j as a missing database URL", (value) => {
    expect(() => requiredVariable("DATABASE_URL", { DATABASE_URL: value })).toThrow(
      "Missing required environment variable: DATABASE_URL",
    );
  });

  it("reads an already inherited process variable without requiring a .env file", () => {
    process.env.DATABASE_URL = "postgresql://inherited-process-value";
    expect(requiredVariable("DATABASE_URL")).toBe("postgresql://inherited-process-value");
  });

  it("does not let local dotenv values overwrite an existing process variable", () => {
    const environment = { DATABASE_URL: "postgresql://railway-process-value" };
    populate(environment, { DATABASE_URL: "postgresql://local-dotenv-value" });
    expect(environment.DATABASE_URL).toBe("postgresql://railway-process-value");
  });

  it("reports only presence metadata and the Railway execution scope", () => {
    const report = inspectDeploymentEnvironment({
      DATABASE_URL: "postgresql://example",
      DISCORD_TOKEN: "token",
      DISCORD_CLIENT_ID: "client",
      RAILWAY_SERVICE_NAME: "sus-cat",
      RAILWAY_ENVIRONMENT_NAME: "production",
      NODE_ENV: "production",
    });

    expect(report).toEqual({
      variables: {
        DATABASE_URL: true,
        DISCORD_TOKEN: true,
        DISCORD_CLIENT_ID: true,
      },
      missing: [],
      railwayService: "sus-cat",
      railwayEnvironment: "production",
      nodeEnvironment: "production",
    });
  });
});
