/**
 * The review panel shown when a send is intercepted (see sendInterceptor.ts). Inserted in
 * normal document flow immediately after the compose box - not a floating/absolutely-positioned
 * overlay like highlightOverlay.ts - both because it's simpler and more robust (no positioning
 * math to get wrong), and because CLAUDE.md's "visible, never covert" principle is best served
 * by something that visibly pushes the page's own layout, not a subtle floating box easy to miss.
 */
export interface InterceptionPanel {
  element: HTMLElement;
  remove(): void;
}

export interface InterceptionPanelCallbacks {
  onSendMasked(): void;
  onEdit(): void;
  onSendAnyway(): void;
}

export function createInterceptionPanel(
  ownerDocument: Document,
  maskedPreview: string,
  callbacks: InterceptionPanelCallbacks,
): InterceptionPanel {
  const panel = ownerDocument.createElement("div");
  panel.className = "guardian-interception-panel";

  const heading = ownerDocument.createElement("p");
  heading.textContent = "Guardian found personal info or a security risk in this message.";
  panel.appendChild(heading);

  const previewLabel = ownerDocument.createElement("p");
  previewLabel.textContent = "Here's what it would look like masked:";
  panel.appendChild(previewLabel);

  const preview = ownerDocument.createElement("pre");
  preview.className = "guardian-interception-preview";
  preview.textContent = maskedPreview;
  panel.appendChild(preview);

  const actions = ownerDocument.createElement("div");
  actions.className = "guardian-interception-actions";
  panel.appendChild(actions);

  function addButton(label: string, className: string, onClick: () => void): void {
    const button = ownerDocument.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = className;
    button.addEventListener("click", onClick);
    actions.appendChild(button);
  }

  addButton("Send masked", "guardian-btn-send-masked", callbacks.onSendMasked);
  addButton("Edit", "guardian-btn-edit", callbacks.onEdit);
  addButton("Send anyway", "guardian-btn-send-anyway", callbacks.onSendAnyway);

  return {
    element: panel,
    remove(): void {
      panel.remove();
    },
  };
}
