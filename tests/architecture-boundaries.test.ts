import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("core and module boundaries", () => {
  it("keeps product-module imports out of core runtime infrastructure", async () => {
    const files = await sourceFiles(new URL("../src/core/", import.meta.url));
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, file.pathname).not.toMatch(/from ["'][^"']*\/modules\/(?:moderation|documentation)/);
    }
  });

  it("requires guild scope for case, evidence, and channel-lock lookups", async () => {
    const [cases, evidence, locks] = await Promise.all([
      readFile(new URL("../src/modules/moderation/repositories/case-repository.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/modules/moderation/repositories/evidence-repository.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/modules/moderation/repositories/lock-repository.ts", import.meta.url), "utf8"),
    ]);

    expect(cases).toContain("getById(guildId: string, caseId: string)");
    expect(evidence).toContain("list(guildId: string, caseId: string)");
    expect(locks).toContain("create(input:");
    expect(locks).toContain("take(guildId: string, channelId: string)");
  });

  it("keeps persistence and Discord rendering behind their owning boundaries", async () => {
    const root = new URL("../src/", import.meta.url);
    const files = await sourceFiles(root);
    const sources = await Promise.all(files.map(async (file) => ({ file, source: await readFile(file, "utf8") })));
    for (const { file, source } of sources) {
      const path = file.pathname.replaceAll("\\", "/");
      if (path.includes("/commands/") || path.includes("/interactions/") || path.includes("/ui/")) expect(source, path).not.toMatch(/from "drizzle-orm/);
      if (path.includes("/services/")) expect(source, path).not.toMatch(/from "\.\.\/ui\//);
    }
    expect(await readFile(new URL("../src/core/setup/handler.ts", import.meta.url), "utf8")).not.toContain("platform.database.db");
    expect(await readFile(new URL("../src/core/config/handler.ts", import.meta.url), "utf8")).not.toContain("settings.repository");
  });
});

async function sourceFiles(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(new URL(`${entry.name}/`, directory)) : entry.name.endsWith(".ts") ? [new URL(entry.name, directory)] : []));
  return nested.flat();
}
