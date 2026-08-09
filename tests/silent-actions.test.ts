import { describe, expect, it, vi } from "vitest";

import { ModerationService } from "../src/modules/moderation/services/moderation-service.js";

function fixture(silent: boolean, auditEnabled = true) {
  const append = vi.fn(async () => ({ case: { id: "case", caseNumber: 1 }, entry: { id: "entry" } }));
  const audit = vi.fn();
  const cases = { findEntryByIdempotency: vi.fn(), append };
  const receipts = { reserve: vi.fn(async () => true) };
  const audits = { record: audit };
  const configs = { feature: vi.fn(async (_guild: string, feature: string) => feature === "cases" || feature === "user-notifications" || (feature === "audit-log" && auditEnabled)), get: vi.fn(async () => ({ rulesUrl: null, auditLogChannelId: null })) };
  const notifyUser = vi.fn(async () => true), delivery = { notifyUser, publish: vi.fn() };
  const ban = vi.fn(async () => undefined), kick = vi.fn(async () => undefined), timeout = vi.fn(async () => undefined);
  const roles = { highest: { comparePositionTo: () => 1 } };
  const user = { id: "target", displayAvatarURL: () => "https://example.com/avatar.png" };
  const guild = { id: "guild", name: "Guild", iconURL: () => null, members: { me: { id: "bot", roles }, ban, fetch: vi.fn(), unban: vi.fn() }, channels: { fetch: vi.fn() } };
  const actor = { id: "actor", guild, roles, toString: () => "<@actor>" };
  const target = { id: "target", guild, roles, user, kick, timeout, toString: () => "<@target>" };
  const context = { guild, actor, target, reason: "Repeated harassment", silent, idempotencyKey: "interaction" };
  return { service: new ModerationService(cases as never, receipts as never, audits as never, configs as never, delivery as never), context: context as never, append, audit, notifyUser, ban, kick, timeout };
}

describe("silent moderation actions", () => {
  it.each(["warn", "timeout", "kick", "ban"] as const)("performs silent %s without case entry or DM while retaining audit", async (action) => {
    const item = fixture(true);
    if (action === "warn") await item.service.warn(item.context);
    else if (action === "timeout") await item.service.timeout(item.context, 60_000);
    else if (action === "kick") await item.service.kick(item.context);
    else await item.service.ban(item.context);
    expect(item.append).not.toHaveBeenCalled();
    expect(item.notifyUser).not.toHaveBeenCalled();
    expect(item.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: "action.completed", guildId: "guild", targetUserId: "target", metadata: expect.objectContaining({ silent: true }), sourceEventId: "completed:interaction" }));
  });
  it("reuses one user case while appending multiple non-silent entries", async () => {
    const item = fixture(false);
    await item.service.warn({ ...item.context, idempotencyKey: "warn" });
    await item.service.timeout({ ...item.context, idempotencyKey: "timeout" }, 60_000);
    await item.service.ban({ ...item.context, idempotencyKey: "ban" });
    expect(item.append).toHaveBeenCalledTimes(3);
    expect(item.append.mock.results.every((result) => result.type === "return")).toBe(true);
  });
  it("does not write audit records when Audit Log is disabled", async () => {
    const item = fixture(false, false);
    await item.service.warn(item.context);
    expect(item.audit).not.toHaveBeenCalled();
  });
  it("does not report a completed Discord action as failed when secondary audit lookup fails", async () => {
    const item = fixture(false);
    const feature = vi.fn(async (_guild: string, featureId: string) => {
      if (featureId === "audit-log") throw new Error("database unavailable");
      return featureId === "cases" || featureId === "user-notifications";
    });
    const service = new ModerationService(
      { findEntryByIdempotency: vi.fn(), append: item.append } as never,
      { reserve: vi.fn(async () => true) } as never,
      { record: item.audit } as never,
      { feature } as never,
      { notifyUser: item.notifyUser, publish: vi.fn() } as never,
    );
    await expect(service.timeout(item.context, 60_000)).resolves.toMatchObject({ action: "timeout" });
    expect(item.timeout).toHaveBeenCalledOnce();
  });
  it("reports partial success when case persistence fails after a Discord action", async () => {
    const item = fixture(false);
    item.append.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(item.service.timeout(item.context, 60_000)).rejects.toThrow("succeeded in Discord");
    expect(item.timeout).toHaveBeenCalledOnce();
  });
});
