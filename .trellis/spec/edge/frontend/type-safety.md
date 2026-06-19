# Consumer Type Safety

`EdgeConfig` types configuration, not upstream response bodies. GitHub,
Bangumi, and avatar payloads still require runtime checks at the consumer
boundary.

Never treat `response.json()` as trusted through a TypeScript cast alone.
Validate fields used for links, images, HTML, cache keys, or branching.
