import { Collection } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { CaseChannelService } from "../src/modules/moderation/services/case-channel-service.js";
import { PurgeService } from "../src/modules/moderation/services/purge-service.js";

describe("destructive interaction idempotency", () => {
  it("reserves a purge interaction before scanning or deleting messages", async () => {
    const reserve = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const service = new PurgeService(
      { get: async () => ({ purgeScanLimit: 100 }), feature: async () => false } as never,
      { reserve } as never,
      { record: vi.fn() } as never,
      { publish: vi.fn() } as never,
    );
    const fetch = vi.fn(async () => new Collection());
    const guild = { id: "guild" };
    const channel = { id: "channel", guild, messages: { fetch }, bulkDelete: vi.fn() };
    const actor = { id: "actor", guild };

    await expect(service.execute([channel] as never, actor as never, { count: 10 }, "interaction")).resolves.toMatchObject({ deleted: 0 });
    await expect(service.execute([channel] as never, actor as never, { count: 10 }, "interaction")).rejects.toThrow("already been processed");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects a replayed case-channel request before creating a channel or case entry", async () => {
    const append = vi.fn();
    const create = vi.fn();
    const service = new CaseChannelService(
      { append, updateEntryMetadata: vi.fn() } as never,
      { reserve: async () => false } as never,
      { record: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const guild = { id: "guild", channels: { create } };
    await expect(service.create({ guild: guild as never, actor: { id: "actor" } as never, target: { id: "target" } as never, idempotencyKey: "interaction" })).rejects.toThrow("already been processed");
    expect(append).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
