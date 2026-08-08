import type { ConfigDefinition, ConfigValue } from "./definitions.js";

const snowflake = /^\d{17,20}$/;

export function validateConfigValue(definition: ConfigDefinition, value: unknown): ConfigValue {
  if (value === null) {
    if (definition.required) throw new Error(`${definition.label} is required.`);
    return null;
  }
  if (definition.type === "boolean") {
    if (typeof value !== "boolean") throw invalid(definition);
    return value;
  }
  if (definition.type === "integer" || definition.type === "duration") {
    if (typeof value !== "number" || !Number.isInteger(value)) throw invalid(definition);
    if (definition.min !== undefined && value < definition.min) throw new Error(`${definition.label} must be at least ${definition.min}.`);
    if (definition.max !== undefined && value > definition.max) throw new Error(`${definition.label} must be at most ${definition.max}.`);
    return value;
  }
  if (["string-list", "role-list", "channel-list"].includes(definition.type)) {
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw invalid(definition);
    if (definition.type !== "string-list" && !value.every((item) => snowflake.test(item))) throw invalid(definition);
    return [...new Set(value)];
  }
  if (typeof value !== "string") throw invalid(definition);
  const normalized = value.trim();
  if (definition.required && !normalized) throw new Error(`${definition.label} is required.`);
  if (["channel", "role"].includes(definition.type) && normalized && !snowflake.test(normalized)) throw invalid(definition);
  if (definition.type === "url" && normalized) {
    try {
      const url = new URL(normalized);
      if (!['http:', 'https:'].includes(url.protocol)) throw invalid(definition);
    } catch {
      throw invalid(definition);
    }
  }
  if (definition.type === "enum" && normalized && !definition.choices?.some((choice) => choice.value === normalized)) throw invalid(definition);
  return normalized;
}

function invalid(definition: ConfigDefinition): Error {
  return new Error(`${definition.label} has an invalid ${definition.type} value.`);
}
