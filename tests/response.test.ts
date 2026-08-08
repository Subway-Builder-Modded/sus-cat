import { describe, expect, it, vi } from "vitest";

import { respond } from "../src/core/interactions/response.js";

function interaction(state: { deferred: boolean; replied: boolean }) {
  return { ...state, reply: vi.fn(), editReply: vi.fn(), followUp: vi.fn() };
}

describe("interaction response semantics", () => {
  it("replies to an unacknowledged interaction", async () => {
    const target = interaction({ deferred: false, replied: false });
    await respond(target as never, { content: "hello" });
    expect(target.reply).toHaveBeenCalledOnce();
  });

  it("completes the original deferred response with editReply", async () => {
    const target = interaction({ deferred: true, replied: false });
    await respond(target as never, { content: "complete" });
    expect(target.editReply).toHaveBeenCalledOnce();
    expect(target.followUp).not.toHaveBeenCalled();
  });

  it("uses followUp only after the initial response exists", async () => {
    const target = interaction({ deferred: false, replied: true });
    await respond(target as never, { content: "another" });
    expect(target.followUp).toHaveBeenCalledOnce();
  });
});
