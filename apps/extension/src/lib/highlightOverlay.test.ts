import { describe, expect, it } from "vitest";
import type { Finding } from "@guardian/engine-ts";
import { createHighlightOverlay } from "./highlightOverlay.js";

function finding(overrides: Partial<Finding> & Pick<Finding, "start" | "end">): Finding {
  return {
    category: "pii.email",
    confidence: 0.9,
    tier: 1,
    suggestedPlaceholder: "EMAIL",
    ...overrides,
  };
}

describe("createHighlightOverlay", () => {
  it("inserts an aria-hidden overlay as the previous sibling of the target", () => {
    document.body.innerHTML = '<div id="parent"><textarea id="target"></textarea></div>';
    const target = document.querySelector<HTMLTextAreaElement>("#target")!;

    createHighlightOverlay(target);

    const overlay = target.previousElementSibling;
    expect(overlay).not.toBeNull();
    expect(overlay!.className).toBe("guardian-highlight-overlay");
    expect(overlay!.getAttribute("aria-hidden")).toBe("true");
  });

  it("makes the target's background transparent and the parent positioned", () => {
    document.body.innerHTML = '<div id="parent"><textarea id="target"></textarea></div>';
    const target = document.querySelector<HTMLTextAreaElement>("#target")!;
    const parent = document.querySelector<HTMLElement>("#parent")!;

    createHighlightOverlay(target);

    expect(target.style.background).toBe("transparent");
    expect(parent.style.position).toBe("relative");
  });

  it("does not override an already-positioned parent", () => {
    document.body.innerHTML =
      '<div id="parent" style="position: absolute;"><textarea id="target"></textarea></div>';
    const target = document.querySelector<HTMLTextAreaElement>("#target")!;
    const parent = document.querySelector<HTMLElement>("#parent")!;

    createHighlightOverlay(target);

    expect(parent.style.position).toBe("absolute");
  });

  it("renders the target's current text (with findings) into the overlay on update()", () => {
    document.body.innerHTML = '<div><textarea id="target"></textarea></div>';
    const target = document.querySelector<HTMLTextAreaElement>("#target")!;
    target.value = "contact jane@example.com please";

    const overlay = createHighlightOverlay(target);
    overlay.update([finding({ start: 8, end: 24 })]);

    const overlayElement = target.previousElementSibling!;
    expect(overlayElement.querySelector("mark")).not.toBeNull();
    expect(overlayElement.querySelector("mark")!.textContent).toBe("jane@example.com");
  });

  it("keeps the overlay's scroll position in sync with the target's", () => {
    document.body.innerHTML = '<div><textarea id="target"></textarea></div>';
    const target = document.querySelector<HTMLTextAreaElement>("#target")!;
    createHighlightOverlay(target);
    const overlayElement = target.previousElementSibling as HTMLElement;

    Object.defineProperty(target, "scrollTop", { value: 42, configurable: true });
    Object.defineProperty(target, "scrollLeft", { value: 7, configurable: true });
    target.dispatchEvent(new Event("scroll"));

    expect(overlayElement.scrollTop).toBe(42);
    expect(overlayElement.scrollLeft).toBe(7);
  });

  it("removes the overlay and restores the target's and parent's original styles on destroy()", () => {
    document.body.innerHTML =
      '<div id="parent"><textarea id="target" style="background: pink;"></textarea></div>';
    const target = document.querySelector<HTMLTextAreaElement>("#target")!;
    const parent = document.querySelector<HTMLElement>("#parent")!;

    const overlay = createHighlightOverlay(target);
    overlay.destroy();

    expect(target.previousElementSibling).toBeNull();
    expect(target.style.background).toBe("pink");
    expect(parent.style.position).toBe("");
  });
});
