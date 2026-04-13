# buyer-codex runner

This repository contains the Linear-driven Codex automation runner plus the initial Convex project bootstrap for `buyer-codex`.

It does the thing Claude Code's `/loop` gives you for free, but as a real Node process for Codex:

1. Poll Linear
2. Pick the next actionable issue
3. Run `codex exec` in a target repo
4. Validate the change
5. Create or update a PR
6. Fetch `@codex` review artifacts and address blocking findings in a fresh session
7. Auto-merge when possible
8. Mark the issue `Done`
9. Repeat

## Commands

```bash
npm run doctor
npm run pick
npm run once
npm run loop
```

## Setup

1. Copy `.env.example` to `.env`
2. Set `LINEAR_API_KEY`
3. By default the runner targets the current repo. Only set `TARGET_REPO_PATH` if you intentionally want cross-repo automation, and pair it with `ALLOW_CROSS_REPO_TARGET=true`
4. Make sure `codex` and `gh` are installed and authenticated
5. Make sure the Convex deployment in `.env.local` exists for local/backend work

## Notes

- This runner assumes one repo and one issue at a time.
- It refuses to target a different repo unless `ALLOW_CROSS_REPO_TARGET=true` is set explicitly.
- Each issue uses a fresh `codex exec` session. Review-fix rounds use separate fresh sessions too.
- It will refuse to start a new issue if the target repo has a dirty worktree.
- It prefers child issues over umbrella/epic issues.
- It skips issues that look under-specified by PRD quality heuristics.
- It blocks merge on unresolved medium/high/critical Codex review findings by default.
- It stores run logs under `.runs/`.
- Worktrees are rooted in the target repo by default, not in the runner repo.
