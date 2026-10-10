# Complete npm audit advisory inventory

This file is generated from the retained raw `npm audit --audit-level moderate --json` report. Each package entry preserves all fields returned by npm, including every advisory object, dependency path, affected range, effect, and remediation proposal.

- Raw npm audit report SHA-256: `sha256:5692d1f55776c14036dbbf7bb3e1a3d6d48d2cdb130309853fb0b4d8b4f087e5`
- npm audit report schema version: 2
- Vulnerable package entries: 33
- Advisory objects in package entries: 38
- Total advisory and inherited/transitive references: 107
- npm reported vulnerability counts: {
  "critical": 1,
  "high": 24,
  "info": 0,
  "low": 0,
  "moderate": 8,
  "total": 33
}
- npm reported dependency counts: {
  "dev": 0,
  "optional": 104,
  "peer": 3,
  "peerOptional": 0,
  "prod": 280,
  "total": 383
}

Counts are npm's package-level audit metadata; package entries and advisory objects are not counts of unique CVEs.

## @fastify/busboy

- Severity: high
- Affected package range: <=3.2.1
- Installed dependency path: `node_modules/@fastify/busboy`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `undici`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "GHSA-x8mw-p69m-v3mx",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-754"
      ],
      "dependency": "@fastify/busboy",
      "name": "@fastify/busboy",
      "range": ">=1.0.0 <3.2.1",
      "severity": "high",
      "source": 1240982,
      "title": "@fastify/busboy vulnerable to Denial of Service via prototype-named multipart part header",
      "url": "https://github.com/advisories/GHSA-x8mw-p69m-v3mx"
    },
    {
      "advisory_id": "GHSA-gxm5-99cw-xjw9",
      "cvss": {
        "score": 5.8,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:N/I:L/A:N"
      },
      "cwe": [
        "CWE-93"
      ],
      "dependency": "@fastify/busboy",
      "name": "@fastify/busboy",
      "range": "<3.2.2",
      "severity": "moderate",
      "source": 1241276,
      "title": "@fastify/busboy vulnerable to CRLF injection via multipart Content-Disposition filename and name",
      "url": "https://github.com/advisories/GHSA-gxm5-99cw-xjw9"
    }
  ],
  "effects": [
    "undici"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@fastify/busboy",
  "nodes": [
    "node_modules/@fastify/busboy"
  ],
  "range": "<=3.2.1",
  "severity": "high",
  "via": [
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-754"
      ],
      "dependency": "@fastify/busboy",
      "name": "@fastify/busboy",
      "range": ">=1.0.0 <3.2.1",
      "severity": "high",
      "source": 1240982,
      "title": "@fastify/busboy vulnerable to Denial of Service via prototype-named multipart part header",
      "url": "https://github.com/advisories/GHSA-x8mw-p69m-v3mx"
    },
    {
      "cvss": {
        "score": 5.8,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:N/I:L/A:N"
      },
      "cwe": [
        "CWE-93"
      ],
      "dependency": "@fastify/busboy",
      "name": "@fastify/busboy",
      "range": "<3.2.2",
      "severity": "moderate",
      "source": 1241276,
      "title": "@fastify/busboy vulnerable to CRLF injection via multipart Content-Disposition filename and name",
      "url": "https://github.com/advisories/GHSA-gxm5-99cw-xjw9"
    }
  ]
}
```

## @ts-morph/common

- Severity: high
- Affected package range: 0.2.0 - 0.24.0 || 0.26.0 - 0.27.0
- Installed dependency path: `node_modules/@ts-morph/common`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `ts-morph`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "fast-glob"
    }
  ],
  "effects": [
    "ts-morph"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@ts-morph/common",
  "nodes": [
    "node_modules/@ts-morph/common"
  ],
  "range": "0.2.0 - 0.24.0 || 0.26.0 - 0.27.0",
  "severity": "high",
  "via": [
    "fast-glob"
  ]
}
```

## @vercel/backends

- Severity: high
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/backends`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/cervel`, `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "path-to-regexp"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ts-morph"
    }
  ],
  "effects": [
    "@vercel/cervel",
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/backends",
  "nodes": [
    "node_modules/@vercel/backends"
  ],
  "range": "*",
  "severity": "high",
  "via": [
    "@vercel/static-config",
    "path-to-regexp",
    "ts-morph"
  ]
}
```

## @vercel/cervel

- Severity: high
- Affected package range: >=0.0.12
- Installed dependency path: `node_modules/@vercel/cervel`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/express`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/backends"
    }
  ],
  "effects": [
    "@vercel/express"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/cervel",
  "nodes": [
    "node_modules/@vercel/cervel"
  ],
  "range": ">=0.0.12",
  "severity": "high",
  "via": [
    "@vercel/backends"
  ]
}
```

## @vercel/container

- Severity: moderate
- Affected package range: >=8.1.0
- Installed dependency path: `node_modules/@vercel/container`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "smol-toml"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "tar"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/container",
  "nodes": [
    "node_modules/@vercel/container"
  ],
  "range": ">=8.1.0",
  "severity": "moderate",
  "via": [
    "smol-toml",
    "tar"
  ]
}
```

## @vercel/elysia

- Severity: moderate
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/elysia`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/node"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/elysia",
  "nodes": [
    "node_modules/@vercel/elysia"
  ],
  "range": "*",
  "severity": "moderate",
  "via": [
    "@vercel/node",
    "@vercel/static-config"
  ]
}
```

## @vercel/express

- Severity: high
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/express`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/cervel"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/node"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "path-to-regexp"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ts-morph"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/express",
  "nodes": [
    "node_modules/@vercel/express"
  ],
  "range": "*",
  "severity": "high",
  "via": [
    "@vercel/cervel",
    "@vercel/node",
    "@vercel/static-config",
    "path-to-regexp",
    "ts-morph"
  ]
}
```

## @vercel/fastify

- Severity: moderate
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/fastify`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/node"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/fastify",
  "nodes": [
    "node_modules/@vercel/fastify"
  ],
  "range": "*",
  "severity": "moderate",
  "via": [
    "@vercel/node",
    "@vercel/static-config"
  ]
}
```

## @vercel/h3

- Severity: moderate
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/h3`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/node"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/h3",
  "nodes": [
    "node_modules/@vercel/h3"
  ],
  "range": "*",
  "severity": "moderate",
  "via": [
    "@vercel/node",
    "@vercel/static-config"
  ]
}
```

## @vercel/hono

- Severity: high
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/hono`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/node"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "path-to-regexp"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ts-morph"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/hono",
  "nodes": [
    "node_modules/@vercel/hono"
  ],
  "range": "*",
  "severity": "high",
  "via": [
    "@vercel/node",
    "@vercel/static-config",
    "path-to-regexp",
    "ts-morph"
  ]
}
```

## @vercel/hydrogen

- Severity: high
- Affected package range: >=1.0.1
- Installed dependency path: `node_modules/@vercel/hydrogen`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ts-morph"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/hydrogen",
  "nodes": [
    "node_modules/@vercel/hydrogen"
  ],
  "range": ">=1.0.1",
  "severity": "high",
  "via": [
    "@vercel/static-config",
    "ts-morph"
  ]
}
```

## @vercel/koa

- Severity: moderate
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/koa`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/node"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/koa",
  "nodes": [
    "node_modules/@vercel/koa"
  ],
  "range": "*",
  "severity": "moderate",
  "via": [
    "@vercel/node",
    "@vercel/static-config"
  ]
}
```

## @vercel/nestjs

- Severity: moderate
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/nestjs`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/node"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/nestjs",
  "nodes": [
    "node_modules/@vercel/nestjs"
  ],
  "range": "*",
  "severity": "moderate",
  "via": [
    "@vercel/node",
    "@vercel/static-config"
  ]
}
```

## @vercel/node

- Severity: high
- Affected package range: >=2.1.1-canary.0
- Installed dependency path: `node_modules/@vercel/node`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/elysia`, `@vercel/express`, `@vercel/fastify`, `@vercel/h3`, `@vercel/hono`, `@vercel/koa`, `@vercel/nestjs`, `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "path-to-regexp"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ts-morph"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "undici"
    }
  ],
  "effects": [
    "@vercel/elysia",
    "@vercel/express",
    "@vercel/fastify",
    "@vercel/h3",
    "@vercel/hono",
    "@vercel/koa",
    "@vercel/nestjs",
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/node",
  "nodes": [
    "node_modules/@vercel/node"
  ],
  "range": ">=2.1.1-canary.0",
  "severity": "high",
  "via": [
    "@vercel/static-config",
    "path-to-regexp",
    "ts-morph",
    "undici"
  ]
}
```

## @vercel/python

- Severity: high
- Affected package range: 6.11.0 - 6.12.0 || >=6.14.1
- Installed dependency path: `node_modules/@vercel/python`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/python-analysis"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/python",
  "nodes": [
    "node_modules/@vercel/python"
  ],
  "range": "6.11.0 - 6.12.0 || >=6.14.1",
  "severity": "high",
  "via": [
    "@vercel/python-analysis"
  ]
}
```

## @vercel/python-analysis

- Severity: high
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/python-analysis`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/python`, `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "js-yaml"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "minimatch"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "smol-toml"
    }
  ],
  "effects": [
    "@vercel/python",
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/python-analysis",
  "nodes": [
    "node_modules/@vercel/python-analysis"
  ],
  "range": "*",
  "severity": "high",
  "via": [
    "js-yaml",
    "minimatch",
    "smol-toml"
  ]
}
```

## @vercel/redwood

- Severity: high
- Affected package range: >=2.1.0
- Installed dependency path: `node_modules/@vercel/redwood`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ts-morph"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/redwood",
  "nodes": [
    "node_modules/@vercel/redwood"
  ],
  "range": ">=2.1.0",
  "severity": "high",
  "via": [
    "@vercel/static-config",
    "ts-morph"
  ]
}
```

## @vercel/remix-builder

- Severity: high
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/remix-builder`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "path-to-regexp"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ts-morph"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/remix-builder",
  "nodes": [
    "node_modules/@vercel/remix-builder"
  ],
  "range": "*",
  "severity": "high",
  "via": [
    "@vercel/static-config",
    "path-to-regexp",
    "ts-morph"
  ]
}
```

## @vercel/rust

- Severity: moderate
- Affected package range: >=1.0.6
- Installed dependency path: `node_modules/@vercel/rust`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "smol-toml"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/rust",
  "nodes": [
    "node_modules/@vercel/rust"
  ],
  "range": ">=1.0.6",
  "severity": "moderate",
  "via": [
    "smol-toml"
  ]
}
```

## @vercel/static-build

- Severity: high
- Affected package range: >=2.0.7
- Installed dependency path: `node_modules/@vercel/static-build`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-config"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ts-morph"
    }
  ],
  "effects": [
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/static-build",
  "nodes": [
    "node_modules/@vercel/static-build"
  ],
  "range": ">=2.0.7",
  "severity": "high",
  "via": [
    "@vercel/static-config",
    "ts-morph"
  ]
}
```

## @vercel/static-config

- Severity: high
- Affected package range: *
- Installed dependency path: `node_modules/@vercel/static-config`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/backends`, `@vercel/hydrogen`, `@vercel/node`, `@vercel/redwood`, `@vercel/remix-builder`, `@vercel/static-build`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ajv"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "ts-morph"
    }
  ],
  "effects": [
    "@vercel/backends",
    "@vercel/hydrogen",
    "@vercel/node",
    "@vercel/redwood",
    "@vercel/remix-builder",
    "@vercel/static-build"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "@vercel/static-config",
  "nodes": [
    "node_modules/@vercel/static-config"
  ],
  "range": "*",
  "severity": "high",
  "via": [
    "ajv",
    "ts-morph"
  ]
}
```

## ajv

- Severity: moderate
- Affected package range: 7.0.0-alpha.0 - 8.17.1
- Installed dependency path: `node_modules/ajv`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/static-config`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "GHSA-2g4f-4pwh-qvx6",
      "cvss": {
        "score": 0,
        "vectorString": null
      },
      "cwe": [
        "CWE-400",
        "CWE-1333"
      ],
      "dependency": "ajv",
      "name": "ajv",
      "range": ">=7.0.0-alpha.0 <8.18.0",
      "severity": "moderate",
      "source": 1113715,
      "title": "ajv has ReDoS when using `$data` option",
      "url": "https://github.com/advisories/GHSA-2g4f-4pwh-qvx6"
    }
  ],
  "effects": [
    "@vercel/static-config"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "ajv",
  "nodes": [
    "node_modules/ajv"
  ],
  "range": "7.0.0-alpha.0 - 8.17.1",
  "severity": "moderate",
  "via": [
    {
      "cvss": {
        "score": 0,
        "vectorString": null
      },
      "cwe": [
        "CWE-400",
        "CWE-1333"
      ],
      "dependency": "ajv",
      "name": "ajv",
      "range": ">=7.0.0-alpha.0 <8.18.0",
      "severity": "moderate",
      "source": 1113715,
      "title": "ajv has ReDoS when using `$data` option",
      "url": "https://github.com/advisories/GHSA-2g4f-4pwh-qvx6"
    }
  ]
}
```

## braces

- Severity: high
- Affected package range: *
- Installed dependency path: `node_modules/braces`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `micromatch`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "GHSA-vfj7-8cjw-p6xm",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-674"
      ],
      "dependency": "braces",
      "name": "braces",
      "range": "<=3.0.3",
      "severity": "high",
      "source": 1240992,
      "title": "braces vulnerable to stack-exhaustion denial of service through deeply nested patterns",
      "url": "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm"
    }
  ],
  "effects": [
    "micromatch"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "braces",
  "nodes": [
    "node_modules/braces"
  ],
  "range": "*",
  "severity": "high",
  "via": [
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-674"
      ],
      "dependency": "braces",
      "name": "braces",
      "range": "<=3.0.3",
      "severity": "high",
      "source": 1240992,
      "title": "braces vulnerable to stack-exhaustion denial of service through deeply nested patterns",
      "url": "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm"
    }
  ]
}
```

## fast-glob

- Severity: high
- Affected package range: *
- Installed dependency path: `node_modules/fast-glob`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@ts-morph/common`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "micromatch"
    }
  ],
  "effects": [
    "@ts-morph/common"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "fast-glob",
  "nodes": [
    "node_modules/fast-glob"
  ],
  "range": "*",
  "severity": "high",
  "via": [
    "micromatch"
  ]
}
```

## js-yaml

- Severity: high
- Affected package range: 4.0.0 - 4.3.1
- Installed dependency path: `node_modules/js-yaml`
- Direct dependency: no
- Fixed-version/remediation proposal: `true`
- Affected dependents: none reported
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "GHSA-h67p-54hq-rp68",
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-407"
      ],
      "dependency": "js-yaml",
      "name": "js-yaml",
      "range": ">=4.0.0 <=4.1.1",
      "severity": "moderate",
      "source": 1121860,
      "title": "JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases",
      "url": "https://github.com/advisories/GHSA-h67p-54hq-rp68"
    },
    {
      "advisory_id": "GHSA-52cp-r559-cp3m",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-407"
      ],
      "dependency": "js-yaml",
      "name": "js-yaml",
      "range": ">=4.0.0 <4.3.0",
      "severity": "high",
      "source": 1123911,
      "title": "js-yaml: YAML merge-key chains can force quadratic CPU consumption",
      "url": "https://github.com/advisories/GHSA-52cp-r559-cp3m"
    },
    {
      "advisory_id": "GHSA-5p4m-2wfm-xmqj",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-407"
      ],
      "dependency": "js-yaml",
      "name": "js-yaml",
      "range": ">=4.0.0 <4.3.1",
      "severity": "high",
      "source": 1138115,
      "title": "JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported",
      "url": "https://github.com/advisories/GHSA-5p4m-2wfm-xmqj"
    },
    {
      "advisory_id": "GHSA-2883-xcg3-v3hh",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-407"
      ],
      "dependency": "js-yaml",
      "name": "js-yaml",
      "range": ">=4.0.0 <4.3.2",
      "severity": "high",
      "source": 1193727,
      "title": "js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources",
      "url": "https://github.com/advisories/GHSA-2883-xcg3-v3hh"
    }
  ],
  "effects": [],
  "fixAvailable": true,
  "isDirect": false,
  "name": "js-yaml",
  "nodes": [
    "node_modules/js-yaml"
  ],
  "range": "4.0.0 - 4.3.1",
  "severity": "high",
  "via": [
    {
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-407"
      ],
      "dependency": "js-yaml",
      "name": "js-yaml",
      "range": ">=4.0.0 <=4.1.1",
      "severity": "moderate",
      "source": 1121860,
      "title": "JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases",
      "url": "https://github.com/advisories/GHSA-h67p-54hq-rp68"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-407"
      ],
      "dependency": "js-yaml",
      "name": "js-yaml",
      "range": ">=4.0.0 <4.3.0",
      "severity": "high",
      "source": 1123911,
      "title": "js-yaml: YAML merge-key chains can force quadratic CPU consumption",
      "url": "https://github.com/advisories/GHSA-52cp-r559-cp3m"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-407"
      ],
      "dependency": "js-yaml",
      "name": "js-yaml",
      "range": ">=4.0.0 <4.3.1",
      "severity": "high",
      "source": 1138115,
      "title": "JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported",
      "url": "https://github.com/advisories/GHSA-5p4m-2wfm-xmqj"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-407"
      ],
      "dependency": "js-yaml",
      "name": "js-yaml",
      "range": ">=4.0.0 <4.3.2",
      "severity": "high",
      "source": 1193727,
      "title": "js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources",
      "url": "https://github.com/advisories/GHSA-2883-xcg3-v3hh"
    }
  ]
}
```

## micromatch

- Severity: high
- Affected package range: >=0.2.0
- Installed dependency path: `node_modules/micromatch`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `fast-glob`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "braces"
    }
  ],
  "effects": [
    "fast-glob"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "micromatch",
  "nodes": [
    "node_modules/micromatch"
  ],
  "range": ">=0.2.0",
  "severity": "high",
  "via": [
    "braces"
  ]
}
```

## minimatch

- Severity: high
- Affected package range: 10.0.0 - 10.2.2
- Installed dependency path: `node_modules/minimatch`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/python-analysis`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "GHSA-3ppc-4f35-3m26",
      "cvss": {
        "score": 0,
        "vectorString": null
      },
      "cwe": [
        "CWE-1333"
      ],
      "dependency": "minimatch",
      "name": "minimatch",
      "range": ">=10.0.0 <10.2.1",
      "severity": "high",
      "source": 1113466,
      "title": "minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern",
      "url": "https://github.com/advisories/GHSA-3ppc-4f35-3m26"
    },
    {
      "advisory_id": "GHSA-7r86-cg39-jmmj",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-407"
      ],
      "dependency": "minimatch",
      "name": "minimatch",
      "range": ">=10.0.0 <10.2.3",
      "severity": "high",
      "source": 1113545,
      "title": "minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments",
      "url": "https://github.com/advisories/GHSA-7r86-cg39-jmmj"
    },
    {
      "advisory_id": "GHSA-23c5-xmqv-rm74",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-1333"
      ],
      "dependency": "minimatch",
      "name": "minimatch",
      "range": ">=10.0.0 <10.2.3",
      "severity": "high",
      "source": 1113553,
      "title": "minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions",
      "url": "https://github.com/advisories/GHSA-23c5-xmqv-rm74"
    }
  ],
  "effects": [
    "@vercel/python-analysis"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "minimatch",
  "nodes": [
    "node_modules/minimatch"
  ],
  "range": "10.0.0 - 10.2.2",
  "severity": "high",
  "via": [
    {
      "cvss": {
        "score": 0,
        "vectorString": null
      },
      "cwe": [
        "CWE-1333"
      ],
      "dependency": "minimatch",
      "name": "minimatch",
      "range": ">=10.0.0 <10.2.1",
      "severity": "high",
      "source": 1113466,
      "title": "minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern",
      "url": "https://github.com/advisories/GHSA-3ppc-4f35-3m26"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-407"
      ],
      "dependency": "minimatch",
      "name": "minimatch",
      "range": ">=10.0.0 <10.2.3",
      "severity": "high",
      "source": 1113545,
      "title": "minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments",
      "url": "https://github.com/advisories/GHSA-7r86-cg39-jmmj"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-1333"
      ],
      "dependency": "minimatch",
      "name": "minimatch",
      "range": ">=10.0.0 <10.2.3",
      "severity": "high",
      "source": 1113553,
      "title": "minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions",
      "url": "https://github.com/advisories/GHSA-23c5-xmqv-rm74"
    }
  ]
}
```

## path-to-regexp

- Severity: high
- Affected package range: 4.0.0 - 6.2.2 || 8.0.0 - 8.3.0
- Installed dependency paths: `node_modules/@vercel/node/node_modules/path-to-regexp`, `node_modules/@vercel/remix-builder/node_modules/path-to-regexp`, `node_modules/path-to-regexp`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/backends`, `@vercel/express`, `@vercel/hono`, `@vercel/node`, `@vercel/remix-builder`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "GHSA-9wv6-86v2-598j",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-1333"
      ],
      "dependency": "path-to-regexp",
      "name": "path-to-regexp",
      "range": ">=4.0.0 <6.3.0",
      "severity": "high",
      "source": 1101846,
      "title": "path-to-regexp outputs backtracking regular expressions",
      "url": "https://github.com/advisories/GHSA-9wv6-86v2-598j"
    },
    {
      "advisory_id": "GHSA-j3q9-mxjg-w52f",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-1333"
      ],
      "dependency": "path-to-regexp",
      "name": "path-to-regexp",
      "range": ">=8.0.0 <8.4.0",
      "severity": "high",
      "source": 1115573,
      "title": "path-to-regexp vulnerable to Denial of Service via sequential optional groups",
      "url": "https://github.com/advisories/GHSA-j3q9-mxjg-w52f"
    },
    {
      "advisory_id": "GHSA-27v5-c462-wpq7",
      "cvss": {
        "score": 5.9,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-1333"
      ],
      "dependency": "path-to-regexp",
      "name": "path-to-regexp",
      "range": ">=8.0.0 <8.4.0",
      "severity": "moderate",
      "source": 1115582,
      "title": "path-to-regexp vulnerable to Regular Expression Denial of Service via multiple wildcards",
      "url": "https://github.com/advisories/GHSA-27v5-c462-wpq7"
    }
  ],
  "effects": [
    "@vercel/backends",
    "@vercel/express",
    "@vercel/hono",
    "@vercel/node",
    "@vercel/remix-builder"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "path-to-regexp",
  "nodes": [
    "node_modules/@vercel/node/node_modules/path-to-regexp",
    "node_modules/@vercel/remix-builder/node_modules/path-to-regexp",
    "node_modules/path-to-regexp"
  ],
  "range": "4.0.0 - 6.2.2 || 8.0.0 - 8.3.0",
  "severity": "high",
  "via": [
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-1333"
      ],
      "dependency": "path-to-regexp",
      "name": "path-to-regexp",
      "range": ">=4.0.0 <6.3.0",
      "severity": "high",
      "source": 1101846,
      "title": "path-to-regexp outputs backtracking regular expressions",
      "url": "https://github.com/advisories/GHSA-9wv6-86v2-598j"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-1333"
      ],
      "dependency": "path-to-regexp",
      "name": "path-to-regexp",
      "range": ">=8.0.0 <8.4.0",
      "severity": "high",
      "source": 1115573,
      "title": "path-to-regexp vulnerable to Denial of Service via sequential optional groups",
      "url": "https://github.com/advisories/GHSA-j3q9-mxjg-w52f"
    },
    {
      "cvss": {
        "score": 5.9,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-1333"
      ],
      "dependency": "path-to-regexp",
      "name": "path-to-regexp",
      "range": ">=8.0.0 <8.4.0",
      "severity": "moderate",
      "source": 1115582,
      "title": "path-to-regexp vulnerable to Regular Expression Denial of Service via multiple wildcards",
      "url": "https://github.com/advisories/GHSA-27v5-c462-wpq7"
    }
  ]
}
```

## smol-toml

- Severity: high
- Affected package range: <=1.8.0
- Installed dependency path: `node_modules/smol-toml`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/rust`, `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "GHSA-v3rj-xjv7-4jmq",
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-674"
      ],
      "dependency": "smol-toml",
      "name": "smol-toml",
      "range": "<1.6.1",
      "severity": "moderate",
      "source": 1115393,
      "title": "smol-toml: Denial of Service via TOML documents containing thousands of consecutive commented lines",
      "url": "https://github.com/advisories/GHSA-v3rj-xjv7-4jmq"
    },
    {
      "advisory_id": "GHSA-7w5x-hrqm-74c2",
      "cvss": {
        "score": 0,
        "vectorString": null
      },
      "cwe": [
        "CWE-606",
        "CWE-835"
      ],
      "dependency": "smol-toml",
      "name": "smol-toml",
      "range": "<=1.7.0",
      "severity": "high",
      "source": 1193945,
      "title": "smol-toml: Denial of Service via malformed TOML documents",
      "url": "https://github.com/advisories/GHSA-7w5x-hrqm-74c2"
    },
    {
      "advisory_id": "GHSA-r4xh-jqrq-34v2",
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-407"
      ],
      "dependency": "smol-toml",
      "name": "smol-toml",
      "range": "<=1.8.0",
      "severity": "moderate",
      "source": 1241205,
      "title": "smol-toml: Quadratic-time parse() from parseKey rescanning to end of document on each key line",
      "url": "https://github.com/advisories/GHSA-r4xh-jqrq-34v2"
    }
  ],
  "effects": [
    "@vercel/rust",
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "smol-toml",
  "nodes": [
    "node_modules/smol-toml"
  ],
  "range": "<=1.8.0",
  "severity": "high",
  "via": [
    {
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-674"
      ],
      "dependency": "smol-toml",
      "name": "smol-toml",
      "range": "<1.6.1",
      "severity": "moderate",
      "source": 1115393,
      "title": "smol-toml: Denial of Service via TOML documents containing thousands of consecutive commented lines",
      "url": "https://github.com/advisories/GHSA-v3rj-xjv7-4jmq"
    },
    {
      "cvss": {
        "score": 0,
        "vectorString": null
      },
      "cwe": [
        "CWE-606",
        "CWE-835"
      ],
      "dependency": "smol-toml",
      "name": "smol-toml",
      "range": "<=1.7.0",
      "severity": "high",
      "source": 1193945,
      "title": "smol-toml: Denial of Service via malformed TOML documents",
      "url": "https://github.com/advisories/GHSA-7w5x-hrqm-74c2"
    },
    {
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-407"
      ],
      "dependency": "smol-toml",
      "name": "smol-toml",
      "range": "<=1.8.0",
      "severity": "moderate",
      "source": 1241205,
      "title": "smol-toml: Quadratic-time parse() from parseKey rescanning to end of document on each key line",
      "url": "https://github.com/advisories/GHSA-r4xh-jqrq-34v2"
    }
  ]
}
```

## tar

- Severity: critical
- Affected package range: <=7.5.20
- Installed dependency path: `node_modules/tar`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/container`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "GHSA-vmf3-w455-68vh",
      "cvss": {
        "score": 0,
        "vectorString": null
      },
      "cwe": [
        "CWE-436"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.15",
      "severity": "moderate",
      "source": 1120782,
      "title": "node-tar applies PAX size override to intermediary GNU long-name/long-link headers, causing tar parser interpretation differential (file smuggling)",
      "url": "https://github.com/advisories/GHSA-vmf3-w455-68vh"
    },
    {
      "advisory_id": "GHSA-w8wr-v893-vjvp",
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-704"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.17",
      "severity": "moderate",
      "source": 1123939,
      "title": "node-tar: Process crash via PAX numeric path type confusion",
      "url": "https://github.com/advisories/GHSA-w8wr-v893-vjvp"
    },
    {
      "advisory_id": "GHSA-23hp-3jrh-7fpw",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-770"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.18",
      "severity": "critical",
      "source": 1123940,
      "title": "node-tar: Decompression/parse DoS via unlimited input",
      "url": "https://github.com/advisories/GHSA-23hp-3jrh-7fpw"
    },
    {
      "advisory_id": "GHSA-8x88-c5mf-7j5w",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-835"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.17",
      "severity": "high",
      "source": 1123941,
      "title": "node-tar: Negative tar entry size causes infinite loop in archive replace",
      "url": "https://github.com/advisories/GHSA-8x88-c5mf-7j5w"
    },
    {
      "advisory_id": "GHSA-gvwx-54wh-qm9j",
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-248"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.16",
      "severity": "moderate",
      "source": 1123942,
      "title": "node-tar: Uncaught Exception DoS via NUL byte in PAX path/linkpath records",
      "url": "https://github.com/advisories/GHSA-gvwx-54wh-qm9j"
    },
    {
      "advisory_id": "GHSA-r292-9mhp-454m",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-674"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.20",
      "severity": "high",
      "source": 1145647,
      "title": "node-tar: Uncontrolled recursion in mapHas/filesFilter allows uncatchable stack-overflow DoS via crafted long-path tar with member selection",
      "url": "https://github.com/advisories/GHSA-r292-9mhp-454m"
    }
  ],
  "effects": [
    "@vercel/container"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "tar",
  "nodes": [
    "node_modules/tar"
  ],
  "range": "<=7.5.20",
  "severity": "critical",
  "via": [
    {
      "cvss": {
        "score": 0,
        "vectorString": null
      },
      "cwe": [
        "CWE-436"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.15",
      "severity": "moderate",
      "source": 1120782,
      "title": "node-tar applies PAX size override to intermediary GNU long-name/long-link headers, causing tar parser interpretation differential (file smuggling)",
      "url": "https://github.com/advisories/GHSA-vmf3-w455-68vh"
    },
    {
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-704"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.17",
      "severity": "moderate",
      "source": 1123939,
      "title": "node-tar: Process crash via PAX numeric path type confusion",
      "url": "https://github.com/advisories/GHSA-w8wr-v893-vjvp"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-770"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.18",
      "severity": "critical",
      "source": 1123940,
      "title": "node-tar: Decompression/parse DoS via unlimited input",
      "url": "https://github.com/advisories/GHSA-23hp-3jrh-7fpw"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-835"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.17",
      "severity": "high",
      "source": 1123941,
      "title": "node-tar: Negative tar entry size causes infinite loop in archive replace",
      "url": "https://github.com/advisories/GHSA-8x88-c5mf-7j5w"
    },
    {
      "cvss": {
        "score": 5.3,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-248"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.16",
      "severity": "moderate",
      "source": 1123942,
      "title": "node-tar: Uncaught Exception DoS via NUL byte in PAX path/linkpath records",
      "url": "https://github.com/advisories/GHSA-gvwx-54wh-qm9j"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-674"
      ],
      "dependency": "tar",
      "name": "tar",
      "range": "<=7.5.20",
      "severity": "high",
      "source": 1145647,
      "title": "node-tar: Uncontrolled recursion in mapHas/filesFilter allows uncatchable stack-overflow DoS via crafted long-path tar with member selection",
      "url": "https://github.com/advisories/GHSA-r292-9mhp-454m"
    }
  ]
}
```

## ts-morph

- Severity: high
- Affected package range: 6.0.1 - 23.0.0 || 25.0.0 - 26.0.0
- Installed dependency path: `node_modules/ts-morph`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/backends`, `@vercel/node`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@ts-morph/common"
    }
  ],
  "effects": [
    "@vercel/backends",
    "@vercel/node"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "ts-morph",
  "nodes": [
    "node_modules/ts-morph"
  ],
  "range": "6.0.1 - 23.0.0 || 25.0.0 - 26.0.0",
  "severity": "high",
  "via": [
    "@ts-morph/common"
  ]
}
```

## undici

- Severity: high
- Affected package range: <=6.28.0
- Installed dependency paths: `node_modules/@vercel/node/node_modules/undici`, `node_modules/undici`
- Direct dependency: no
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: `@vercel/node`, `vercel`
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@fastify/busboy"
    },
    {
      "advisory_id": "GHSA-c76h-2ccp-4975",
      "cvss": {
        "score": 6.8,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N"
      },
      "cwe": [
        "CWE-330"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": ">=4.5.0 <5.28.5",
      "severity": "moderate",
      "source": 1101610,
      "title": "Use of Insufficiently Random Values in undici",
      "url": "https://github.com/advisories/GHSA-c76h-2ccp-4975"
    },
    {
      "advisory_id": "GHSA-g9mf-h72j-4rw9",
      "cvss": {
        "score": 5.9,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-770"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.23.0",
      "severity": "moderate",
      "source": 1112496,
      "title": "Undici has an unbounded decompression chain in HTTP responses on Node.js Fetch API via Content-Encoding leads to resource exhaustion",
      "url": "https://github.com/advisories/GHSA-g9mf-h72j-4rw9"
    },
    {
      "advisory_id": "GHSA-cxrh-j4jr-qwg3",
      "cvss": {
        "score": 3.1,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-401"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<5.29.0",
      "severity": "low",
      "source": 1113069,
      "title": "undici Denial of Service attack via bad certificate data",
      "url": "https://github.com/advisories/GHSA-cxrh-j4jr-qwg3"
    },
    {
      "advisory_id": "GHSA-2mjp-6q6p-2qxm",
      "cvss": {
        "score": 6.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L"
      },
      "cwe": [
        "CWE-444"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.24.0",
      "severity": "moderate",
      "source": 1114594,
      "title": "Undici has an HTTP Request/Response Smuggling issue",
      "url": "https://github.com/advisories/GHSA-2mjp-6q6p-2qxm"
    },
    {
      "advisory_id": "GHSA-vrm6-8vpv-qv8q",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-409"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.24.0",
      "severity": "high",
      "source": 1114638,
      "title": "Undici has Unbounded Memory Consumption in WebSocket permessage-deflate Decompression",
      "url": "https://github.com/advisories/GHSA-vrm6-8vpv-qv8q"
    },
    {
      "advisory_id": "GHSA-v9p9-hfj2-hcw8",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-248"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.24.0",
      "severity": "high",
      "source": 1114640,
      "title": "Undici has Unhandled Exception in WebSocket Client Due to Invalid server_max_window_bits Validation",
      "url": "https://github.com/advisories/GHSA-v9p9-hfj2-hcw8"
    },
    {
      "advisory_id": "GHSA-4992-7rv2-5pvq",
      "cvss": {
        "score": 4.6,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:L/I:L/A:N"
      },
      "cwe": [
        "CWE-93"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.24.0",
      "severity": "moderate",
      "source": 1114642,
      "title": "Undici has CRLF Injection in undici via `upgrade` option",
      "url": "https://github.com/advisories/GHSA-4992-7rv2-5pvq"
    },
    {
      "advisory_id": "GHSA-p88m-4jfj-68fv",
      "cvss": {
        "score": 5.9,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:N"
      },
      "cwe": [
        "CWE-93"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.27.0",
      "severity": "moderate",
      "source": 1121242,
      "title": "undici vulnerable to HTTP header injection via Set-Cookie percent-decoding",
      "url": "https://github.com/advisories/GHSA-p88m-4jfj-68fv"
    },
    {
      "advisory_id": "GHSA-vxpw-j846-p89q",
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-770"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.27.0",
      "severity": "high",
      "source": 1121245,
      "title": "undici WebSocket client vulnerable to denial of service via fragment count bypass",
      "url": "https://github.com/advisories/GHSA-vxpw-j846-p89q"
    },
    {
      "advisory_id": "GHSA-g8m3-5g58-fq7m",
      "cvss": {
        "score": 3.7,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N"
      },
      "cwe": [
        "CWE-183"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.27.0",
      "severity": "low",
      "source": 1121255,
      "title": "undici vulnerable to Set-Cookie SameSite attribute downgrade via permissive substring matching",
      "url": "https://github.com/advisories/GHSA-g8m3-5g58-fq7m"
    },
    {
      "advisory_id": "GHSA-8xcm-r25x-g524",
      "cvss": {
        "score": 4.8,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N"
      },
      "cwe": [
        "CWE-444"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.28.0",
      "severity": "moderate",
      "source": 1130716,
      "title": "undici vulnerable to downstream response desynchronization via retry interceptor",
      "url": "https://github.com/advisories/GHSA-8xcm-r25x-g524"
    },
    {
      "advisory_id": "GHSA-m8rv-5g2x-5cg5",
      "cvss": {
        "score": 4.2,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N"
      },
      "cwe": [
        "CWE-93"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.28.0",
      "severity": "moderate",
      "source": 1130727,
      "title": "undici vulnerable to CRLF Injection via blob-like body 'type' property",
      "url": "https://github.com/advisories/GHSA-m8rv-5g2x-5cg5"
    },
    {
      "advisory_id": "GHSA-v3r7-h72x-cjcm",
      "cvss": {
        "score": 4.8,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N"
      },
      "cwe": [
        "CWE-74"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.28.0",
      "severity": "moderate",
      "source": 1130732,
      "title": "undici vulnerable to cookie attribute injection via unsanitized domain and unparsed setCookie fields",
      "url": "https://github.com/advisories/GHSA-v3r7-h72x-cjcm"
    },
    {
      "advisory_id": "GHSA-35p6-xmwp-9g52",
      "cvss": {
        "score": 3.7,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N"
      },
      "cwe": [
        "CWE-367"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.27.0",
      "severity": "low",
      "source": 1137243,
      "title": "undici vulnerable to HTTP response queue poisoning via keep-alive socket reuse",
      "url": "https://github.com/advisories/GHSA-35p6-xmwp-9g52"
    },
    {
      "advisory_id": "GHSA-r53p-7pc4-xj5r",
      "cvss": {
        "score": 3.7,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N"
      },
      "cwe": [
        "CWE-444"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.28.1",
      "severity": "low",
      "source": 1240039,
      "title": "undici vulnerable to downstream response splitting via retry interceptor",
      "url": "https://github.com/advisories/GHSA-r53p-7pc4-xj5r"
    }
  ],
  "effects": [
    "@vercel/node",
    "vercel"
  ],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": false,
  "name": "undici",
  "nodes": [
    "node_modules/@vercel/node/node_modules/undici",
    "node_modules/undici"
  ],
  "range": "<=6.28.0",
  "severity": "high",
  "via": [
    "@fastify/busboy",
    {
      "cvss": {
        "score": 6.8,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N"
      },
      "cwe": [
        "CWE-330"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": ">=4.5.0 <5.28.5",
      "severity": "moderate",
      "source": 1101610,
      "title": "Use of Insufficiently Random Values in undici",
      "url": "https://github.com/advisories/GHSA-c76h-2ccp-4975"
    },
    {
      "cvss": {
        "score": 5.9,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-770"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.23.0",
      "severity": "moderate",
      "source": 1112496,
      "title": "Undici has an unbounded decompression chain in HTTP responses on Node.js Fetch API via Content-Encoding leads to resource exhaustion",
      "url": "https://github.com/advisories/GHSA-g9mf-h72j-4rw9"
    },
    {
      "cvss": {
        "score": 3.1,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:N/A:L"
      },
      "cwe": [
        "CWE-401"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<5.29.0",
      "severity": "low",
      "source": 1113069,
      "title": "undici Denial of Service attack via bad certificate data",
      "url": "https://github.com/advisories/GHSA-cxrh-j4jr-qwg3"
    },
    {
      "cvss": {
        "score": 6.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L"
      },
      "cwe": [
        "CWE-444"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.24.0",
      "severity": "moderate",
      "source": 1114594,
      "title": "Undici has an HTTP Request/Response Smuggling issue",
      "url": "https://github.com/advisories/GHSA-2mjp-6q6p-2qxm"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-409"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.24.0",
      "severity": "high",
      "source": 1114638,
      "title": "Undici has Unbounded Memory Consumption in WebSocket permessage-deflate Decompression",
      "url": "https://github.com/advisories/GHSA-vrm6-8vpv-qv8q"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-248"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.24.0",
      "severity": "high",
      "source": 1114640,
      "title": "Undici has Unhandled Exception in WebSocket Client Due to Invalid server_max_window_bits Validation",
      "url": "https://github.com/advisories/GHSA-v9p9-hfj2-hcw8"
    },
    {
      "cvss": {
        "score": 4.6,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:L/I:L/A:N"
      },
      "cwe": [
        "CWE-93"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.24.0",
      "severity": "moderate",
      "source": 1114642,
      "title": "Undici has CRLF Injection in undici via `upgrade` option",
      "url": "https://github.com/advisories/GHSA-4992-7rv2-5pvq"
    },
    {
      "cvss": {
        "score": 5.9,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:N"
      },
      "cwe": [
        "CWE-93"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.27.0",
      "severity": "moderate",
      "source": 1121242,
      "title": "undici vulnerable to HTTP header injection via Set-Cookie percent-decoding",
      "url": "https://github.com/advisories/GHSA-p88m-4jfj-68fv"
    },
    {
      "cvss": {
        "score": 7.5,
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
      },
      "cwe": [
        "CWE-400",
        "CWE-770"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.27.0",
      "severity": "high",
      "source": 1121245,
      "title": "undici WebSocket client vulnerable to denial of service via fragment count bypass",
      "url": "https://github.com/advisories/GHSA-vxpw-j846-p89q"
    },
    {
      "cvss": {
        "score": 3.7,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N"
      },
      "cwe": [
        "CWE-183"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.27.0",
      "severity": "low",
      "source": 1121255,
      "title": "undici vulnerable to Set-Cookie SameSite attribute downgrade via permissive substring matching",
      "url": "https://github.com/advisories/GHSA-g8m3-5g58-fq7m"
    },
    {
      "cvss": {
        "score": 4.8,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N"
      },
      "cwe": [
        "CWE-444"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.28.0",
      "severity": "moderate",
      "source": 1130716,
      "title": "undici vulnerable to downstream response desynchronization via retry interceptor",
      "url": "https://github.com/advisories/GHSA-8xcm-r25x-g524"
    },
    {
      "cvss": {
        "score": 4.2,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N"
      },
      "cwe": [
        "CWE-93"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.28.0",
      "severity": "moderate",
      "source": 1130727,
      "title": "undici vulnerable to CRLF Injection via blob-like body 'type' property",
      "url": "https://github.com/advisories/GHSA-m8rv-5g2x-5cg5"
    },
    {
      "cvss": {
        "score": 4.8,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N"
      },
      "cwe": [
        "CWE-74"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.28.0",
      "severity": "moderate",
      "source": 1130732,
      "title": "undici vulnerable to cookie attribute injection via unsanitized domain and unparsed setCookie fields",
      "url": "https://github.com/advisories/GHSA-v3r7-h72x-cjcm"
    },
    {
      "cvss": {
        "score": 3.7,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N"
      },
      "cwe": [
        "CWE-367"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.27.0",
      "severity": "low",
      "source": 1137243,
      "title": "undici vulnerable to HTTP response queue poisoning via keep-alive socket reuse",
      "url": "https://github.com/advisories/GHSA-35p6-xmwp-9g52"
    },
    {
      "cvss": {
        "score": 3.7,
        "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N"
      },
      "cwe": [
        "CWE-444"
      ],
      "dependency": "undici",
      "name": "undici",
      "range": "<6.28.1",
      "severity": "low",
      "source": 1240039,
      "title": "undici vulnerable to downstream response splitting via retry interceptor",
      "url": "https://github.com/advisories/GHSA-r53p-7pc4-xj5r"
    }
  ]
}
```

## vercel

- Severity: high
- Affected package range: 28.12.3 || >=28.17.0
- Installed dependency path: `node_modules/vercel`
- Direct dependency: yes
- Fixed-version/remediation proposal: `{"name":"vercel","version":"54.17.3","isSemVerMajor":true}`
- Affected dependents: none reported
- Advisory IDs and full npm package record:

```json
{
  "advisory_ids": [
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/backends"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/container"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/elysia"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/express"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/fastify"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/h3"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/hono"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/hydrogen"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/koa"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/nestjs"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/node"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/python"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/python-analysis"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/redwood"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/remix-builder"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/rust"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "@vercel/static-build"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "smol-toml"
    },
    {
      "advisory_id": "INHERITED_OR_TRANSITIVE_REFERENCE",
      "dependency": "undici"
    }
  ],
  "effects": [],
  "fixAvailable": {
    "isSemVerMajor": true,
    "name": "vercel",
    "version": "54.17.3"
  },
  "isDirect": true,
  "name": "vercel",
  "nodes": [
    "node_modules/vercel"
  ],
  "range": "28.12.3 || >=28.17.0",
  "severity": "high",
  "via": [
    "@vercel/backends",
    "@vercel/container",
    "@vercel/elysia",
    "@vercel/express",
    "@vercel/fastify",
    "@vercel/h3",
    "@vercel/hono",
    "@vercel/hydrogen",
    "@vercel/koa",
    "@vercel/nestjs",
    "@vercel/node",
    "@vercel/python",
    "@vercel/python-analysis",
    "@vercel/redwood",
    "@vercel/remix-builder",
    "@vercel/rust",
    "@vercel/static-build",
    "smol-toml",
    "undici"
  ]
}
```

