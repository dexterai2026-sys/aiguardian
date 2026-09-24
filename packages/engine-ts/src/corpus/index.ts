// Test/tooling entry point, deliberately separate from ../index.ts: loadCorpusFile() uses
// node:fs and is meant for tests and the corpus-eval scripts (PR 5+), not for the runtime
// detection API that ships in the browser extension/dashboard bundle.
export {
  CorpusValidationError,
  validateCorpusCase,
  type CorpusCase,
  type ExpectedFinding,
} from "./schema.js";
export { parseCorpus, loadCorpusFile } from "./loader.js";
