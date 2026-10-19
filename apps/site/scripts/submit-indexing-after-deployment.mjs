import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse } from "smol-toml";
import {
	INDEXING_STATUS_CONTEXT,
	getGithubCommitStatuses,
	getProductionSitemapUrls,
	hasPendingOrCompletedNotification,
	hasCanonicalCommit,
	isIndexNowEnabled,
	submitIndexNow,
	verifyVercelSuccessEvent,
} from "./indexing.mjs";

const event = readJson(process.env.GITHUB_EVENT_PATH, 1024 * 1024);
const repo = event.repository?.full_name;
const verified = verifyVercelSuccessEvent({ event, repository: event.repository || {}, sender: event.sender || {} });
if (!verified.accepted) {
	console.log(`Indexing skipped: ${verified.reason}.`);
	process.exit(0);
}

const sourceRoot = realpathSync(resolve(process.env.KIRARI_DEPLOYMENT_SOURCE || "deployment-source"));
const configPath = join(sourceRoot, "packages/site-profile/kirari.config.toml");
const configRealPath = realpathSync(configPath);
if (relative(sourceRoot, configRealPath).startsWith("..") || !lstatSync(configPath).isFile()) throw new Error("Deployment config is outside the checked-out commit.");
const config = parse(readFileSync(configPath, "utf8"));
if (config.seo?.google?.indexingApi === true) console.warn("Google Indexing API remains disabled until eligible content is approved and verified.");
if (!isIndexNowEnabled({ config })) {
	console.log("Indexing skipped: IndexNow is not explicitly enabled in both GitHub and Site configuration.");
	process.exit(0);
}

const token = process.env.GITHUB_TOKEN;
if (!token || !repo) throw new Error("GitHub status access is unavailable.");
const api = process.env.GITHUB_API_URL || "https://api.github.com";
if (new URL(api).origin !== "https://api.github.com") throw new Error("Unexpected GitHub API origin.");
const statusUrl = `${api}/repos/${repo}/commits/${verified.deployment.sha}/statuses`;
const priorStatuses = await getGithubCommitStatuses({ url: statusUrl, token });
if (hasPendingOrCompletedNotification(priorStatuses)) {
	console.log("Indexing skipped: this commit already has a successful or pending notification.");
	process.exit(0);
}

if (!(await hasCanonicalCommit({ sha: verified.deployment.sha }))) throw new Error("The canonical Production page does not serve the Vercel event commit.");
const urls = await getProductionSitemapUrls();
if (urls.length === 0) {
	console.log("Indexing skipped: the verified Production sitemap contains no URLs.");
	process.exit(0);
}
await setGithubStatus(statusUrl, token, verified.deployment, "pending", "Verified Production; submitting IndexNow sitemap.");
try {
	const result = await submitIndexNow({ urls, key: config.seo.indexNowKey });
	await setGithubStatus(statusUrl, token, verified.deployment, "success", `IndexNow accepted the Production sitemap (HTTP ${result}).`);
	console.log(`IndexNow accepted ${urls.length} Production URLs (HTTP ${result}).`);
} catch (error) {
	await setGithubStatus(statusUrl, token, verified.deployment, "failure", "IndexNow submission failed; see this workflow run.").catch(() => {});
	throw error;
}

function readJson(path, maxBytes) {
	if (!path) throw new Error("GitHub event file is missing.");
	const file = readFileSync(path);
	if (file.byteLength > maxBytes) throw new Error("GitHub event is larger than expected.");
	return JSON.parse(file.toString("utf8"));
}

async function setGithubStatus(url, token, deployment, state, description) {
	const response = await fetch(url, {
		method: "POST",
		redirect: "error",
		headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28" },
		body: JSON.stringify({ state, context: INDEXING_STATUS_CONTEXT, description, target_url: deployment.url }),
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) throw new Error(`GitHub indexing status update failed: HTTP ${response.status}.`);
}
