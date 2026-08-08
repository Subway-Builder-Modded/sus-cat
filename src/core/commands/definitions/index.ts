import config from "./config.js";
import setup from "./setup.js";
import status from "./status.js";

export const coreCommands = [setup, config, status] as const;
