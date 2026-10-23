# Design

This task is strictly downstream of child `10-23-layout-fix-dev-reconciliation`. It begins from the latest verified `main`, uses a dedicated release branch and PR, and never tags an unverified candidate. Branch synchronization preserves ancestry and obeys protection. The provider's native Git deployment remains the release controller; no manual deployment or configuration change is planned unless repository evidence shows the native path cannot fulfill the requested verification.

Version and changelog content must be derived from merged changes since `v0.5.0`. Tagging is an irreversible release boundary, so freeze and record the exact commit only after CI, `dev` content equality, and all prior gates pass. Production is verified from provider deployment metadata and a direct browser check.

If a published tag or mismatched deployment is discovered, stop and report it; never rewrite the tag or infer deployment success from source CI.
