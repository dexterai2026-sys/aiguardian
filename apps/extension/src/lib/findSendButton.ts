function accessibleName(element: HTMLElement): string {
  return (
    element.getAttribute("aria-label") ?? element.textContent ?? element.getAttribute("title") ?? ""
  );
}

/**
 * Heuristic for locating a compose box's send control, scoped to its nearest `<form>` (or
 * immediate parent, if there is no form) - not the whole page, to avoid matching an unrelated
 * button elsewhere. Same "recoverable if wrong" reasoning as findComposeBox.ts: send
 * interception only ever engages when there are findings to review (see sendInterceptor.ts), so
 * misidentifying this on an empty/clean message has no visible effect at all.
 */
export function findSendButton(composeBox: HTMLElement): HTMLElement | null {
  const container = composeBox.closest("form") ?? composeBox.parentElement;
  if (!container) {
    return null;
  }

  const buttons = Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]'));

  const bySendLabel = buttons.find((button) => /send|submit/i.test(accessibleName(button)));
  if (bySendLabel) {
    return bySendLabel;
  }

  return buttons.find((button) => button.getAttribute("type") === "submit") ?? null;
}
