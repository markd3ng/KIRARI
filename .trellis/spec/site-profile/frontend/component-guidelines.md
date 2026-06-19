# Content, Data, And Snippets

Markdown/MDX files are inputs to the site's Astro content collections. Post
frontmatter must satisfy `apps/site/src/content.config.ts`; spec pages are
loaded by the `spec` collection.

JSON data is consumed by site pages/components. Preserve the current shape of
`friends.json` and `devices.json` unless source consumers and validation are
updated together.

Snippet files are trusted maintainer code copied to `apps/site/src/snippets`.
Only basename `.html` and `.js` files are accepted by the config loader.
Snippets are not visitor/CMS content and are intentionally an owner-level
escape hatch.
