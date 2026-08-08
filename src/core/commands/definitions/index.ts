import config from "./config.js";
import setup from "./setup.js";
import status from "./status.js";
import resetsetup from "./resetsetup.js";

export const coreCommands = [setup, config, resetsetup, status] as const;
