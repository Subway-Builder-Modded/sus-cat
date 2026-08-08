import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as coreSchema from "./schema.js";
import * as moderationSchema from "../../modules/moderation/database/schema.js";

const schema = { ...coreSchema, ...moderationSchema };

export function createDatabase(databaseUrl: string) {
  const connection = postgres(databaseUrl, {
    max: 10,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 30,
    max_lifetime: 60 * 30,
  });
  return {
    db: drizzle(connection, { schema }),
    ping: async () => {
      await connection`select 1`;
    },
    close: () => connection.end({ timeout: 5 }),
  };
}

export type Database = ReturnType<typeof createDatabase>["db"];
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
