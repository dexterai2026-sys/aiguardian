import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RuleValidationError,
  loadAiDomainsFile,
  loadPatternRuleDir,
  loadPatternRuleFile,
  parseAiDomains,
  parsePatternRules,
} from "./loader.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

describe("parsePatternRules", () => {
  it("parses a valid rule array", () => {
    const content = JSON.stringify([
      {
        category: "pii.email",
        pattern: "\\b\\S+@\\S+\\b",
        confidence: 0.9,
        placeholderPrefix: "EMAIL",
      },
    ]);
    expect(parsePatternRules(content, "inline")).toHaveLength(1);
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePatternRules("{not json", "fixture.json")).toThrow(RuleValidationError);
  });

  it("throws when the top level is not an array", () => {
    expect(() => parsePatternRules("{}", "fixture.json")).toThrow(/expected a JSON array/);
  });
});

describe("parseAiDomains", () => {
  it("parses a valid domain array", () => {
    const content = JSON.stringify([{ domain: "claude.ai", name: "Claude" }]);
    expect(parseAiDomains(content, "inline")).toHaveLength(1);
  });
});

describe("loadPatternRuleDir", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "guardian-rules-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("concatenates rules across multiple files", () => {
    writeFileSync(
      join(dir, "a.json"),
      JSON.stringify([
        {
          category: "pii.email",
          pattern: "\\S+@\\S+",
          confidence: 0.9,
          placeholderPrefix: "EMAIL",
        },
      ]),
    );
    writeFileSync(
      join(dir, "b.json"),
      JSON.stringify([
        {
          category: "pii.ssn",
          pattern: "\\d{3}-\\d{2}-\\d{4}",
          confidence: 0.85,
          placeholderPrefix: "SSN",
        },
      ]),
    );

    const rules = loadPatternRuleDir(dir);
    expect(rules.map((r) => r.category).sort()).toEqual(["pii.email", "pii.ssn"]);
  });

  it("throws when the same category is defined in two files", () => {
    writeFileSync(
      join(dir, "a.json"),
      JSON.stringify([
        {
          category: "pii.email",
          pattern: "\\S+@\\S+",
          confidence: 0.9,
          placeholderPrefix: "EMAIL",
        },
      ]),
    );
    writeFileSync(
      join(dir, "b.json"),
      JSON.stringify([
        {
          category: "pii.email",
          pattern: "\\S+@\\S+",
          confidence: 0.5,
          placeholderPrefix: "EMAIL",
        },
      ]),
    );

    expect(() => loadPatternRuleDir(dir)).toThrow(/already defined in/);
  });
});

describe("real /rules data", () => {
  it("loads /rules/patterns without duplicate categories", () => {
    const rules = loadPatternRuleDir(join(repoRoot, "rules", "patterns"));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(() => new RegExp(rule.pattern, "gu")).not.toThrow();
    }
  });

  it("loads /rules/ai-domains.json", () => {
    const domains = loadAiDomainsFile(join(repoRoot, "rules", "ai-domains.json"));
    expect(domains.length).toBeGreaterThan(0);
    expect(domains.some((d) => d.domain === "claude.ai")).toBe(true);
  });

  it("loads the seed pii-structured.json file directly", () => {
    const rules = loadPatternRuleFile(join(repoRoot, "rules", "patterns", "pii-structured.json"));
    expect(rules.map((r) => r.category).sort()).toEqual(
      ["pii.email", "pii.payment_card", "pii.phone", "pii.ssn"].sort(),
    );
  });
});
