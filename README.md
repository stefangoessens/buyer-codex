# buyer-codex

Recovered application workspace aligned to the Linear project `buyer-codex`.

This repository now contains the implementation that had been landing in the wrong GitHub repository. The application codebase includes the web app, Convex backend, shared packages, iOS client, and Python services that correspond to `buyer-codex` work in Linear.

## Scope

- GitHub repo and branch/project naming for this repository are `buyer-codex`.
- Linear source of truth is the `buyer-codex` project on the `Kindservices` team.
- Some runtime package names and product-facing strings still use `buyer-codex`; those are application identifiers, not cross-repo routing.

## Quick Start

```bash
pnpm install
pnpm bootstrap
pnpm dev:backend
pnpm dev:web
```

## Repository Layout

```text
.
├── .                         # web app workspace
├── convex/                   # Convex backend workspace
├── ios/BuyerCodex/              # Swift Package / SwiftUI app workspace
├── packages/shared/          # shared contracts and TS utilities
├── python-workers/           # reusable Python worker library
└── services/extraction/      # deployable FastAPI extraction worker
```

## Local Commands

```bash
pnpm dev:web
pnpm dev:backend
pnpm build:web
pnpm build:backend
pnpm typecheck:shared
pnpm ios:open
pnpm build:ios
pnpm ios:test
pnpm workers:lib:test
pnpm workers:service:dev
pnpm workers:service:test
pnpm workers:test
```

## Working Rules

- Use [`AGENTS.md`](./AGENTS.md) for project workflow and Linear operating rules.
- Use Linear issue descriptions as the execution spec for recovered work.
- CI/CD and preview workflow details live in [docs/ci-cd-preview-workflow.md](./docs/ci-cd-preview-workflow.md).

## Strategy And Compliance Artifacts

- [KIN-962 - Convex Auth Viability](./docs/adr/KIN-962-convex-auth-viability.md)
- [KIN-963 - Florida Compliance Matrix](./docs/adr/KIN-963-florida-compliance-matrix.md)
