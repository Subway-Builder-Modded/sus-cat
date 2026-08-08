import addMessageEvidence from "./context/add-message-evidence.js";
import ban from "./ban.js";
import caseCommand from "./case.js";
import kick from "./kick.js";
import lock from "./lock.js";
import moderation from "./moderation.js";
import nickname from "./nickname.js";
import purge from "./purge.js";
import slowmode from "./slowmode.js";
import sudo from "./sudo.js";
import timeout from "./timeout.js";
import unban from "./unban.js";
import unlock from "./unlock.js";
import untimeout from "./untimeout.js";
import user from "./user.js";
import warn from "./warn.js";

export const moderationCommands = [ban, caseCommand, kick, lock, moderation, nickname, purge, slowmode, sudo, timeout, unban, unlock, untimeout, user, warn, addMessageEvidence] as const;
