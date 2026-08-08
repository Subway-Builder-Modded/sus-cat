import { describe, expect, it, vi } from "vitest";

import { ModerationService } from "../src/modules/moderation/services/moderation-service.js";

function fixture(silent: boolean, auditEnabled = true) {
  const append = vi.fn(async () => ({ case: { id: "case", caseNumber: 1 }, entry: { id: "entry" } }));
  const audit = vi.fn();
  const cases = { reserveAction: vi.fn(async () => true), findEntryByIdempotency: vi.fn(), append, audit };
  const configs = { feature: vi.fn(async (_guild: string, feature: string) => feature === "cases" || feature === "user-notifications" || (feature === "audit-log" && auditEnabled)), get: vi.fn(async () => ({ rulesUrl: null, moderationLogChannelId: null })) };
  const send = vi.fn(async () => undefined), ban = vi.fn(async () => undefined), kick = vi.fn(async () => undefined), timeout = vi.fn(async () => undefined);
  const roles = { highest: { comparePositionTo: () => 1 } };
  const user = { id: "target", send, displayAvatarURL: () => "https://example.com/avatar.png" };
  const guild = { id: "guild", name: "Guild", iconURL: () => null, members: { me: { id: "bot", roles }, ban, fetch: vi.fn(), unban: vi.fn() }, channels: { fetch: vi.fn() } };
  const actor = { id: "actor", guild, roles, toString: () => "<@actor>" };
  const target = { id: "target", guild, roles, user, kick, timeout, toString: () => "<@target>" };
  const context = { guild, actor, target, reason: "Repeated harassment", silent, idempotencyKey: "interaction" };
  return { service: new ModerationService(cases as never, configs as never), context: context as never, append, audit, send, ban, kick, timeout };
}

describe("silent moderation actions", () => {
  it.each(["warn", "timeout", "kick", "ban"] as const)("performs silent %s without case entry or DM while retaining audit", async (action) => {
    const item = fixture(true);
    if (action === "warn") await item.service.warn(item.context);
    else if (action === "timeout") await item.service.timeout(item.context, 60_000);
    else if (action === "kick") await item.service.kick(item.context);
    else await item.service.ban(item.context);
    expect(item.append).not.toHaveBeenCalled();
    expect(item.send).not.toHaveBeenCalled();
    expect(item.audit).toHaveBeenCalledWith("action.completed", expect.anything(), expect.anything(), undefined, "target", expect.objectContaining({ silent: true }), undefined, undefined, undefined, "completed:interaction");
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
});
