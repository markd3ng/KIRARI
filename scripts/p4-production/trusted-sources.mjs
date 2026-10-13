function record(value, message) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
	return value;
}

function supportedKeys(value, keys) {
	if (Object.keys(value).some(key => !keys.includes(key))) throw new Error("Vercel Trusted Sources schema contains unsupported fields");
}

function source(entry, issuer, legacy) {
	record(entry, "Vercel Trusted Sources provider entry is invalid");
	supportedKeys(entry, legacy ? ["issuer", "claims", "to", "label"] : ["claims", "to", "label"]);
	if (typeof issuer !== "string" || !issuer) throw new Error("Vercel Trusted Sources issuer is unavailable");
	record(entry.claims, "Vercel Trusted Sources claims are unavailable");
	const claims = Object.fromEntries(Object.keys(entry.claims).sort().map(key => {
		const values = entry.claims[key];
		if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== "string" || !value)
			|| new Set(values).size !== values.length) throw new Error("Vercel Trusted Sources claim values are invalid");
		return [key, [...values].sort()];
	}));
	record(entry.to, "Vercel Trusted Sources destination is unavailable");
	supportedKeys(entry.to, ["slugs", "preset"]);
	if (entry.to.slugs !== undefined && (!Array.isArray(entry.to.slugs) || !entry.to.slugs.length
		|| entry.to.slugs.some(value => typeof value !== "string" || !value)
		|| new Set(entry.to.slugs).size !== entry.to.slugs.length)) throw new Error("Vercel Trusted Sources destination slugs are invalid");
	if (entry.to.preset !== undefined && entry.to.preset !== "all-custom") throw new Error("Vercel Trusted Sources destination preset is unsupported");
	if (entry.to.slugs === undefined && entry.to.preset === undefined) throw new Error("Vercel Trusted Sources destination is unavailable");
	return { issuer, claims, to: { ...(entry.to.slugs === undefined ? {} : { slugs: [...entry.to.slugs].sort() }),
		...(entry.to.preset === undefined ? {} : { preset: entry.to.preset }) } };
}

/** Normalize a full raw project read, never a summarized MCP projection or saved approval flag. */
export function normalizeVercelTrustedSources(project) {
	record(project, "Vercel project readback is invalid");
	if (Object.hasOwn(project, "trustedSources") && Object.hasOwn(project, "trusted_sources")) throw new Error("Vercel project Trusted Sources readback is ambiguous");
	const policy = record(project.trustedSources ?? project.trusted_sources, "Vercel project Trusted Sources readback is unavailable");
	const containers = ["externalSources", "external_sources", "oidcProviders", "oidc_providers"];
	supportedKeys(policy, ["enableVercelCiSameRepository", "projects", ...containers]);
	if (policy.enableVercelCiSameRepository !== false) throw new Error("Vercel Trusted Sources same-repository CI trust must be explicitly disabled");
	const fields = containers.filter(key => Object.hasOwn(policy, key));
	if (fields.length !== 1) throw new Error("Vercel project Trusted Sources provider readback is ambiguous or unavailable");
	const currentSchema = fields[0] === "oidcProviders";
	// GetProjectTrustedSources.projects is optional in the current full REST schema.
	const projects = currentSchema && !Object.hasOwn(policy, "projects") ? {} : policy.projects;
	if (!projects || typeof projects !== "object" || Object.keys(projects).length !== 0) throw new Error("Vercel project Trusted Sources must explicitly contain no additional project rules");
	let sources;
	if (fields[0].startsWith("external")) {
		if (!Array.isArray(policy[fields[0]])) throw new Error("Vercel Trusted Sources schema is unsupported");
		sources = policy[fields[0]].map(entry => source(entry, entry?.issuer, true));
	} else {
		const providers = record(policy[fields[0]], "Vercel Trusted Sources provider map is invalid");
		sources = Object.keys(providers).sort().flatMap(issuer => {
			if (!Array.isArray(providers[issuer])) throw new Error("Vercel Trusted Sources provider rules must be arrays");
			return providers[issuer].map(entry => source(entry, issuer, false));
		});
		if (Object.keys(providers).length !== 1) throw new Error("Vercel project must have exactly one reviewed GitHub OIDC Trusted Source");
	}
	return { enableVercelCiSameRepository: false, projects: {}, externalSources: sources };
}
