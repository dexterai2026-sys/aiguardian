import { beforeEach, describe, expect, it, vi } from "vitest";
import { watchComposeBox } from "./watchComposeBox.js";

// The module debounces its mutation-triggered rechecks by 200ms, so tests need to wait past that
// with a real timer, not just a microtask flush.
function waitForRecheck(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("watchComposeBox", () => {
  it("attaches immediately to a compose box already present", () => {
    document.body.innerHTML = `<div id="box"></div>`;
    const box = document.getElementById("box")!;
    const attach = vi.fn();

    watchComposeBox(() => document.getElementById("box"), attach);

    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith(box);
  });

  it("does not re-attach while the same compose box stays connected, even after unrelated DOM churn", async () => {
    document.body.innerHTML = `<div id="box"></div>`;
    const attach = vi.fn();

    watchComposeBox(() => document.getElementById("box"), attach);
    expect(attach).toHaveBeenCalledTimes(1);

    const aside = document.createElement("div");
    document.body.appendChild(aside);
    await waitForRecheck();

    expect(attach).toHaveBeenCalledTimes(1);
  });

  it("re-attaches once the original compose box is replaced by a new one - the SPA-navigation case", async () => {
    document.body.innerHTML = `<div id="box"></div>`;
    const attach = vi.fn();

    watchComposeBox(() => document.getElementById("box"), attach);
    expect(attach).toHaveBeenCalledTimes(1);

    document.getElementById("box")!.remove();
    const replacement = document.createElement("div");
    replacement.id = "box";
    document.body.appendChild(replacement);
    await waitForRecheck();

    expect(attach).toHaveBeenCalledTimes(2);
    expect(attach).toHaveBeenLastCalledWith(replacement);
  });

  it("attaches once a compose box appears after having found none initially", async () => {
    const attach = vi.fn();

    watchComposeBox(() => document.getElementById("box"), attach);
    expect(attach).not.toHaveBeenCalled();

    const box = document.createElement("div");
    box.id = "box";
    document.body.appendChild(box);
    await waitForRecheck();

    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith(box);
  });
});
