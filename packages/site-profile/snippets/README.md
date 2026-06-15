# Trusted Custom Snippets

Place optional maintainer-owned snippets in this directory and reference them from
`kirari.config.toml`.

- `head.html`: injected raw into `<head>`.
- `head.js`: injected as inline script content in `<head>`. Do not include
  `<script>` tags.
- `footer.html`: injected raw near the footer.
- `footer.js`: injected as inline script content near the footer. Do not include
  `<script>` tags.

Only basename file names are accepted, such as `head.html` or `footer.js`.
Directory paths, absolute paths, and `..` traversal are ignored.

These snippets are trusted site-maintainer input. Do not populate them from
visitor submissions, CMS fields, comments, or other untrusted sources.
