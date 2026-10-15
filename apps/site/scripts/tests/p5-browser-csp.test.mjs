import assert from "node:assert/strict";
import test from "node:test";
import { findUnexpectedCspViolations, isExpectedBaselineIconifyBlock } from "../../../../scripts/p5-browser/csp-violations.mjs";

test("CSP smoke triage allows only absolute baseline Iconify connect blocks", () => {
	assert.equal(isExpectedBaselineIconifyBlock({ directive: "connect-src", uri: "https://api.iconify.design/icons.json" }), true);
	for (const uri of ["inline", "eval", "data:text/plain,blocked", "blob:https://example.test/id", "/relative", "not a URL"]) {
		assert.equal(isExpectedBaselineIconifyBlock({ directive: "connect-src", uri }), false, uri);
	}
	assert.equal(isExpectedBaselineIconifyBlock({ directive: "script-src", uri: "https://api.iconify.design/script.js" }), false);
	assert.deepEqual(findUnexpectedCspViolations([
		{ directive: "connect-src", uri: "https://api.iconify.design/icons.json" },
		{ directive: "script-src", uri: "inline" },
		{ directive: "connect-src", uri: "eval" },
	]), [
		{ directive: "script-src", uri: "inline" },
		{ directive: "connect-src", uri: "eval" },
	]);
});
