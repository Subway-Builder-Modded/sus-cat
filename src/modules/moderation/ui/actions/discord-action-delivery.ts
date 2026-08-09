import type { User } from "discord.js";

import type { ActionDelivery, PublishedActionInput } from "../../services/action-delivery.js";
import { publishAuditLog } from "./audit-log-publisher.js";
import { sendActionNotice } from "./dm-notice.js";

export class DiscordActionDelivery implements ActionDelivery {
  async notifyUser(user: User, input: Parameters<ActionDelivery["notifyUser"]>[1]): Promise<boolean> {
    return sendActionNotice(user, input);
  }

  async publish(guild: Parameters<ActionDelivery["publish"]>[0], auditLogChannelId: string, input: PublishedActionInput): Promise<void> {
    const { details, ...card } = input;
    await publishAuditLog(guild, auditLogChannelId, { ...card, ...(details ? { details: [...details] } : {}) });
  }
}
