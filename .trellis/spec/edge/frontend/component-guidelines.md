# Consumer Rendering

Treat Worker responses as third-party data because the Worker is a proxy, not a
sanitizer. Render strings as text/attributes by default and validate URLs
before use.

Components must still work when edge features are disabled. The default
configuration is static Pages-only; an edge dependency cannot become required
without an explicit architecture change and fallback plan.
