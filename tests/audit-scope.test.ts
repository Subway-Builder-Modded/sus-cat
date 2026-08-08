import { AuditLogEvent } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import { shouldIncludeAuditEvent } from "../src/modules/moderation/audit/native-audit-handler.js";
import { moderationManifest } from "../src/modules/moderation/manifest.js";
import { publishAuditLog } from "../src/modules/moderation/ui/actions/audit-log-publisher.js";

describe("audit scopes", () => {
  it("limits Moderation Only to moderation events", () => {
    expect(shouldIncludeAuditEvent("moderation", AuditLogEvent.MemberBanAdd)).toBe(true);
    expect(shouldIncludeAuditEvent("moderation", AuditLogEvent.ChannelCreate)).toBe(false);
  });
  it("includes server management in Full scope", () => {
    expect(shouldIncludeAuditEvent("full", AuditLogEvent.MemberBanAdd)).toBe(true);
    expect(shouldIncludeAuditEvent("full", AuditLogEvent.ChannelCreate)).toBe(true);
    expect(shouldIncludeAuditEvent("full", AuditLogEvent.RoleUpdate)).toBe(true);
  });
  it("uses one Audit Log feature and one channel setting", () => {
    expect(moderationManifest.features.some((feature) => feature.id === "audit-log")).toBe(true);
    expect(moderationManifest.features.some((feature) => feature.id === "moderation-log")).toBe(false);
    expect(moderationManifest.config.filter((field) => field.key.toLocaleLowerCase().includes("logchannel"))).toHaveLength(1);
    expect(moderationManifest.config.find((field) => field.key === "auditLogChannelId")?.label).toBe("Log Channel");
  });
  it("publishes bot actions to the unified channel", async () => {
    const send = vi.fn(async () => undefined), fetch = vi.fn(async () => ({ isSendable: () => true, send }));
    const configs = { feature: vi.fn(async () => true), get: vi.fn(async () => ({ auditLogChannelId: "log-channel", auditScope: "moderation" })) };
    const guild = { id: "guild", channels: { fetch } }, actor = { id: "actor", toString: () => "<@actor>" };
    await publishAuditLog(configs as never, guild as never, { action: "purge", actor: actor as never, result: "3 messages" });
    expect(fetch).toHaveBeenCalledWith("log-channel");
    expect(send).toHaveBeenCalledOnce();
  });
});
