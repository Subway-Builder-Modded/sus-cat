export type ConfigValue = boolean | string | number | string[] | null;
export type ConfigType = "boolean" | "string" | "integer" | "channel" | "category" | "role" | "url" | "enum" | "string-list" | "role-list" | "channel-list" | "duration";

export interface RequiredWhen {
  readonly featureId: string;
  readonly enabled: boolean;
}

export interface ConfigDefinition {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly type: ConfigType;
  readonly defaultValue: ConfigValue;
  readonly category: string;
  /** Feature that owns this setting. Hidden and non-editable while disabled. */
  readonly featureId?: string;
  readonly required?: boolean;
  readonly requiredWhen?: RequiredWhen;
  readonly sensitive?: boolean;
  readonly confirmationRequired?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly choices?: readonly { name: string; value: string }[];
}

export function defaultConfig(definitions: readonly ConfigDefinition[]): Record<string, ConfigValue> {
  return Object.fromEntries(definitions.map((definition) => [definition.key, definition.defaultValue]));
}
