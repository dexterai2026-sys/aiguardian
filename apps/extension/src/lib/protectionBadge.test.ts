import { describe, expect, it } from "vitest";
import { createProtectionBadge } from "./protectionBadge.js";

describe("createProtectionBadge", () => {
  it("inserts a visible badge immediately after the compose box", () => {
    document.body.innerHTML = "<textarea id='compose'></textarea>";
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;

    createProtectionBadge(composeBox);

    const badge = document.querySelector(".guardian-protection-badge");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain("protection active");
    expect(composeBox.nextElementSibling).toBe(badge);
  });

  it("removes the badge on destroy", () => {
    document.body.innerHTML = "<textarea id='compose'></textarea>";
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;

    const badge = createProtectionBadge(composeBox);
    badge.destroy();

    expect(document.querySelector(".guardian-protection-badge")).toBeNull();
  });
});
