import { describe, expect, it } from "vitest";

import { createModuleRegistry } from "../src/modules/index.js";
import { buildDocumentationIndex, searchDocumentation } from "../src/modules/documentation/services/indexer.js";

describe("documentation index", () => {
  const index = buildDocumentationIndex(createModuleRegistry().all());

  it("derives module, feature, config, and long-form pages from manifests", () => {
    expect(index.some((page) => page.id === "feature-temporary-bans")).toBe(true);
    expect(index.some((page) => page.id === "config-auditLogChannelId")).toBe(true);
  });

  it("searches locally with useful ranking", () => {
    expect(searchDocumentation(index, "temporary ban")[0]?.title).toMatch(/Temporary Bans|Bans/);
    expect(searchDocumentation(index, "configuration").length).toBeGreaterThan(0);
  });
});
