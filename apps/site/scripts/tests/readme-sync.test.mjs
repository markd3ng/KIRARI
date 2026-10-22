import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const siteRoot = fileURLToPath(new URL("../../", import.meta.url));
const repoRoot = resolve(siteRoot, "../..");

function tableRows(markdown, heading) {
  const sectionStart = markdown.indexOf(heading);
  assert.notEqual(sectionStart, -1, `missing section: ${heading}`);
  const section = markdown.slice(sectionStart + heading.length);
  const sectionEnd = section.search(/\n##? /);
  return (sectionEnd === -1 ? section : section.slice(0, sectionEnd))
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

function readAstroFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return readAstroFiles(path);
    return entry.isFile() && path.endsWith(".astro") ? [path] : [];
  });
}

function clientIslands() {
  const found = new Map();
  for (const path of readAstroFiles(join(siteRoot, "src"))) {
    const source = readFileSync(path, "utf8");
    const componentStart = /<([A-Z][A-Za-z0-9]*)\b/g;
    let match;
    while ((match = componentStart.exec(source))) {
      let cursor = componentStart.lastIndex;
      let quote = "";
      let expressionDepth = 0;
      for (; cursor < source.length; cursor += 1) {
        const char = source[cursor];
        if (quote) {
          if (char === "\\") cursor += 1;
          else if (char === quote) quote = "";
          continue;
        }
        if (char === '"' || char === "'" || char === "`") quote = char;
        else if (char === "{") expressionDepth += 1;
        else if (char === "}") expressionDepth -= 1;
        else if (char === ">" && expressionDepth === 0) break;
      }
      if (cursor >= source.length) continue;
      const openingTag = source.slice(match.index, cursor + 1);
      const directive = openingTag.match(
        /\bclient:(load|idle|only|visible|media|none)\b(?:\s*=\s*(["'])(.*?)\2)?/s,
      );
      if (directive) {
        const value = directive[3] ? `="${directive[3]}"` : "";
        found.set(match[1], `client:${directive[1]}${value}`);
      }
      componentStart.lastIndex = cursor + 1;
    }
  }
  return [...found].sort(([left], [right]) => left.localeCompare(right));
}

test("README tech-stack package versions match the Site manifest", () => {
  const manifest = JSON.parse(
    readFileSync(join(siteRoot, "package.json"), "utf8"),
  );
  for (const [path, heading] of [
    [join(repoRoot, "README.md"), "## Tech Stack"],
    [join(repoRoot, "README_CN.md"), "## 技术栈"],
  ]) {
    const markdown = readFileSync(path, "utf8");
    for (const [category, packages, versions] of tableRows(
      markdown,
      heading,
    ).filter((cells) => cells.length === 3 && cells[1].includes("`"))) {
      const names = [...packages.matchAll(/`([^`]+)`/g)].map((item) => item[1]);
      const documentedVersions = [...versions.matchAll(/`([^`]+)`/g)].map(
        (item) => item[1],
      );
      assert.equal(
        names.length,
        documentedVersions.length,
        `${path}: package/version count differs in ${category}`,
      );
      for (const [index, name] of names.entries()) {
        assert.equal(
          documentedVersions[index],
          manifest.dependencies[name],
          `${path}: ${name} version is stale`,
        );
      }
    }
  }
});

test("Site Trellis guide names the manifest Astro major", () => {
  const manifest = JSON.parse(
    readFileSync(join(siteRoot, "package.json"), "utf8"),
  );
  const guide = readFileSync(
    join(repoRoot, ".trellis/spec/site/frontend/index.md"),
    "utf8",
  );
  assert.ok(
    guide.includes(`Astro ${manifest.dependencies.astro.split(".")[0]}`),
  );
});

test("both READMEs list every current Astro client island and hydration directive", () => {
  const islands = clientIslands();
  assert.deepEqual(islands, [
    ["DevicesFilter", "client:load"],
    ["DisplaySettings", 'client:only="svelte"'],
    ["LightDarkSwitch", "client:idle"],
    ["PrivacySettings", "client:load"],
    ["Search", "client:idle"],
    ["SharePoster", "client:load"],
  ]);
  for (const [path, countLabel] of [
    [join(repoRoot, "README.md"), "Client islands"],
    [join(repoRoot, "README_CN.md"), "客户端 Islands"],
  ]) {
    const markdown = readFileSync(path, "utf8");
    assert.ok(
      markdown.includes(`${countLabel} (${islands.length})`) ||
        markdown.includes(`${countLabel}（${islands.length}）`),
      `${path}: island count is stale`,
    );
    for (const [name, directive] of islands) {
      assert.ok(
        markdown
          .split("\n")
          .some(
            (line) =>
              line.includes(`\`${name}\``) && line.includes(`\`${directive}\``),
          ),
        `${path}: missing ${name} ${directive}`,
      );
    }
  }
});
