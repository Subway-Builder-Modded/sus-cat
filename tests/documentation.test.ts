import { describe, expect, it } from "vitest";

import { createModuleRegistry } from "../src/modules/index.js";
import { buildDocumentationIndex, searchDocumentation } from "../src/modules/documentation/services/indexer.js";

describe("documentation index", () => {
  const index = buildDocumentationIndex(createModuleRegistry().all());

  it("derives module, feature, config, and long-form pages from manifests", () => {
    expect(index.some((page) => page.id === "feature-user-management")).toBe(true);
    expect(index.some((page) => page.id === "config-auditLogChannelId")).toBe(true);
  });

  it("searches locally with useful ranking", () => {
    expect(searchDocumentation(index, "one case per user")[0]?.title).toMatch(/Cases|Moderation/);
    expect(searchDocumentation(index, "configuration").length).toBeGreaterThan(0);
  });
});
