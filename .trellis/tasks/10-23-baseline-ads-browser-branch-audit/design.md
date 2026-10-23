# Design

Read-only audit using current remote refs and connected GitHub/Vercel evidence. Treat historical docs only as leads; verify all reported state fresh.

For branch scope, record unique commits (`main...dev`) and compare both direct tip trees and three-dot history. Group commits only when their actual behavior and disposition are explicit. Inspect source/config/dependency graph for every meaningful file difference.

For browser evidence, prioritize documented Ego Lite capabilities. Use Chrome DevTools/CDP only for specific missing evidence (especially early script injection or performance trace). Keep all output under the task evidence directory or a temporary external directory; no diagnostic code is deployed.

The audit output feeds the implementation task. A root cause must be supported by controlled observations before a bugfix is proposed. Any unresolved dev difference or absent mandatory baseline becomes an explicit downstream gate.
