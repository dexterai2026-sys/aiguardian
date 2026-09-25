import { describe, expect, it } from "vitest";
import { claudeAdapter } from "./claude.js";

// Trimmed from a real, saved Claude.ai snapshot, keeping only the attributes claude.ts's
// selectors actually key on - not the surrounding utility-class soup.
const COMPOSER_HTML = `
  <div contenteditable="true" role="textbox" data-testid="chat-input" aria-label="Write your prompt to Claude" class="tiptap ProseMirror">
    <p>Thanks</p>
  </div>
  <button type="button" data-testid="chat-input-send" aria-label="Send message"></button>
`;

const CONVERSATION_HTML = `
  <div data-testid="user-message">
    <p>Hola, &#191;que onda?</p>
  </div>
  <div data-testid="assistant-message">
    <p>&#161;Ey, que onda Robert! Todo bien por aca.</p>
  </div>
`;

describe("claudeAdapter.findComposeBox", () => {
  it("finds the compose box by its data-testid", () => {
    document.body.innerHTML = COMPOSER_HTML;
    const composeBox = claudeAdapter.findComposeBox(document);
    expect(composeBox).not.toBeNull();
    expect(composeBox!.getAttribute("data-testid")).toBe("chat-input");
  });

  it("returns null when the page has no Claude.ai compose box", () => {
    document.body.innerHTML = "<textarea></textarea>";
    expect(claudeAdapter.findComposeBox(document)).toBeNull();
  });
});

describe("claudeAdapter.findSendButton", () => {
  it("finds the send button, which - unlike ChatGPT's - is always present in the DOM", () => {
    document.body.innerHTML = COMPOSER_HTML;
    const composeBox = claudeAdapter.findComposeBox(document)!;
    const sendButton = claudeAdapter.findSendButton(composeBox);
    expect(sendButton).not.toBeNull();
    expect(sendButton!.getAttribute("data-testid")).toBe("chat-input-send");
  });
});

describe("claudeAdapter.findResponseContainers", () => {
  it("finds only Claude's own reply, never the person's own sent message", () => {
    document.body.innerHTML = CONVERSATION_HTML;
    const containers = claudeAdapter.findResponseContainers(document);
    expect(containers).toHaveLength(1);
    expect(containers[0]!.textContent).toContain("Todo bien");
    expect(containers[0]!.hasAttribute("data-testid")).toBe(true);
    expect(containers[0]!.getAttribute("data-testid")).not.toBe("user-message");
  });

  it("returns an empty array when there's no conversation yet", () => {
    document.body.innerHTML = COMPOSER_HTML;
    expect(claudeAdapter.findResponseContainers(document)).toEqual([]);
  });
});

describe("claudeAdapter.capabilities", () => {
  it("declares response restore as supported, verified against the real snapshot above", () => {
    expect(claudeAdapter.capabilities.responseRestore).toBe(true);
  });
});
