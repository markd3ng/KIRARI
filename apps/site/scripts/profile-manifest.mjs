import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse } from "smol-toml";

const DEFAULT_FAVICONS = [
	"favicon-light-32.png",
	"favicon-light-128.png",
	"favicon-light-180.png",
	"favicon-light-192.png",
	"favicon-dark-32.png",
	"favicon-dark-128.png",
	"favicon-dark-180.png",
	"favicon-dark-192.png",
];

/**
 * The single source of truth for Site-owned paths and their generated targets.
 * Optional directory inputs use an empty directory when absent so old data
 * cannot survive; optional files are removed when absent.
 */
export const PROFILE_MAPPINGS = Object.freeze([
	{
		source: "kirari.config.toml",
		target: "kirari.config.toml",
		kind: "file",
		required: true,
		validate: "toml",
	},
	{
		source: "content/posts",
		target: "src/content/posts",
		kind: "directory",
		required: false,
		emptyWhenMissing: true,
	},
	{
		source: "content/spec",
		target: "src/content/spec",
		kind: "directory",
		required: true,
		requiredFiles: ["about.md", "friends.md", "projects.md"],
	},
	{
		source: "data/friends.json",
		target: "src/_data/friends.json",
		kind: "file",
		required: true,
		validate: "friends-json",
	},
	{
		source: "data/devices.json",
		target: "src/_data/devices.json",
		kind: "file",
		required: false,
		validate: "devices-json",
	},
	{
		source: "assets/images",
		target: "src/assets/images",
		kind: "directory",
		required: true,
		requiredFiles: ["demo-avatar.png", "demo-banner.png"],
	},
	{
		source: "assets/images/devices",
		target: "public/images/devices",
		kind: "directory",
		required: false,
		emptyWhenMissing: true,
	},
	{
		source: "assets/favicon",
		target: "public/favicon",
		kind: "directory",
		required: true,
		requiredFiles: DEFAULT_FAVICONS,
	},
	{
		source: "assets/og",
		target: "public/og",
		kind: "directory",
		required: true,
		requiredFiles: ["default.png"],
	},
	{
		source: "snippets",
		target: "src/snippets",
		kind: "directory",
		required: false,
		emptyWhenMissing: true,
	},
	{
		source: "ads.txt",
		target: "public/ads.txt",
		kind: "file",
		required: false,
	},
]);

const MANIFEST_NAME = ".kirari-profile-manifest.json";

export function validateProfileSource(profilePath, sitePath) {
	const profileDir = canonicalDirectory(profilePath, "Site source");
	const siteDir = canonicalProspectiveDirectory(sitePath, "generated Site target");
	assertDisjointRoots(profileDir, siteDir);

	const mappings = PROFILE_MAPPINGS.map((mapping) => {
		const sourcePath = resolve(profileDir, mapping.source);
		const targetPath = resolve(siteDir, mapping.target);
		assertContained(profileDir, sourcePath, `Site input ${mapping.source}`);
		assertContained(siteDir, targetPath, `Site target ${mapping.target}`);

		const stat = lstatOrUndefined(sourcePath);
		if (!stat) {
			if (mapping.required) {
				throw new Error(`Required Site input ${mapping.source} -> ${mapping.target} is missing.`);
			}
			return { ...mapping, sourcePath, targetPath, present: false };
		}

		assertExpectedType(mapping, stat);
		validateTree(sourcePath, profileDir, mapping);
		validateRequiredFiles(sourcePath, mapping);
		validateMappedData(sourcePath, mapping);
		return { ...mapping, sourcePath, targetPath, present: true };
	});
	for (const mapping of mappings) assertSafeDestination(siteDir, mapping.targetPath, mapping.kind);
	assertSafeDestination(siteDir, join(siteDir, MANIFEST_NAME), "file");

	return { profileDir, siteDir, mappings };
}

export function materializeProfile(profilePath, sitePath) {
	const contract = validateProfileSource(profilePath, sitePath);
	mkdirSync(contract.siteDir, { recursive: true });
	const siteDir = realpathSync(contract.siteDir);
	assertDisjointRoots(contract.profileDir, siteDir);
	for (const mapping of contract.mappings) {
		assertSafeDestination(siteDir, resolve(siteDir, mapping.target));
	}
	const manifestPath = join(siteDir, MANIFEST_NAME);
	assertSafeDestination(siteDir, manifestPath, "file");

	const stageDir = mkdtempSync(join(siteDir, ".kirari-profile-stage-"));
	const backupDir = join(stageDir, "backup");
	const stagedMappings = [];
	let preserveStage = false;
	let manifest;
	try {
		for (const mapping of contract.mappings) {
			const stagePath = resolve(stageDir, "next", mapping.target);
			assertContained(join(stageDir, "next"), stagePath, `staged Site target ${mapping.target}`);
			if (mapping.present) {
				copyValidatedTree(mapping.sourcePath, stagePath, contract.profileDir);
				stagedMappings.push(mapping.target);
			} else if (mapping.emptyWhenMissing) {
				mkdirSync(stagePath, { recursive: true });
			}
		}

		manifest = {
			version: 1,
			sourceRoot: contract.profileDir,
			materialized: stagedMappings,
			omittedOptional: contract.mappings.filter((item) => !item.present).map((item) => item.source),
		};
		const stagedManifest = join(stageDir, "next", MANIFEST_NAME);
		mkdirSync(dirname(stagedManifest), { recursive: true });
		writeFileSync(stagedManifest, `${JSON.stringify(manifest, null, 2)}\n`);

		const operations = [];
		try {
			for (const mapping of contract.mappings) {
				installStagedPath(
					resolve(siteDir, mapping.target),
					resolve(stageDir, "next", mapping.target),
					resolve(backupDir, mapping.target),
					operations,
				);
			}
			installStagedPath(manifestPath, stagedManifest, join(backupDir, MANIFEST_NAME), operations);
		} catch (error) {
			const rollbackErrors = rollback(operations);
			if (rollbackErrors.length > 0) {
				preserveStage = true;
				throw new AggregateError(
					[error, ...rollbackErrors],
					`Site materialization failed and rollback was incomplete; recovery files are at ${stageDir}`,
				);
			}
			throw error;
		}
	} catch (error) {
		if (!preserveStage) {
			try {
				rmSync(stageDir, { recursive: true, force: false });
			} catch (cleanupError) {
				throw new AggregateError([error, cleanupError], `Site materialization failed; staging cleanup also failed at ${stageDir}`);
			}
		}
		throw error;
	}

	try {
		rmSync(stageDir, { recursive: true, force: false });
	} catch (error) {
		throw new Error(`Site inputs were installed, but staging cleanup failed at ${stageDir}: ${error.message}`, { cause: error });
	}
	return manifest;
}

function canonicalDirectory(path, label) {
	if (!path) throw new Error(`${label} path is required.`);
	let canonical;
	try {
		canonical = realpathSync(resolve(path));
	} catch {
		throw new Error(`${label} does not exist: ${path}`);
	}
	if (!lstatSync(canonical).isDirectory()) throw new Error(`${label} must be a directory: ${path}`);
	return canonical;
}

function canonicalProspectiveDirectory(path, label) {
	if (!path) throw new Error(`${label} path is required.`);
	const absolute = resolve(path);
	let current = absolute;
	const remaining = [];
	while (!existsSync(current)) {
		const parent = dirname(current);
		if (parent === current) throw new Error(`Cannot resolve ${label}: ${path}`);
		remaining.unshift(current.slice(parent.length + 1));
		current = parent;
	}
	const currentStat = lstatSync(current);
	if (currentStat.isSymbolicLink()) throw new Error(`${label} must not be a symlink: ${current}`);
	if (!currentStat.isDirectory()) throw new Error(`${label} parent must be a directory: ${current}`);
	return resolve(realpathSync(current), ...remaining);
}

function assertDisjointRoots(profileDir, siteDir) {
	if (isWithin(profileDir, siteDir) || isWithin(siteDir, profileDir)) {
		throw new Error(`Site source and generated target must be separate, non-overlapping directories: ${profileDir} -> ${siteDir}`);
	}
}

function assertContained(root, candidate, label) {
	const rel = relative(root, candidate);
	if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
		throw new Error(`${label} escapes its owned root: ${candidate}`);
	}
}

function isWithin(root, candidate) {
	const rel = relative(root, candidate);
	return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function assertExpectedType(mapping, stat) {
	if (stat.isSymbolicLink()) {
		throw new Error(`Site input ${mapping.source} -> ${mapping.target} must not be a symlink.`);
	}
	const matches = mapping.kind === "directory" ? stat.isDirectory() : stat.isFile();
	if (!matches) {
		throw new Error(`Site input ${mapping.source} -> ${mapping.target} must be a ${mapping.kind}.`);
	}
}

function validateTree(path, profileDir, mapping) {
	const stat = lstatSync(path);
	if (stat.isSymbolicLink()) {
		throw new Error(`Site input ${mapping.source} -> ${mapping.target} contains a symlink: ${relative(profileDir, path)}`);
	}
	if (stat.isFile()) {
		assertContained(profileDir, realpathSync(path), `Site input ${relative(profileDir, path)}`);
		return;
	}
	if (!stat.isDirectory()) {
		throw new Error(`Site input ${mapping.source} -> ${mapping.target} contains an unsupported file type: ${relative(profileDir, path)}`);
	}
	assertContained(profileDir, realpathSync(path), `Site input ${relative(profileDir, path)}`);
	for (const name of readdirSync(path)) validateTree(join(path, name), profileDir, mapping);
}

function validateRequiredFiles(sourcePath, mapping) {
	for (const child of mapping.requiredFiles || []) {
		const requiredPath = resolve(sourcePath, child);
		if (!isWithin(sourcePath, requiredPath)) {
			throw new Error(`Invalid required Site input path ${mapping.source}/${child} -> ${mapping.target}.`);
		}
		const stat = lstatOrUndefined(requiredPath);
		if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
			throw new Error(`Required Site input ${mapping.source}/${child} -> ${mapping.target}/${child} is missing or not a regular file.`);
		}
	}
}

function validateMappedData(sourcePath, mapping) {
	if (!mapping.validate) return;
	const text = readFileSync(sourcePath, "utf8");
	try {
		if (mapping.validate === "toml") {
			const value = parse(text);
			if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected a TOML table");
		}
		if (mapping.validate === "friends-json") {
			const value = JSON.parse(text);
			if (!Array.isArray(value)) throw new Error("expected a JSON array");
			for (const [index, friend] of value.entries()) {
				if (!friend || typeof friend !== "object" || Array.isArray(friend)) throw new Error(`entry ${index + 1} must be an object`);
				for (const field of ["siteTitle", "siteDesc", "siteUrl", "siteIcon"]) {
					if (typeof friend[field] !== "string") throw new Error(`entry ${index + 1} is missing string field ${field}`);
				}
			}
		}
		if (mapping.validate === "devices-json") {
			const value = JSON.parse(text);
			if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected a JSON object");
			if (value.brands !== undefined && !Array.isArray(value.brands)) throw new Error("brands must be an array");
		}
	} catch (error) {
		throw new Error(`Invalid Site input ${mapping.source} -> ${mapping.target}: ${error.message}`);
	}
}

function assertSafeDestination(siteDir, targetPath, expectedKind) {
	assertContained(siteDir, targetPath, `Site target ${relative(siteDir, targetPath)}`);
	let current = siteDir;
	const parts = relative(siteDir, targetPath).split(sep).filter(Boolean);
	for (let index = 0; index < parts.length; index += 1) {
		current = join(current, parts[index]);
		const stat = lstatOrUndefined(current);
		if (!stat) return;
		if (stat.isSymbolicLink()) throw new Error(`Site target ${relative(siteDir, current)} must not be a symlink.`);
		const isFinal = index === parts.length - 1;
		if (!isFinal && !stat.isDirectory()) {
			throw new Error(`Site target parent is not a directory: ${current}`);
		}
		if (isFinal && expectedKind) {
			const matches = expectedKind === "directory" ? stat.isDirectory() : stat.isFile();
			if (!matches) throw new Error(`Site target has the wrong file type: ${current}`);
		}
	}
}

function copyValidatedTree(sourcePath, targetPath, profileDir) {
	const stat = lstatSync(sourcePath);
	if (stat.isSymbolicLink()) throw new Error(`Site input became a symlink while copying: ${sourcePath}`);
	assertContained(profileDir, realpathSync(sourcePath), `Site input ${sourcePath}`);
	if (stat.isDirectory()) {
		mkdirSync(targetPath, { recursive: true });
		for (const name of readdirSync(sourcePath)) {
			copyValidatedTree(join(sourcePath, name), join(targetPath, name), profileDir);
		}
		return;
	}
	if (!stat.isFile()) throw new Error(`Site input has an unsupported type: ${sourcePath}`);
	mkdirSync(dirname(targetPath), { recursive: true });
	copyFileSync(sourcePath, targetPath);
}

function installStagedPath(targetPath, stagePath, backupPath, operations) {
	const operation = { targetPath, backupPath, backupMoved: false, targetInstalled: false };
	operations.push(operation);
	if (lstatOrUndefined(targetPath)) {
		mkdirSync(dirname(backupPath), { recursive: true });
		renameSync(targetPath, backupPath);
		operation.backupMoved = true;
	}
	if (lstatOrUndefined(stagePath)) {
		mkdirSync(dirname(targetPath), { recursive: true });
		renameSync(stagePath, targetPath);
		operation.targetInstalled = true;
	}
}

function rollback(operations) {
	const errors = [];
	for (const operation of operations.reverse()) {
		try {
			if (operation.targetInstalled && lstatOrUndefined(operation.targetPath)) {
				rmSync(operation.targetPath, { recursive: true, force: false });
			}
			if (operation.backupMoved && lstatOrUndefined(operation.backupPath)) {
				mkdirSync(dirname(operation.targetPath), { recursive: true });
				renameSync(operation.backupPath, operation.targetPath);
			}
		} catch (error) {
			errors.push(error);
		}
	}
	return errors;
}

function lstatOrUndefined(path) {
	try {
		return lstatSync(path);
	} catch (error) {
		if (error.code === "ENOENT") return undefined;
		throw error;
	}
}
