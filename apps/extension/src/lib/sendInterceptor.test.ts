import { describe, expect, it, vi } from "vitest";
import type { Finding } from "@guardian/engine-ts";
import { attachSendInterceptor } from "./sendInterceptor.js";

function emailFinding(text: string): Finding[] {
  const start = text.indexOf("jane@example.com");
  if (start === -1) {
    return [];
  }
  return [
    {
      category: "pii.email",
      start,
      end: start + "jane@example.com".length,
      confidence: 0.95,
      tier: 1,
      suggestedPlaceholder: "EMAIL",
    },
  ];
}

function pressEnter(target: HTMLElement): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
  );
}

/** "Send masked" waits two animation frames before replaying the send (see sendInterceptor.ts's
 * nextAnimationFrame) - tests exercising that replay need to wait past them too. */
function waitForAnimationFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

describe("attachSendInterceptor", () => {
  it("lets Enter through untouched when there are no findings", () => {
    document.body.innerHTML = "<textarea id='compose'></textarea>";
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;
    composeBox.value = "just a normal message";
    const siteHandler = vi.fn();
    composeBox.addEventListener("keydown", siteHandler); // simulates the host site's own listener

    attachSendInterceptor({ composeBox, sendButton: null, detectNow: emailFinding });
    pressEnter(composeBox);

    expect(siteHandler).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".guardian-interception-panel")).toBeNull();
  });

  it("shows the review panel and prevents the site's own handler from running, when there are findings", () => {
    document.body.innerHTML = "<textarea id='compose'></textarea>";
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;
    composeBox.value = "email jane@example.com";
    const siteHandler = vi.fn();
    composeBox.addEventListener("keydown", siteHandler);

    attachSendInterceptor({ composeBox, sendButton: null, detectNow: emailFinding });
    pressEnter(composeBox);

    expect(siteHandler).not.toHaveBeenCalled();
    const panel = document.querySelector(".guardian-interception-panel");
    expect(panel).not.toBeNull();
    expect(panel!.querySelector(".guardian-interception-preview")!.textContent).toBe(
      "email [EMAIL_1]",
    );
  });

  it('"Send masked" replaces the text, calls onMasked, removes the panel, and replays the send', async () => {
    document.body.innerHTML = "<textarea id='compose'></textarea>";
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;
    composeBox.value = "email jane@example.com";
    const siteHandler = vi.fn();
    composeBox.addEventListener("keydown", siteHandler);
    const onMasked = vi.fn();

    attachSendInterceptor({ composeBox, sendButton: null, detectNow: emailFinding, onMasked });
    pressEnter(composeBox);
    document.querySelector<HTMLButtonElement>(".guardian-btn-send-masked")!.click();

    expect(composeBox.value).toBe("email [EMAIL_1]");
    expect(onMasked).toHaveBeenCalledExactlyOnceWith(
      new Map([["[EMAIL_1]", "jane@example.com"]]),
      emailFinding("email jane@example.com"),
    );
    expect(document.querySelector(".guardian-interception-panel")).toBeNull();

    await waitForAnimationFrames();

    // The replayed Enter re-runs detectNow against the now-masked (finding-free) text, so it
    // proceeds straight through to the site's own handler rather than intercepting again.
    expect(siteHandler).toHaveBeenCalledTimes(1);
  });

  it("calls onFindings once a panel is actually shown, with the findings that triggered it", () => {
    document.body.innerHTML = "<textarea id='compose'></textarea>";
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;
    composeBox.value = "email jane@example.com";
    const onFindings = vi.fn();

    attachSendInterceptor({ composeBox, sendButton: null, detectNow: emailFinding, onFindings });
    pressEnter(composeBox);

    expect(onFindings).toHaveBeenCalledExactlyOnceWith(emailFinding("email jane@example.com"));
  });

  it("never calls onFindings when there's nothing to review", () => {
    document.body.innerHTML = "<textarea id='compose'></textarea>";
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;
    composeBox.value = "just a normal message";
    const onFindings = vi.fn();

    attachSendInterceptor({ composeBox, sendButton: null, detectNow: emailFinding, onFindings });
    pressEnter(composeBox);

    expect(onFindings).not.toHaveBeenCalled();
  });

  it('"Edit" removes the panel without changing the text or replaying anything', () => {
    document.body.innerHTML = "<textarea id='compose'></textarea>";
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;
    composeBox.value = "email jane@example.com";
    const siteHandler = vi.fn();
    composeBox.addEventListener("keydown", siteHandler);

    attachSendInterceptor({ composeBox, sendButton: null, detectNow: emailFinding });
    pressEnter(composeBox);
    document.querySelector<HTMLButtonElement>(".guardian-btn-edit")!.click();

    expect(composeBox.value).toBe("email jane@example.com");
    expect(document.querySelector(".guardian-interception-panel")).toBeNull();
    expect(siteHandler).not.toHaveBeenCalled();
  });

  it('"Send anyway" replays the send with the original text, without re-intercepting itself (no infinite loop)', () => {
    document.body.innerHTML = "<textarea id='compose'></textarea>";
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;
    composeBox.value = "email jane@example.com";
    const siteHandler = vi.fn();
    composeBox.addEventListener("keydown", siteHandler);

    attachSendInterceptor({ composeBox, sendButton: null, detectNow: emailFinding });
    pressEnter(composeBox);
    document.querySelector<HTMLButtonElement>(".guardian-btn-send-anyway")!.click();

    // The original (still finding-containing) text reaches the site's handler exactly once -
    // if the bypass flag didn't work, the replayed Enter would trigger a second interception
    // (and the site handler would never be called at all).
    expect(composeBox.value).toBe("email jane@example.com");
    expect(siteHandler).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".guardian-interception-panel")).toHaveLength(0);
  });

  it("intercepts a send-button click the same way as Enter", () => {
    document.body.innerHTML = `
      <form>
        <textarea id="compose"></textarea>
        <button id="send" type="button">Send</button>
      </form>
    `;
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;
    const sendButton = document.querySelector<HTMLButtonElement>("#send")!;
    composeBox.value = "email jane@example.com";
    const siteHandler = vi.fn();
    sendButton.addEventListener("click", siteHandler);

    attachSendInterceptor({ composeBox, sendButton, detectNow: emailFinding });
    sendButton.click();

    expect(siteHandler).not.toHaveBeenCalled();
    expect(document.querySelector(".guardian-interception-panel")).not.toBeNull();

    document.querySelector<HTMLButtonElement>(".guardian-btn-send-anyway")!.click();
    expect(siteHandler).toHaveBeenCalledTimes(1);
  });

  it("\"Send masked\" replaces a contenteditable compose box's text too, falling back to textContent when execCommand is unavailable (as in this jsdom test environment - see sendInterceptor.ts's setContentEditableTextViaExecCommand)", () => {
    document.body.innerHTML = '<div contenteditable="true" id="compose"></div>';
    const composeBox = document.querySelector<HTMLElement>("#compose")!;
    composeBox.textContent = "email jane@example.com";

    attachSendInterceptor({ composeBox, sendButton: null, detectNow: emailFinding });
    pressEnter(composeBox);
    document.querySelector<HTMLButtonElement>(".guardian-btn-send-masked")!.click();

    expect(composeBox.textContent).toBe("email [EMAIL_1]");
  });

  it("intercepts clicks on a send button that doesn't exist yet at attach time, given a resolver function", () => {
    // Mirrors ChatGPT (see adapters/chatgpt.ts): no send button in the DOM at all until the
    // compose box has content - a fixed element captured once up front would never see it.
    document.body.innerHTML = `<form><textarea id="compose"></textarea></form>`;
    const composeBox = document.querySelector<HTMLTextAreaElement>("#compose")!;
    const form = document.querySelector("form")!;

    attachSendInterceptor({
      composeBox,
      sendButton: () => document.querySelector<HTMLButtonElement>("#send"),
      detectNow: emailFinding,
    });

    composeBox.value = "email jane@example.com";
    const sendButton = document.createElement("button");
    sendButton.id = "send";
    sendButton.type = "button";
    form.appendChild(sendButton);
    const siteHandler = vi.fn();
    sendButton.addEventListener("click", siteHandler);

    sendButton.click();

    expect(siteHandler).not.toHaveBeenCalled();
    expect(document.querySelector(".guardian-interception-panel")).not.toBeNull();

    document.querySelector<HTMLButtonElement>(".guardian-btn-send-anyway")!.click();
    expect(siteHandler).toHaveBeenCalledTimes(1);
  });
});
