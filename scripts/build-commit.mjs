import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const commitEnvNames = [
	"KIRARI_COMMIT_SHA",
	"PUBLIC_KIRARI_COMMIT_SHA",
	"PUBLIC_KIRARI_COMMIT",
	"VERCEL_GIT_COMMIT_SHA",
	"CF_PAGES_COMMIT_SHA",
	"GITHUB_SHA",
	"NETLIFY_COMMIT_REF",
	"COMMIT_REF",
	"CACHED_COMMIT_REF",
	"EDGEONE_COMMIT_SHA",
	"EDGEONE_PAGES_COMMIT_SHA",
	"CI_COMMIT_SHA",
	"CIRCLE_SHA1",
	"TRAVIS_COMMIT",
	"DRONE_COMMIT_SHA",
	"BITBUCKET_COMMIT",
	"SOURCE_COMMIT",
	"SOURCE_VERSION",
	"GIT_COMMIT",
	"GIT_COMMIT_SHA",
	"REVISION",
	"BUILD_SOURCEVERSION",
	"npm_package_gitHead",
];

export function resolveBuildCommit(cwd = process.cwd(), env = process.env) {
	const fromEnv = resolveCommitFromEnv(env);
	if (fromEnv) return toBuildCommit(fromEnv);

	const fromGit = resolveCommitFromGit(cwd);
	if (fromGit) return toBuildCommit(fromGit);

	return { short: "unknown", full: "", source: "unknown" };
}

function resolveCommitFromEnv(env) {
	for (const name of commitEnvNames) {
		const commit = normalizeCommit(env[name]);
		if (commit) return commit;
	}
	return "";
}

function resolveCommitFromGit(cwd) {
	try {
		const commit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		const normalized = normalizeCommit(commit);
		if (normalized) return normalized;
	} catch {
		// Some static build providers expose .git but not the git binary.
	}

	return resolveCommitFromGitFiles(cwd);
}

function resolveCommitFromGitFiles(cwd) {
	const gitPath = findGitPath(cwd);
	if (!gitPath) return "";

	const gitDir = resolveGitDir(gitPath);
	const headPath = path.join(gitDir, "HEAD");
	if (!existsSync(headPath)) return "";

	const head = readFileSync(headPath, "utf8").trim();
	const directCommit = normalizeCommit(head);
	if (directCommit) return directCommit;

	const refName = head.match(/^ref:\s*(.+)$/)?.[1];
	if (!refName) return "";

	const refPath = path.join(gitDir, refName);
	if (existsSync(refPath)) {
		return normalizeCommit(readFileSync(refPath, "utf8"));
	}

	const packedRefsPath = path.join(gitDir, "packed-refs");
	if (!existsSync(packedRefsPath)) return "";

	const packedRefLine = readFileSync(packedRefsPath, "utf8")
		.split("\n")
		.find((line) => line.endsWith(` ${refName}`));
	return normalizeCommit(packedRefLine);
}

function findGitPath(cwd) {
	let current = path.resolve(cwd);
	while (true) {
		const gitPath = path.join(current, ".git");
		if (existsSync(gitPath)) return gitPath;
		const parent = path.dirname(current);
		if (parent === current) return "";
		current = parent;
	}
}

function resolveGitDir(gitPath) {
	try {
		const content = readFileSync(gitPath, "utf8").trim();
		const gitDir = content.match(/^gitdir:\s*(.+)$/)?.[1];
		if (gitDir) return path.resolve(path.dirname(gitPath), gitDir);
	} catch {
		// Directory .git checkouts land here.
	}
	return gitPath;
}

function normalizeCommit(value) {
	const match = String(value || "").match(/[a-f0-9]{7,40}/i);
	return match?.[0].toLowerCase() || "";
}

function toBuildCommit(commit) {
	return {
		short: commit.slice(0, 7),
		full: commit,
		source: commit.length >= 40 ? "sha" : "short-sha",
	};
}
