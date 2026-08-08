import type { BotClient } from "../../bot/bot-client.js";
import { logger } from "../../shared/logger.js";
import { toError } from "../../shared/to-error.js";
import type { CaseRepository } from "../repositories/case-repository.js";
import { isScheduledCaseActionable } from "../domain/scheduled-action.js";

export class ExpirationService {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly cases: CaseRepository) {}

  start(client: BotClient): void {
    if (this.timer) return;
    void this.process(client);
    this.timer = setInterval(() => void this.process(client), 30_000);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async process(client: BotClient): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const actions = await this.cases.claimDue();
      for (const action of actions) {
        try {
          const item = await this.cases.getById(action.caseId);
          if (!isScheduledCaseActionable(item?.status)) {
            await this.cases.finishScheduled(action.id, true);
            continue;
          }
          const guild = await client.guilds.fetch(action.guildId);
          if (action.action === "unban") await guild.members.unban(action.targetUserId, "Temporary ban expired");
          await this.cases.transition(action.caseId, "expired", client.user?.id ?? "system", { scheduledActionId: action.id });
          await this.cases.audit("punishment.expired", action.guildId, client.user?.id ?? "system", action.caseId, action.targetUserId, { action: action.action });
          await this.cases.finishScheduled(action.id, true);
        } catch (error: unknown) {
          await this.cases.finishScheduled(action.id, false, toError(error).message.slice(0, 500));
          logger.error("Scheduled moderation action failed", { actionId: action.id, guildId: action.guildId, error: toError(error).message });
        }
      }
    } catch (error: unknown) {
      logger.error("Expiration worker failed", toError(error));
    } finally {
      this.running = false;
    }
  }
}
