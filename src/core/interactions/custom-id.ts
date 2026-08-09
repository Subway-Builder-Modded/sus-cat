export interface ComponentRoute { readonly namespace: "core" | "module"; readonly owner: string; readonly action: string; readonly parts: readonly string[]; }

export function componentId(namespace: "core" | "module", owner: string, action: string, ...parts: string[]): string {
  const values = [namespace, owner, action, ...parts];
  if (values.some((value) => !/^[a-zA-Z0-9_-]+$/.test(value))) throw new Error("Unsafe component identifier");
  const id = values.join(":");
  if (id.length > 100) throw new Error("Component identifier is too long");
  return id;
}

export function parseComponentId(id: string): ComponentRoute | undefined {
  const [namespace, owner, action, ...parts] = id.split(":");
  if ((namespace !== "core" && namespace !== "module") || !owner || !action) return undefined;
  return { namespace, owner, action, parts };
}

export function requireComponentValue(values: readonly string[], index: number): string {
  const value = values[index];
  if (!value) throw new Error("This control is incomplete or stale.");
  return value;
}
