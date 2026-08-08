const prefix = "mod";

export function componentId(action: string, ...parts: string[]): string {
  const values = [prefix, action, ...parts];
  if (values.some((value) => !/^[a-zA-Z0-9_-]+$/.test(value))) throw new Error("Unsafe component identifier");
  const id = values.join(":");
  if (id.length > 100) throw new Error("Component identifier is too long");
  return id;
}

export function parseComponentId(id: string): { action: string; parts: string[] } | undefined {
  const [namespace, action, ...parts] = id.split(":");
  if (namespace !== prefix || !action) return undefined;
  return { action, parts };
}
