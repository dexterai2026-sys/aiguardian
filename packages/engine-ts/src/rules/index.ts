// Test/tooling entry point, deliberately separate from ../index.ts: these loaders use node:fs
// and are meant for tests and future detector code running in Node/build tooling, not for the
// runtime detection API that ships in the browser extension/dashboard bundle. (Detectors that
// need rule data at runtime will bundle it as an imported JSON/TS module, not read it from
// disk — see docs/phase-1-plan.md PR 5+.)
export {
  RuleValidationError,
  validatePatternRule,
  validateAiDomainEntry,
  VALIDATORS,
  type PatternRule,
  type AiDomainEntry,
  type ValidatorName,
} from "./schema.js";
export {
  parsePatternRules,
  loadPatternRuleFile,
  loadPatternRuleDir,
  parseAiDomains,
  loadAiDomainsFile,
} from "./loader.js";
