import { defineConfig } from "drizzle-kit";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for database commands");
}

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/core/database/schema.ts", "./src/modules/*/database/schema.ts"],
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
});
