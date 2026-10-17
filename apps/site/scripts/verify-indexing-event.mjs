import { appendFileSync, readFileSync } from "node:fs";
import { verifyVercelSuccessEvent } from "./indexing.mjs";

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) throw new Error("GitHub event file is missing.");
const source = readFileSync(eventPath);
if (source.byteLength > 1024 * 1024) throw new Error("GitHub event is larger than expected.");
const event = JSON.parse(source.toString("utf8"));
const result = verifyVercelSuccessEvent({ event, repository: event.repository || {}, sender: event.sender || {} });
if (!result.accepted) {
	console.log(`Ignoring deployment event: ${result.reason}.`);
	process.exit(0);
}
appendFileSync(process.env.GITHUB_OUTPUT, `sha=${result.deployment.sha}\nid=${result.deployment.id}\n`);
