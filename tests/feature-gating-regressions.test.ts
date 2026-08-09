import { describe, expect, it } from "vitest";

import { requireActionEvidenceEnabled } from "../src/modules/moderation/interactions/action-evidence.js";
import { caseActionFeature } from "../src/modules/moderation/commands/case-action.js";
import { caseOverview } from "../src/modules/moderation/ui/cases/case-view.js";
import { parseComponentId } from "../src/modules/moderation/utils/custom-id.js";
import { moderationManifest } from "../src/modules/moderation/manifest.js";

describe("moderation feature-gating regressions", () => {
  it("maps case-created Discord actions to their own feature switches", () => {
    expect(caseActionFeature("warn")).toBe("warnings");
    expect(caseActionFeature("timeout")).toBe("timeouts");
    expect(caseActionFeature("kick")).toBe("kicks");
    expect(caseActionFeature("ban")).toBe("bans");
  });

  it("keeps destructive and externally visible features off by default", () => {
    const optInFeatures = ["audit-log", "bans", "channel-locks", "evidence", "kicks", "nickname", "purge", "slowmode", "sudo", "timeouts", "user-notifications"];
    expect(moderationManifest.features.filter((feature) => optInFeatures.includes(feature.id)).every((feature) => !feature.defaultEnabled)).toBe(true);
  });

  it("rejects requested evidence before an action when Evidence is disabled", async () => {
    const client = { platform: { settings: { isFeatureEnabled: async () => false } } };
    await expect(requireActionEvidenceEnabled(client as never, "guild", "proof", false)).rejects.toThrow("Evidence is disabled");
    await expect(requireActionEvidenceEnabled(client as never, "guild", "proof", true)).resolves.toBeUndefined();
  });

  it("hides case evidence controls while Evidence is disabled", () => {
    const view = caseOverview({
      case: { id: "case", guildId: "guild", caseNumber: 1, targetUserId: "user", createdAt: new Date(), updatedAt: new Date() },
      summary: { total: 0, warnings: 0, timeouts: 0, kicks: 0, bans: 0, unbans: 0, evidence: 0 },
      actorId: "actor",
      isEvidenceEnabled: false,
    });
    const actions = view.components.flatMap((row) => row.components.map((component) => {
      const id = component.toJSON().custom_id;
      return typeof id === "string" ? parseComponentId(id)?.action : undefined;
    }));
    expect(actions).not.toContain("case_evidence");
  });
});
