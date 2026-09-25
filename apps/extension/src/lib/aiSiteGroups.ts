import aiDomains from "../../../../rules/ai-domains.json";

/**
 * Groups /rules/ai-domains.json's flat (domain, name) entries by name, since a few sites are
 * covered by more than one domain (ChatGPT: chat.openai.com and chatgpt.com; Character.AI:
 * character.ai and beta.character.ai) - the popup's allow/block toggle (PR 12) is one switch per
 * site the person recognizes by name, not one per underlying domain, and toggling it must affect
 * every domain that site actually uses.
 */
export interface AiSiteGroup {
  name: string;
  domains: string[];
}

export function getAiSiteGroups(): AiSiteGroup[] {
  const byName = new Map<string, string[]>();
  for (const { domain, name } of aiDomains) {
    const domains = byName.get(name);
    if (domains) {
      domains.push(domain);
    } else {
      byName.set(name, [domain]);
    }
  }
  return Array.from(byName, ([name, domains]) => ({ name, domains }));
}
