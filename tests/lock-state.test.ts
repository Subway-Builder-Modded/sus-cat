import { describe, expect, it, vi } from "vitest";

import { readSendMessagesState } from "../src/modules/moderation/utils/lock-state.js";
import { ChannelModerationService } from "../src/modules/moderation/services/channel-moderation-service.js";

const values = (result: boolean) => ({ has: () => result });

describe("channel lock state", () => {
  it("preserves explicit allow, deny, and inherited states", () => {
    expect(readSendMessagesState({ allow: values(true), deny: values(false) })).toBe(true);
    expect(readSendMessagesState({ allow: values(false), deny: values(true) })).toBe(false);
    expect(readSendMessagesState({ allow: values(false), deny: values(false) })).toBeNull();
    expect(readSendMessagesState()).toBeNull();
  });

  it("atomically consumes lock state so duplicate unlock delivery has no second side effect", async () => {
    const state = { guildId: "guild", channelId: "channel", actorId: "actor", previousSendMessages: null, reason: null, createdAt: new Date() };
    const take = vi.fn().mockResolvedValueOnce(state).mockResolvedValueOnce(undefined);
    const edit = vi.fn(async () => undefined);
    const guild = { id: "guild", roles: { everyone: { id: "everyone" } } };
    const channel = { id: "channel", guild, permissionOverwrites: { edit } };
    const actor = { id: "actor", guild };
    const service = new ChannelModerationService(
      { feature: async () => false } as never,
      { take, restore: vi.fn() } as never,
      {} as never,
      {} as never,
      { publish: vi.fn() } as never,
    );
    await expect(service.unlock(channel as never, actor as never)).resolves.toBeUndefined();
    await expect(service.unlock(channel as never, actor as never)).rejects.toThrow("No bot-managed lock state");
    expect(edit).toHaveBeenCalledOnce();
  });
});
