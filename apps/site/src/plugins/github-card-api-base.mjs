import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse as parseToml } from "smol-toml";

const DEFAULT_GITHUB_CARD_API_BASE = "https://api.github.com";
const CARD_SOURCE_ID = /^[a-f0-9]{20}$/;

export function createGithubCardSourceId(name, file, position) {
	if (name !== "github" && name !== "githubfile") throw new Error(`Unsupported GitHub card directive: ${name}`);
	const cwd = file?.cwd;
	const source = file?.history?.at(-1);
	if (typeof cwd !== "string" || !cwd || typeof source !== "string" || !source) {
		throw new Error(`${name} card source identity is unavailable.`);
	}
	const root = resolve(cwd);
	const sourcePath = relative(root, resolve(root, source)).split(sep).join("/").normalize("NFC");
	if (!sourcePath || sourcePath === "." || sourcePath === ".." || sourcePath.startsWith("../") || isAbsolute(sourcePath)) {
		throw new Error(`${name} card source must be inside the Site source root.`);
	}
	const startOffset = position?.start?.offset;
	const endOffset = position?.end?.offset;
	if (!Number.isSafeInteger(startOffset) || startOffset < 0 || !Number.isSafeInteger(endOffset) || endOffset <= startOffset) {
		throw new Error(`${name} card source position offsets are unavailable.`);
	}
	return createHash("sha256")
		.update(JSON.stringify(["kirari-github-card-v1", name, sourcePath, startOffset, endOffset]))
		.digest("hex")
		.slice(0, 20);
}

export function resolveGithubCardId(prefix, properties) {
	if (process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK !== "true") {
		return `${prefix}${Math.random().toString(36).slice(-6)}`;
	}
	const sourceId = properties?.kirariCardId;
	if (typeof sourceId !== "string" || !CARD_SOURCE_ID.test(sourceId)) {
		throw new Error("GitHub card is missing a valid deterministic source ID.");
	}
	return `${prefix}${sourceId}`;
}

export function normalizeGithubCardApiBase(apiBase) {
	const value = typeof apiBase === "string" ? apiBase.trim() : "";
	return (value || DEFAULT_GITHUB_CARD_API_BASE).replace(/\/+$/, "");
}

function getConfiguredApiBase() {
	const envValue = process.env.PUBLIC_GITHUB_CARD_API_BASE?.trim();
	if (envValue) return envValue;

	try {
		const rawConfig = readFileSync(
			join(process.cwd(), "kirari.config.toml"),
			"utf8",
		);
		const parsedConfig = parseToml(rawConfig);
		const value =
			typeof parsedConfig === "object" &&
			parsedConfig !== null &&
			"githubCard" in parsedConfig &&
			typeof parsedConfig.githubCard === "object" &&
			parsedConfig.githubCard !== null &&
			"apiBase" in parsedConfig.githubCard &&
			typeof parsedConfig.githubCard.apiBase === "string"
				? parsedConfig.githubCard.apiBase
				: "";

		return value;
	} catch {
		return "";
	}
}

export function resolveGithubCardApiBase(apiBase) {
	const explicit = normalizeGithubCardApiBase(apiBase);
	if (explicit !== DEFAULT_GITHUB_CARD_API_BASE) return explicit;

	return normalizeGithubCardApiBase(getConfiguredApiBase());
}

export function toScriptLiteral(value) {
	return JSON.stringify(value);
}
