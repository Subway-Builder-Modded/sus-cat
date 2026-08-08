export function normalizePage(page: number, total: number, pageSize: number): { page: number; pages: number; offset: number } {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const normalized = Math.min(Math.max(1, Math.floor(page)), pages);
  return { page: normalized, pages, offset: (normalized - 1) * pageSize };
}
