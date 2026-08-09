import { describe, expect, it } from "vitest";

import { componentId, parseComponentId } from "../src/core/interactions/custom-id.js";
import { moderationModule } from "../src/modules/moderation/index.js";

describe("module component routing", () => {
  it("round-trips structured safe routes", () => {
    const id = componentId("module", "moderation", "case_evidence", "actor", "case");
    expect(parseComponentId(id)).toEqual({ namespace: "module", owner: "moderation", action: "case_evidence", parts: ["actor", "case"] });
    expect(moderationModule.featureForComponent?.("case_evidence")).toBe("evidence");
    expect(moderationModule.isConfigurationComponent?.("config_home")).toBe(true);
    expect(moderationModule.isConfigurationComponent?.("modal_type_edit")).toBe(true);
    expect(moderationModule.featureForComponent?.("config_home")).toBeUndefined();
    expect(moderationModule.componentAcknowledgement?.("case_evidence")).toBe("defer-update");
    expect(moderationModule.componentAcknowledgement?.("case_evidence_add")).toBe("modal");
  });

  it("rejects unsafe and oversized IDs", () => {
    expect(() => componentId("module", "bad owner", "action")).toThrow("Unsafe");
    expect(() => componentId("module", "owner", "action", "x".repeat(100))).toThrow("too long");
  });
});
