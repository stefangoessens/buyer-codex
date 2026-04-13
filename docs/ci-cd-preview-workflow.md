# CI/CD, Railway Topology, and Promotion Workflow

This repo uses GitHub Actions for quality gates and Railway for the persistent
`staging` and `production` runtime topology.

## Provisioned Railway resources

The `buyer-codex` Railway project was created for this repo on 2026-04-13.

- Project: `buyer-codex` (`272a9136-f8f5-4e84-b954-872880090ece`)
- Persistent environments:
  - `production` (`e57237e8-8bde-41f0-adb6-b884faf61c6f`)
  - `staging` (`c11e8793-e578-447f-adb8-6f84be6407a3`)
- Services:
  - `web` (`2a7307eb-47d8-48b6-b24a-f8dd88064b28`)
  - `extraction` (`f4f9d79a-6d9c-4888-ba25-b95f117c258c`)

## Environment model

`BUYER_CODEX_ENV` is the explicit stage variable shared across deployable
surfaces. Railway metadata still wins when it clearly identifies a preview,
staging, or production deployment.

| Stage | Backing runtime | Persistence | Domain strategy | Promotion rule |
| --- | --- | --- | --- | --- |
| `local` | local shell / `.env.local` | ephemeral | `localhost` | developer-only |
| `preview` | Railway PR environment | ephemeral | Railway-generated preview domain | branch validation before staging |
| `staging` | Railway persistent environment | persistent | stable Railway domain | exact release candidate from preview/manual validation |
| `production` | Railway persistent environment | persistent | stable Railway domain | promote the already-validated staging commit |

### Persistent lower-environment URLs

| Environment | Web | Extraction |
| --- | --- | --- |
| `staging` | `https://web-staging-fb64.up.railway.app` | `https://extraction-staging.up.railway.app` |
| `production` | `https://web-production-1ed63.up.railway.app` | `https://extraction-production-50a9.up.railway.app` |

## Service topology

### Web

- Railway service: `web`
- Config as code: [railway.json](../railway.json)
- Health check: `GET /api/health`
- Restart policy: `ON_FAILURE`, `maxRetries=3`
- Deploy overlap/drain: `30s / 30s`
- Independent deploy trigger boundary:
  - `/src/**`
  - `/public/**`
  - `/convex/**`
  - `/packages/shared/**`
  - root web build/config files tracked in `railway.json`

### Extraction

- Railway service: `extraction`
- Config as code: [services/extraction/railway.json](../services/extraction/railway.json)
- Health check: `GET /health`
- Restart policy: `ON_FAILURE`, `maxRetries=3`
- Deploy overlap/drain: `0s / 20s`
- Independent deploy trigger boundary:
  - `/services/extraction/**`
  - `/python-workers/**`

The extraction service deploys independently from the web service, but its build
context must stay monorepo-aware because runtime imports resolve code from
`python-workers/`. Treat it as an independent Railway service with a shared repo
source, not as an isolated single-folder deploy.

## GitHub Actions contract

- Pull requests to `main` always run `Quality gates`.
- `Preview ready` remains the aggregate PR status for preview verification.
- Preview health checks only run when the corresponding preview URL template
  variables are configured.
- `staging` pushes verify the persistent lower environment after Railway deploys.
- `main` pushes verify production after Railway deploys.

### Required GitHub repository variables

Set these repository variables in `stefangoessens/buyer-codex`:

- `STAGING_WEB_URL=https://web-staging-fb64.up.railway.app`
- `STAGING_EXTRACTION_URL=https://extraction-staging.up.railway.app`
- `PRODUCTION_WEB_URL=https://web-production-1ed63.up.railway.app`
- `PRODUCTION_EXTRACTION_URL=https://extraction-production-50a9.up.railway.app`
- `PRODUCTION_URL=https://web-production-1ed63.up.railway.app`

Optional preview variables:

- `PREVIEW_WEB_URL_TEMPLATE`
- `PREVIEW_EXTRACTION_URL_TEMPLATE`

Use preview templates only after the Railway services are connected to the GitHub
repo and you have confirmed the actual Railway preview URL pattern for this
project. Do not guess the template shape.

## Railway variable contract

Set these service variables per persistent environment:

### Web service

- `BUYER_CODEX_ENV=staging|production`
- `OBSERVABILITY_SERVICE_NAME=buyer-codex-web`
- `NEXT_PUBLIC_APP_URL=<environment web URL>`

### Extraction service

- `BUYER_CODEX_ENV=staging|production`
- `OBSERVABILITY_SERVICE_NAME=buyer-codex-extraction`
- `CORS_ORIGINS=<matching web URL[,additional origins]>`

## Health, restart, and rollback posture

- Health checks are liveness/readiness checks, not deep dependency checks.
- `web` rollback unit: Railway `web` service deployment only.
- `extraction` rollback unit: Railway `extraction` service deployment only.
- Roll back the affected service first; do not redeploy both services unless the
  change touched both boundaries.
- Use Railway rollback or redeploy controls to return the affected service to the
  last known-good deployment.
- Promote commits in order: `preview` or manual branch validation -> `staging` ->
  `production`.
- If staging verification fails, stop promotion. Fix forward or roll the changed
  service back in `staging` before touching `production`.

## Source connection and previews

The Railway project, services, persistent environments, and stable domains are
already provisioned. The remaining external wiring is to connect the GitHub repo
source for each Railway service in the Railway UI:

1. Connect `stefangoessens/buyer-codex` as the source repo for `web`.
2. Connect the same repo as the source for `extraction`.
3. Keep the extraction service monorepo-aware so `python-workers/` is present in
   the deploy context.
4. Enable Railway PR environments once the repo source is connected.
5. After the first preview deploy, record the confirmed preview URL pattern in
   the optional preview repository variables.

## Merge and release flow

1. Open a PR against `main`.
2. Wait for `Quality gates` and, when configured, `Preview ready`.
3. Review the Railway preview environment if the PR spins one up.
4. Merge once validation is green.
5. Promote the exact release-candidate commit to `staging`.
6. Wait for `Staging deploy summary` to pass.
7. Promote the same commit to `main`.
8. Wait for `Production deploy summary` to pass.
9. If Convex runtime changes shipped, run `pnpm --dir convex deploy` after the
   application deploy succeeds.
