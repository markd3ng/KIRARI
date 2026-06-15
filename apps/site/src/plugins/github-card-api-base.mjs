import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";

const DEFAULT_GITHUB_CARD_API_BASE = "https://api.github.com";

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
