import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { close, createIndex } from "pagefind";

export function collectPagefindHtmlFiles(siteDir) {
	const files = [];
	const visit = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const file = join(directory, entry.name);
			if (entry.isDirectory()) visit(file);
			else if (entry.isFile() && entry.name.endsWith(".html")) {
				files.push({
					file,
					sourcePath: relative(siteDir, file).split(sep).join("/"),
				});
			}
		}
	};
	visit(siteDir);
	return files.sort((a, b) => (a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0));
}

export async function buildPagefindIndex(siteDir) {
	try {
		const { errors, index } = await createIndex();
		if (errors.length || !index) throw new Error(`Pagefind index creation failed: ${errors.join("; ")}`);

		for (const page of collectPagefindHtmlFiles(siteDir)) {
			const result = await index.addHTMLFile({
				sourcePath: page.sourcePath,
				content: readFileSync(page.file, "utf8"),
			});
			if (result.errors.length) {
				throw new Error(`Pagefind could not index ${page.sourcePath}: ${result.errors.join("; ")}`);
			}
		}

		const output = await index.writeFiles({ outputPath: join(siteDir, "pagefind") });
		if (output.errors.length) throw new Error(`Pagefind index writing failed: ${output.errors.join("; ")}`);
	} finally {
		await close();
	}
}
