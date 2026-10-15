import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

test("analytics shared declaration is valid without skipLibCheck and preserves return types", () => {
 const site = fileURLToPath(new URL("../../", import.meta.url));
 const root = mkdtempSync(join(site, ".analytics-types-"));
 const declaration = join(site, "src/utils/analytics-settings-types.d.ts");
 const caller = join(root, "caller.ts");
 try {
  writeFileSync(caller, `import {resolveAnalyticsSettings} from '../src/utils/analytics-settings.mjs';\nconst incorrect: number = resolveAnalyticsSettings().amplitudeApiKey;\n`);
  const program = ts.createProgram([declaration, caller], { noEmit: true, strict: true, skipLibCheck: false, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2022, types: [] });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.filter((item) => item.file?.fileName === declaration), [], "declaration must be valid even when dependency declarations are checked");
  const callerDiagnostics = diagnostics.filter((item) => item.file?.fileName === caller);
  assert.deepEqual(callerDiagnostics.map((item) => item.code), [2322], "provider values retain string types rather than silently becoming any");
 } finally { rmSync(root, { recursive: true, force: true }); }
});
