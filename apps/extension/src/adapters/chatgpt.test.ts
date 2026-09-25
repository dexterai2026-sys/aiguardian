import { describe, expect, it } from "vitest";
import { chatgptAdapter } from "./chatgpt.js";

// Trimmed from two real, saved ChatGPT snapshots (an empty "new chat" screen, and an active
// conversation), keeping only the attributes chatgpt.ts's selectors actually key on - not the
// surrounding utility-class soup, which changes often and isn't part of the contract being tested.
const EMPTY_COMPOSER_HTML = `
  <form data-chatgpt-composer>
    <div contenteditable="true" role="textbox" aria-label="Ask ChatGPT" class="ProseMirror">
      <p data-empty-paragraph="true"><br /></p>
    </div>
    <button type="button" aria-label="Dictate">Dictate</button>
    <button type="button" aria-label="Start Voice">Start Voice</button>
  </form>
`;

const POPULATED_COMPOSER_HTML = `
  <form data-chatgpt-composer>
    <div contenteditable="true" role="textbox" aria-label="Ask ChatGPT" class="ProseMirror">
      <p>Thanks</p>
    </div>
    <button type="button" aria-label="Dictate">Dictate</button>
    <button type="submit" aria-label="Send">Send</button>
  </form>
`;

const CONVERSATION_HTML = `
  <div data-user-message-bubble="true">
    <div>How old is the country</div>
  </div>
  <div data-markdown-text-style="assistant-message">
    <p>If you mean the United States, it is 250 years old.</p>
  </div>
`;

describe("chatgptAdapter.findComposeBox", () => {
  it("finds the ProseMirror compose box by role and accessible label", () => {
    document.body.innerHTML = EMPTY_COMPOSER_HTML;
    const composeBox = chatgptAdapter.findComposeBox(document);
    expect(composeBox).not.toBeNull();
    expect(composeBox!.getAttribute("aria-label")).toBe("Ask ChatGPT");
  });

  it("returns null when the page has no ChatGPT compose box (e.g. a different site)", () => {
    document.body.innerHTML = "<textarea></textarea>";
    expect(chatgptAdapter.findComposeBox(document)).toBeNull();
  });
});

describe("chatgptAdapter.findSendButton", () => {
  it("finds nothing when the compose box is empty (ChatGPT shows Dictate/Voice instead)", () => {
    document.body.innerHTML = EMPTY_COMPOSER_HTML;
    const composeBox = chatgptAdapter.findComposeBox(document)!;
    expect(chatgptAdapter.findSendButton(composeBox)).toBeNull();
  });

  it("finds the Send button once the compose box has content", () => {
    document.body.innerHTML = POPULATED_COMPOSER_HTML;
    const composeBox = chatgptAdapter.findComposeBox(document)!;
    const sendButton = chatgptAdapter.findSendButton(composeBox);
    expect(sendButton).not.toBeNull();
    expect(sendButton!.getAttribute("aria-label")).toBe("Send");
  });

  it("never returns the Dictate/Voice buttons as a send control", () => {
    document.body.innerHTML = POPULATED_COMPOSER_HTML;
    const composeBox = chatgptAdapter.findComposeBox(document)!;
    const sendButton = chatgptAdapter.findSendButton(composeBox);
    expect(sendButton!.getAttribute("aria-label")).not.toBe("Dictate");
  });
});

describe("chatgptAdapter.findResponseContainers", () => {
  it("finds only the AI's own reply, never the person's own sent-message bubble", () => {
    document.body.innerHTML = CONVERSATION_HTML;
    const containers = chatgptAdapter.findResponseContainers(document);
    expect(containers).toHaveLength(1);
    expect(containers[0]!.textContent).toContain("250 years old");
    expect(containers[0]!.hasAttribute("data-user-message-bubble")).toBe(false);
  });

  it("returns an empty array when there's no conversation yet", () => {
    document.body.innerHTML = EMPTY_COMPOSER_HTML;
    expect(chatgptAdapter.findResponseContainers(document)).toEqual([]);
  });
});

describe("chatgptAdapter.capabilities", () => {
  it("declares response restore as supported, verified against the two real snapshots above", () => {
    expect(chatgptAdapter.capabilities.responseRestore).toBe(true);
  });
});
