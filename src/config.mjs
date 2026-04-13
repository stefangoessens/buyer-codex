import path from "node:path";
import { readFile, realpath } from "node:fs/promises";

import { ensureDir, fileExists, parseBool, parseCsv } from "./utils.mjs";

async function loadDotEnv(dotEnvPath) {
  if (!(await fileExists(dotEnvPath))) {
    return;
  }

  const raw = await readFile(dotEnvPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function resolveRepoPath(cwd) {
  const configuredRepoPath = process.env.TARGET_REPO_PATH;
  const repoPath = path.resolve(configuredRepoPath || cwd);
  const resolvedCwd = await realpath(cwd);
  const resolvedRepoPath = await realpath(repoPath).catch(() => repoPath);
  const allowCrossRepoTarget = parseBool(process.env.ALLOW_CROSS_REPO_TARGET, false);

  if (!allowCrossRepoTarget && resolvedRepoPath !== resolvedCwd) {
    throw new Error(
      [
        "Refusing to target a different repo from the current workspace.",
        `cwd=${resolvedCwd}`,
        `TARGET_REPO_PATH=${resolvedRepoPath}`,
        "If cross-repo automation is intentional, set ALLOW_CROSS_REPO_TARGET=true.",
      ].join("\n"),
    );
  }

  return resolvedRepoPath;
}

export async function loadConfig(cwd = process.cwd()) {
  const dotEnvPath = path.join(cwd, ".env");
  await loadDotEnv(dotEnvPath);

  const repoPath = await resolveRepoPath(cwd);
  const runsDir = path.join(cwd, ".runs");
  await ensureDir(runsDir);

  return {
    cwd,
    runsDir,
    linear: {
      apiKey: required("LINEAR_API_KEY"),
      projectName: process.env.LINEAR_PROJECT_NAME || "buyer-codex",
      teamKey: process.env.LINEAR_TEAM_KEY || "KIN",
      activeStates: parseCsv(
        process.env.LINEAR_ACTIVE_STATES,
        ["Merging", "Rework", "In Progress", "Todo", "Backlog"],
      ),
      skipStates: parseCsv(process.env.LINEAR_SKIP_STATES, []),
      minPrdChars: Number(process.env.MIN_PRD_CHARS || 300),
      strictMilestoneOrder: parseBool(process.env.STRICT_MILESTONE_ORDER, false),
      milestoneOrder: parseCsv(process.env.MILESTONE_ORDER, []),
      excludeLabels: parseCsv(process.env.LINEAR_EXCLUDE_LABELS, ["planning", "epic"]),
      excludeTitleKeywords: parseCsv(
        process.env.LINEAR_EXCLUDE_TITLE_KEYWORDS,
        ["spike", "define", "document", "author", "harvest", "matrix", "runbook", "taxonomy"],
      ),
      deferTitleKeywords: parseCsv(
        process.env.LINEAR_DEFER_TITLE_KEYWORDS,
        ["provision railway", "deploy topology", "railway services"],
      ),
      botCommentMarker:
        process.env.BOT_COMMENT_MARKER || "buyer-codex-runner",
    },
    target: {
      repoPath,
      repoSlug: process.env.TARGET_REPO_SLUG || "",
      baseBranch: process.env.TARGET_BASE_BRANCH || "main",
      branchPrefix: process.env.BRANCH_PREFIX || "buyer-codex",
      maxConcurrent: Number(process.env.MAX_CONCURRENT || 1),
      validationCommand:
        process.env.VALIDATION_COMMAND || "pnpm build && pnpm typecheck && pnpm test",
      worktreesRoot:
        process.env.WORKTREES_ROOT || path.join(repoPath, ".worktrees"),
    },
    codex: {
      bin: process.env.CODEX_BIN || "codex",
      model: process.env.CODEX_MODEL || "",
      sandbox: process.env.CODEX_SANDBOX || "workspace-write",
      maxValidationFixRounds: Number(process.env.MAX_VALIDATION_FIX_ROUNDS || 2),
    },
    github: {
      autoMerge: parseBool(process.env.AUTO_MERGE, true),
      mergeMethod: process.env.MERGE_METHOD || "squash",
      prLabels: parseCsv(process.env.PR_LABELS, []),
      reviewerLogins: parseCsv(process.env.REVIEWER_LOGINS, ["codex", "codex[bot]"]),
      maxReviewFixRounds: Number(process.env.MAX_REVIEW_FIX_ROUNDS || 3),
      blockingReviewSeverities: parseCsv(
        process.env.BLOCKING_REVIEW_SEVERITIES,
        ["critical", "high", "medium"],
      ),
    },
    polling: {
      intervalMs: Number(process.env.POLL_INTERVAL_MS || 300000),
    },
  };
}
