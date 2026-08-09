import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApplicationClient } from "../src/create-application-client.js";
import type { BotClient } from "../src/core/bot/bot-client.js";
import { loadCommands } from "../src/core/commands/load-commands.js";

interface CommandOptionNode {
  readonly name: string;
  readonly required?: boolean;
  readonly options?: readonly CommandOptionNode[];
}

interface CommandDefinition {
  readonly name: string;
  readonly options?: readonly CommandOptionNode[];
}

describe("application command option ordering", () => {
  let client: BotClient;

  beforeAll(async () => {
    client = createApplicationClient();
    await loadCommands(client);
  });

  afterAll(() => client.destroy());

  it("loads every command definition", () => {
    expect(client.commands.size).toBeGreaterThan(0);
  });

  it("places every required option before optional siblings recursively", () => {
    const violations = [...client.commands.values()].flatMap((command) => {
      const definition = command.data.toJSON() as CommandDefinition;
      return findOrderingViolations(definition.options ?? [], `/${definition.name}`);
    });

    expect(violations).toEqual([]);
  });
});

function findOrderingViolations(
  options: readonly CommandOptionNode[],
  path: string,
): string[] {
  const violations: string[] = [];
  let optionalOptionSeen = false;

  for (const option of options) {
    if (option.options) {
      violations.push(...findOrderingViolations(option.options, `${path} ${option.name}`));
      continue;
    }

    if (option.required === true && optionalOptionSeen) {
      violations.push(`${path}: required option '${option.name}' follows an optional option`);
    } else if (option.required !== true) {
      optionalOptionSeen = true;
    }
  }

  return violations;
}
