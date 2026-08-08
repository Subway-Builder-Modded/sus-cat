import { describe, expect, it } from "vitest";

import { ConfirmationStore } from "../src/moderation/interactions/confirmation-store.js";

describe("destructive action confirmation", () => {
  const payload = { type: "ban", guildId: "123", actorId: "456", targetId: "789", reason: "Raid participation", deleteSeconds: 0, idempotencyKey: "interaction" } as const;

  it("binds confirmation to its initiating moderator", () => {
    const store = new ConfirmationStore();
    const token = store.create(payload);
    expect(() => store.consume(token, "intruder")).toThrow("Only the moderator");
    expect(store.consume(token, "456")).toEqual(payload);
  });

  it("prevents double execution", () => {
    const store = new ConfirmationStore();
    const token = store.create(payload);
    store.consume(token, "456");
    expect(() => store.consume(token, "456")).toThrow("already been processed");
  });
});
