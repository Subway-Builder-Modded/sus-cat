import { describe, expect, it } from "vitest";

import { readSendMessagesState } from "../src/modules/moderation/utils/lock-state.js";

const values = (result: boolean) => ({ has: () => result });

describe("channel lock state", () => {
  it("preserves explicit allow, deny, and inherited states", () => {
    expect(readSendMessagesState({ allow: values(true), deny: values(false) })).toBe(true);
    expect(readSendMessagesState({ allow: values(false), deny: values(true) })).toBe(false);
    expect(readSendMessagesState({ allow: values(false), deny: values(false) })).toBeNull();
    expect(readSendMessagesState()).toBeNull();
  });
});
