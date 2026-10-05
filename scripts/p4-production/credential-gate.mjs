#!/usr/bin/env node
import { evaluateCurrentCredential } from "./tooling-gate.mjs";

try {
	const result = await evaluateCurrentCredential();
	process.stdout.write(`${JSON.stringify({ C1_CREDENTIAL_READINESS: result.result, reasons: result.reasons })}\n`);
	if (result.result !== "PASS") process.exitCode = 1;
} catch {
	process.stderr.write("C1_CONCRETE_CREDENTIAL_GATE_FAILED\n");
	process.exitCode = 1;
}
