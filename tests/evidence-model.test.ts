import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { evidenceResultMenu } from "../src/modules/moderation/ui/cases/case-view.js";

describe("case evidence model", () => {
  it("stores plain content, optional descriptions/results, and optional entry links without a type enum", async () => {
    const schema = await readFile(new URL("../src/modules/moderation/database/schema.ts", import.meta.url), "utf8");
    expect(schema).toContain('evidence: text("evidence")');
    expect(schema).toContain('caseEntryId: uuid("case_entry_id")');
    expect(schema).toContain('result: evidenceResult("result")');
    expect(schema).not.toContain("moderation_evidence_type");
  });
  it("offers canonical result choices through a select menu", () => {
    const options = evidenceResultMenu("actor", "case", "evidence").components[0]!.toJSON().options.map((option) => option.value);
    expect(options).toEqual(["none", "warn", "timeout", "kick", "ban", "unban", "untimeout"]);
  });
});
