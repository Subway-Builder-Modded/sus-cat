import { componentId as routedComponentId, parseComponentId as parseRoutedComponentId } from "../../../core/interactions/custom-id.js";

export function componentId(action: string, ...parts: string[]): string {
  return routedComponentId("module", "moderation", action, ...parts);
}

export function parseComponentId(id: string): { action: string; parts: string[] } | undefined {
  const route = parseRoutedComponentId(id);
  if (route?.namespace !== "module" || route.owner !== "moderation") return undefined;
  return { action: route.action, parts: [...route.parts] };
}
