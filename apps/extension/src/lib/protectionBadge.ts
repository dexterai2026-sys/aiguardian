/**
 * A permanent, always-visible "protection active" indicator (PR 12), inserted right after the
 * compose box the same way the review panels are (see interceptionPanel.ts) - in normal document
 * flow, not a floating overlay, per CLAUDE.md's "visible, never covert" principle: the person
 * should never have to wonder whether Guardian is doing anything on a given AI site. Unlike the
 * review panels, this is never removed by anything other than the page unloading - it isn't a
 * response to an event, just a constant presence.
 */
export interface ProtectionBadge {
  element: HTMLElement;
  destroy(): void;
}

export function createProtectionBadge(composeBox: HTMLElement): ProtectionBadge {
  const ownerDocument = composeBox.ownerDocument;
  const badge = ownerDocument.createElement("div");
  badge.className = "guardian-protection-badge";
  badge.textContent = "Guardian — protection active";
  composeBox.insertAdjacentElement("afterend", badge);

  return {
    element: badge,
    destroy(): void {
      badge.remove();
    },
  };
}
