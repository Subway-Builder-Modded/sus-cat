import { describe, expect, it } from "vitest";

import { normalizePage } from "../src/modules/moderation/utils/pagination.js";

describe("pagination", () => {
  it("clamps stale page requests", () => {
    expect(normalizePage(99, 21, 5)).toEqual({ page: 5, pages: 5, offset: 20 });
    expect(normalizePage(-2, 0, 5)).toEqual({ page: 1, pages: 1, offset: 0 });
  });
});
