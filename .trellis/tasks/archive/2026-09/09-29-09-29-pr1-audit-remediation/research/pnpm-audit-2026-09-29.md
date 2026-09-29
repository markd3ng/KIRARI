# pnpm Audit Report — 2026-09-29

- Command: `pnpm audit --audit-level moderate`
- Working directory: repository root (`/Users/ian/Desktop/Projects/KIRARI`)
- Execution: registry communication and vulnerability analysis completed; exit code `1` because findings were present.
- Summary: 61 vulnerability instances (3 low, 24 moderate, 32 high, 2 critical) across 893 dependencies.
- Grouping: 60 pnpm/npm advisory records, 57 unique package/GHSA pairs, and 355 dependency-path occurrences. Installed versions are aggregated per package/GHSA pair.
- This report preserves every unique package/GHSA finding returned by pnpm; repeated dependency paths are counted but not expanded in the table. The full JSON response is retained at `/tmp/kirari-pnpm-audit.XXXXXX.json` during this task.

| Severity | Package | Installed | Advisory | Affected range | Patched range | Paths | Title |
|---|---|---|---|---|---|---:|---|
| Critical | astro | 6.4.8 | [GHSA-26w7-cxv4-gfx2](https://github.com/advisories/GHSA-26w7-cxv4-gfx2) | <7.2.8 | >=7.2.8 | 4 | Astro: Remote code execution through AVIF image optimization |
| Critical | tar | 7.5.16 | [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) | <=7.5.18 | >=7.5.19 | 1 | node-tar: Decompression/parse DoS via unlimited input |
| High | brace-expansion | 2.1.0 | [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | >=2.0.0 <2.1.2 | >=2.1.2 | 15 | brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups |
| High | brace-expansion | 2.1.0 | [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | >=2.0.0 <2.1.3 | >=2.1.3 | 15 | brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash |
| High | brace-expansion | 2.1.0 | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | >=2.0.0 <2.1.4 | >=2.1.4 | 15 | brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation |
| High | extract-zip | 2.0.1 | [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) | <=2.0.1 | <0.0.0 | 1 | extract-zip allows arbitrary file writes through symlink archive entries |
| High | extract-zip | 2.0.1 | [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) | <=2.0.1 | <0.0.0 | 1 | extract-zip unvalidated symlink path traversal |
| High | fast-uri | 3.1.2 | [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6) | >=3.0.0 <3.1.3 | >=3.1.3 | 2 | fast-uri vulnerable to host confusion via failed IDN canonicalization |
| High | fast-uri | 3.1.2 | [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) | >=3.0.0 <3.1.5 | >=3.1.5 | 2 | fast-uri vulnerable to host confusion via backslash authority introducer |
| High | fast-uri | 3.1.2 | [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | >=3.0.0 <3.1.6 | >=3.1.6 | 2 | fast-uri vulnerable to server-side request forgery via malformed IPv6 normalization |
| High | fast-uri | 3.1.2 | [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) | >=3.1.2 <3.1.6 | >=3.1.6 | 2 | fast-uri vulnerable to server-side request forgery via repeated hostname percent-decoding |
| High | fast-uri | 3.1.2 | [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | >=3.0.0 <3.1.6 | >=3.1.6 | 2 | fast-uri vulnerable to host confusion via percent-encoded scheme normalization |
| High | fast-uri | 3.1.2 | [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3) | >=3.0.0 <3.1.7 | >=3.1.7 | 2 | fast-uri vulnerable to authority injection via an unvalidated port in serialize |
| High | fast-uri | 3.1.2 | [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) | >=3.0.0 <=3.1.3 | >=3.1.4 | 2 | fast-uri vulnerable to host confusion via literal backslash authority delimiter |
| High | immutable | 4.3.8 | [GHSA-v56q-mh7h-f735](https://github.com/advisories/GHSA-v56q-mh7h-f735) | >=4.0.0-rc.1 <4.3.9 | >=4.3.9 | 14 | Immutable.js `List` 32-bit trie overflow → unrecoverable DoS |
| High | immutable | 4.3.8 | [GHSA-xvcm-6775-5m9r](https://github.com/advisories/GHSA-xvcm-6775-5m9r) | >=4.0.0-beta.1 <4.3.9 | >=4.3.9 | 14 | Immutable: Hash-collision algorithmic complexity denial of service in Immutable.Map/Set |
| High | js-yaml | 4.2.0 | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | >=4.0.0 <4.3.2 | >=4.3.2 | 16 | js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources |
| High | js-yaml | 4.2.0 | [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) | >=4.0.0 <4.3.0 | >=4.3.0 | 16 | js-yaml: YAML merge-key chains can force quadratic CPU consumption |
| High | js-yaml | 4.2.0 | [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | >=4.0.0 <4.3.1 | >=4.3.1 | 16 | JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported |
| High | linkify-it | 5.0.1 | [GHSA-v245-v573-v5vm](https://github.com/advisories/GHSA-v245-v573-v5vm) | <=5.0.1 | >=5.0.2 | 1 | linkify-it: Quadratic-complexity DoS via the `mailto:` validator scan-loop on attacker text |
| High | nanoid | 3.3.12 | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | <3.3.16 | >=3.3.16 | 29 | nanoid: non-secure generators can loop indefinitely with negative size |
| High | nanoid | 3.3.12 | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | <3.3.18 | >=3.3.18 | 29 | nanoid: custom generators can loop indefinitely when size is zero |
| High | postcss | 8.5.15 | [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | <=8.5.17 | >=8.5.18 | 29 | PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure |
| High | sharp | 0.34.5 | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) | <0.35.0 | >=0.35.0 | 5 | sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 |
| High | sharp | 0.34.5, 0.35.1 | [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | <0.35.4 | >=0.35.4 | 6 | sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545 |
| High | smol-toml | 1.6.1 | [GHSA-7w5x-hrqm-74c2](https://github.com/advisories/GHSA-7w5x-hrqm-74c2) | <=1.7.0 | >=1.7.1 | 16 | smol-toml: Denial of Service via malformed TOML documents |
| High | svgo | 3.3.3, 4.0.1 | [GHSA-2p49-hgcm-8545](https://github.com/advisories/GHSA-2p49-hgcm-8545) | >=4.0.0 <4.0.2 | >=4.0.2 | 5 | SVGO removeScripts plugin leaves some executable scripts intact |
| High | svgo | 3.3.3, 4.0.1 | [GHSA-w27v-7q3p-w38r](https://github.com/advisories/GHSA-w27v-7q3p-w38r) | >=4.0.0 <4.1.0 | >=4.1.0 | 5 | SVGO: removeScripts allows executable links through namespace and control-character bypasses |
| High | tar | 7.5.16 | [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w) | <=7.5.17 | >=7.5.18 | 1 | node-tar: Negative tar entry size causes infinite loop in archive replace |
| High | tar | 7.5.16 | [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) | <=7.5.20 | >=7.5.21 | 1 | node-tar: Uncontrolled recursion in mapHas/filesFilter allows uncatchable stack-overflow DoS via crafted long-path tar with member selection |
| High | undici | 7.28.0 | [GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272) | >=7.0.0 <7.29.0 | >=7.29.0 | 2 | undici vulnerable to cross-user information disclosure and parse-time crash via degenerate private cache directives |
| Moderate | @astrojs/rss | 4.0.18 | [GHSA-8j5q-mfj2-5q9q](https://github.com/advisories/GHSA-8j5q-mfj2-5q9q) | >=1.0.0 <4.0.19 | >=4.0.19 | 1 | @astrojs/rss: XML Injection via Unescaped RSS Feed Fields |
| Moderate | astro | 6.4.8 | [GHSA-376h-93r7-7g6f](https://github.com/advisories/GHSA-376h-93r7-7g6f) | <=7.2.3 | >=7.2.4 | 4 | Astro: Authorization bypass from missing path-segment boundary check when stripping the configured base |
| Moderate | astro | 6.4.8 | [GHSA-4g3v-8h47-v7g6](https://github.com/advisories/GHSA-4g3v-8h47-v7g6) | >=2.9.0 <=7.0.9 | >=7.1.0 | 4 | Astro: Reflected XSS via unescaped View Transition animation properties |
| Moderate | astro | 6.4.8 | [GHSA-f48w-9m4c-m7f5](https://github.com/advisories/GHSA-f48w-9m4c-m7f5) | <7.0.6 | >=7.0.6 | 4 | Astro: XSS via unescaped spread attribute names in renderHTMLElement (incomplete fix for CVE-2026-54298) |
| Moderate | devalue | 5.8.1 | [GHSA-9rgm-9g3h-6x36](https://github.com/advisories/GHSA-9rgm-9g3h-6x36) | <5.9.1 | >=5.9.2 | 10 | Svelte devalue: DoS via malformed input |
| Moderate | dompurify | 3.4.11 | [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) | <=3.4.12 | >=3.4.13 | 1 | DOMPurify: IN_PLACE hook removal leaves a detached subtree executable, causing XSS |
| Moderate | fflate | 0.7.4 | [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98) | >=0.7.0 <0.7.5 | >=0.7.5 | 1 | fflate unzipSync can enter an infinite loop when parsing malformed ZIP64 archives |
| Moderate | mermaid | 11.15.0 | [GHSA-2v8p-3f2j-5mp7](https://github.com/advisories/GHSA-2v8p-3f2j-5mp7) | >=11.0.0-alpha.1 <11.16.1 | >=11.16.1 | 1 | Mermaid XY Charts are vulnerable to an infinite loop DoS |
| Moderate | mermaid | 11.15.0 | [GHSA-3rrr-jr9j-h3q3](https://github.com/advisories/GHSA-3rrr-jr9j-h3q3) | >=11.5.0 <11.16.1 | >=11.16.1 | 1 | Mermaid Architecture diagrams are vulnerable to prototype pollution |
| Moderate | mermaid | 11.15.0 | [GHSA-6x64-9x62-f2gx](https://github.com/advisories/GHSA-6x64-9x62-f2gx) | >=11.0.0-alpha.1 <11.16.1 | >=11.16.1 | 1 | Mermaid allows CSS injection applying to sibling elements of the diagram |
| Moderate | mermaid | 11.15.0 | [GHSA-rhh3-jpg6-66xh](https://github.com/advisories/GHSA-rhh3-jpg6-66xh) | >=11.6.0 <11.16.1 | >=11.16.1 | 1 | Mermaid radar diagrams are vulnerable to DoS |
| Moderate | postcss | 8.5.15 | [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | <=8.5.22 | >=8.5.23 | 29 | PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset |
| Moderate | sanitize-html | 2.17.4 | [GHSA-g8qq-57p8-ggw5](https://github.com/advisories/GHSA-g8qq-57p8-ggw5) | >=1.9.0 <=2.17.6 | >=2.17.7 | 1 | ApostropheCMS: Stored XSS via SVG SMIL URI-list scheme-policy bypass |
| Moderate | sanitize-html | 2.17.4 | [GHSA-jxwj-j7wr-gfrw](https://github.com/advisories/GHSA-jxwj-j7wr-gfrw) | <=2.17.5 | >=2.17.6 | 1 | ApostropheCMS: Mutation-XSS / allowedTags bypass via literal `</textarea/>` solidus close |
| Moderate | sanitize-html | 2.17.4 | [GHSA-vccv-cmxp-4j9h](https://github.com/advisories/GHSA-vccv-cmxp-4j9h) | >=1.18.0 <=2.17.4 | >=2.17.5 | 1 | sanitize-html has incomplete URI scheme validation in that allows javascript: URIs through action, formaction, data, poster, and background attributes |
| Moderate | svgo | 3.3.3, 4.0.1 | [GHSA-4vpr-x523-8j87](https://github.com/advisories/GHSA-4vpr-x523-8j87) | >=4.0.0 <4.1.0 | >=4.1.0 | 5 | SVGO: removeScripts incompletely sanitizes executable HTML in SVG foreignObject elements |
| Moderate | tar | 7.5.16 | [GHSA-gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j) | <=7.5.16 | >=7.5.17 | 1 | node-tar: Uncaught Exception DoS via NUL byte in PAX path/linkpath records |
| Moderate | tar | 7.5.16 | [GHSA-w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp) | <=7.5.17 | >=7.5.18 | 1 | node-tar: Process crash via PAX numeric path type confusion |
| Moderate | undici | 7.28.0 | [GHSA-3wwx-pv8p-q78v](https://github.com/advisories/GHSA-3wwx-pv8p-q78v) | >=7.28.0 <7.29.1 | >=7.29.1 | 2 | undici vulnerable to Denial of Service via unhandled error in WebSocket permessage-deflate decompression |
| Moderate | undici | 7.28.0 | [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524) | >=7.0.0 <7.29.0 | >=7.29.0 | 2 | undici vulnerable to downstream response desynchronization via retry interceptor |
| Moderate | undici | 7.28.0 | [GHSA-jr45-8vmc-qm54](https://github.com/advisories/GHSA-jr45-8vmc-qm54) | >=7.0.0 <7.29.0 | >=7.29.0 | 2 | undici vulnerable to cross-user information disclosure via whitespace around equals in Cache-Control directives |
| Moderate | undici | 7.28.0 | [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5) | >=7.0.0 <7.29.0 | >=7.29.0 | 2 | undici vulnerable to CRLF Injection via blob-like body 'type' property |
| Moderate | undici | 7.28.0 | [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm) | >=7.0.0 <7.29.0 | >=7.29.0 | 2 | undici vulnerable to cookie attribute injection via unsanitized domain and unparsed setCookie fields |
| Low | astro | 6.4.8 | [GHSA-7pw4-f3q4-r2p2](https://github.com/advisories/GHSA-7pw4-f3q4-r2p2) | >=3.10.0 <7.0.4 | >=7.0.4 | 4 | Astro: Cross-site scripting via unescaped transition:* directive values on hydrated islands |
| Low | dompurify | 3.4.11 | [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4) | <=3.4.11 | >=3.4.12 | 1 | DOMPurify: `CUSTOM_ELEMENT_HANDLING` bypasses `afterSanitizeElements` for allowed custom elements. |
| Low | mermaid | 11.15.0 | [GHSA-c4c3-pg64-4m4v](https://github.com/advisories/GHSA-c4c3-pg64-4m4v) | >=11.0.0-alpha.1 <11.16.1 | >=11.16.1 | 1 | Mermaid configuration APIs allow prototype pollution |
