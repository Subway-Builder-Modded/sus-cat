import { AuditLogEvent } from "discord.js";
import { describe, expect, it } from "vitest";

import { shouldIncludeAuditEvent } from "../src/modules/moderation/audit/native-audit-handler.js";

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
});
