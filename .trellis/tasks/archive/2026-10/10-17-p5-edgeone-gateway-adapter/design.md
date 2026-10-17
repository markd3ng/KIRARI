# Design

Use a separate workspace package for the Makers adapter, delegating every operation to createGatewayHandler. A platform handler uses the documented Makers context; a deterministic local packaging command emits the documented file-route bundle. Reuse existing esbuild toolchain where available; introduce no runtime dependency or generic deployment framework. Public configuration is compile-time only; never inspect platform env/Secrets/cache/KV until separately proven. Cache/token remain unavailable explicitly, with no capability escalation via client headers.

A research agent verifies current official Makers contracts before runtime code is finalized. Root owns implementation; independent reviewer is read-only. Packaging must write only its dedicated output directory and reject destructive paths/symlinks. No deployment command in scripts or CI.
