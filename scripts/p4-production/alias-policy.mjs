function requireCondition(value, message) {
	if (!value) throw new Error(message);
}

function hostname(value) {
	return typeof value === "string" && value.length <= 253 && value === value.toLowerCase()
		&& value.split(".").length >= 2 && value.split(".").every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

/** C1's approved team slug supplies the provider namespace; aliases never supply it. */
export function generatedProductionAliasNames(target, identity) {
	requireCondition(identity && identity.team_id === target.team_id && identity.project_id === target.project_id
		&& identity.project === target.project && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(target.project ?? "")
		&& /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(identity.team_slug ?? ""), "Production alias identity is not the approved C1 target");
	const names = [`${target.project}-${identity.team_slug}.vercel.app`, `${target.project}-git-main-${identity.team_slug}.vercel.app`];
	requireCondition(names.every(hostname), "Generated Production alias exceeds the supported provider URL shape");
	return names;
}

/** Inspect affected Production aliases; unrelated Preview rows grant no Production access. */
export function assertProductionAliases(aliases, target, expectedDeployment, identity) {
	requireCondition(Array.isArray(aliases) && Array.isArray(target.domains), "Production aliases are missing");
	requireCondition(expectedDeployment === null || /^dpl_[A-Za-z0-9]+$/.test(expectedDeployment ?? ""), "Production deployment identity is invalid");
	const generatedNames = identity ? generatedProductionAliasNames(target, identity) : [];
	const generated = [];
	const seen = new Set();
	for (const entry of aliases) {
		requireCondition(entry && hostname(entry.alias) && entry.projectId === target.project_id
			&& (entry.teamId === undefined || entry.teamId === target.team_id), "Production alias project/team identity mismatch");
		requireCondition(!seen.has(entry.alias), "Production alias identity is ambiguous");
		seen.add(entry.alias);
		const configured = target.domains.includes(entry.alias);
		const providerGenerated = generatedNames.includes(entry.alias);
		const affected = configured || providerGenerated || (expectedDeployment !== null && entry.deploymentId === expectedDeployment);
		if (!affected) {
			const prefix = `${target.project}-git-`, suffix = `-${identity?.team_slug}.vercel.app`;
			const branch = entry.alias.startsWith(prefix) && entry.alias.endsWith(suffix)
				? entry.alias.slice(prefix.length, -suffix.length) : "";
			requireCondition(identity && branch && branch !== "main" && /^dpl_[A-Za-z0-9]+$/.test(entry.deploymentId ?? "")
				&& !entry.redirect, "Unrelated alias is not an approved Production or provider Preview alias");
			continue;
		}
		requireCondition(configured || providerGenerated, "Unapproved hostname is bound to the Production deployment");
		requireCondition(expectedDeployment !== null && entry.deploymentId === expectedDeployment && !entry.redirect, "Production alias/deployment substitution");
		if (providerGenerated && !configured) generated.push(entry.alias);
	}
	for (const domain of target.domains) {
		const entries = aliases.filter(entry => entry.alias === domain);
		requireCondition(expectedDeployment === null ? entries.length === 0 : entries.length === 1, "Production configured alias is missing or unexpected");
	}
	return generated.sort();
}
