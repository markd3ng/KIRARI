# Credits

KIRARI is a fork and continuation of the Fuwari ecosystem. This project keeps the
original upstream credit visible in the site footer and documents feature ideas
that were studied while evolving KIRARI-native implementations.

## Upstream

- [Fuwari](https://github.com/saicaca/fuwari) - original Astro blog theme and
  upstream project lineage.
- [JoeyC-Dev/saicaca-fuwari](https://github.com/JoeyC-Dev/saicaca-fuwari) -
  upstream fork lineage retained in KIRARI attribution.

## Feature References

- [Firefly](https://github.com/CuteLeaf/Firefly) - reference project sharing the
  Fuwari lineage. KIRARI studied Firefly's sidebar, TOC, mobile sidebar,
  search, comments, Sponsor, Guestbook, Bangumi, announcement, advertisement,
  site statistics, SiteInfo, calendar/heatmap, Friends page search/filter and
  application guidance, font, cover image, Mermaid, PlantUML, and admonition
  theme ideas.
- [Firefly-Docs](https://github.com/CuteLeaf/Firefly-Docs) - reference
  documentation project. KIRARI studied its deployment and GitHub Pages guidance
  style while keeping the main README/DEPLOY documentation native to KIRARI.

## KIRARI-Native Notes

- Sidebar, TOC, mobile widgets, comments, Sponsor, Guestbook, Bangumi, SiteInfo,
  SiteStats, calendar/heatmap, search page, PlantUML, Mermaid, and admonition
  options were implemented as KIRARI-native features rather than copied source.
- User-facing configuration remains TOML-first through `kirari.config.toml`,
  `src/types/config.ts`, and `src/utils/config-loader.ts`.
- Third-party or visitor-controlled content, including comments, is kept outside
  trusted `set:html` paths, Pagefind indexing, RSS, and LLMs output.
