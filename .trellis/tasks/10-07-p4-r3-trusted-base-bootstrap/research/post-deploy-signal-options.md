# P7 native deployment signals — research only

Checked official documentation on 2026-10-15; no integration or webhook was created.

[Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github#repository-dispatch-events) supports `repository_dispatch` events including `vercel.deployment.success`, with deployment URL/environment in `client_payload`. It recommends migrating from the older `deployment_status` approach. This is the first option to evaluate for the existing Git integration, without adding a release controller.

The [webhook API](https://vercel.com/docs/webhooks/webhooks-api) also provides deployment events and raw-body HMAC verification using `x-vercel-signature`. Its `deployment.succeeded` event is conditional on registered checks; do not assume that name fires for every project. A webhook needs an endpoint/secret and therefore adds operational work. No such resource is provisioned by this correction.

For either transport, P7 must verify the sender/authenticity, approved team/project, Production target, immutable Git commit and READY state against authoritative deployment metadata, then confirm the canonical domain serves that deployment. Reject Preview, generic main CI, stale/replayed events, absent identity and arbitrary payload URLs. Event names alone are insufficient. Keep indexing opt-in/default-off, deduplicate per deployment/provider, and bound retries. Transport selection and tests belong to #100; application implementation remains deferred.
