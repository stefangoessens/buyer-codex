import path from "node:path";

import { runCodex } from "./codex.mjs";
import {
  assertCleanRepo,
  checkoutIssueBranch,
  commitAll,
  createPr,
  enableAutoMerge,
  findPrByBranch,
  getRepoSlug,
  hasChanges,
  pushBranch,
  summarizePrStatus,
  syncBaseBranch,
  viewPr,
} from "./github.mjs";
import { nowStamp, slugify, summarize } from "./utils.mjs";

function labelNames(issue) {
  return issue.labels.nodes.map((label) => label.name);
}

function stateRank(issue, config) {
  const index = config.linear.activeStates.indexOf(issue.state.name);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function priorityRank(issue) {
  const value = Number(issue.priority || 4);
  return Number.isFinite(value) ? value : 4;
}

function milestoneRank(issue, config) {
  if (!issue.projectMilestone || !config.linear.milestoneOrder.length) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = config.linear.milestoneOrder.indexOf(issue.projectMilestone.name);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function looksLikePrdReady(issue, config) {
  const description = issue.description || "";
  if (description.length >= config.linear.minPrdChars) {
    return true;
  }
  return /acceptance criteria|engineering scope|delivery contract/i.test(description);
}

function isUmbrella(issue, activeParentIds) {
  return labelNames(issue).includes("epic") || activeParentIds.has(issue.id);
}

function unresolvedBlockers(issue) {
  return issue.inverseRelations.nodes.filter(
    (relation) =>
      relation.type === "blocks" &&
      !["completed", "canceled"].includes(relation.issue.state.type),
  );
}

function shouldRespectMilestoneGate(config) {
  return config.linear.strictMilestoneOrder && config.linear.milestoneOrder.length > 0;
}

function buildMilestoneGate(issues, config) {
  if (!shouldRespectMilestoneGate(config)) {
    return null;
  }

  const urgentOrHigh = issues.filter((issue) => priorityRank(issue) <= 2);
  const ranks = urgentOrHigh
    .map((issue) => milestoneRank(issue, config))
    .filter((rank) => rank !== Number.MAX_SAFE_INTEGER);

  if (!ranks.length) {
    return null;
  }

  return Math.min(...ranks);
}

function branchNameForIssue(issue, config) {
  const slug = slugify(issue.title, 48);
  return `${config.target.branchPrefix}/${issue.identifier.toLowerCase()}-${slug}`;
}

function botCommentBody(config, metadata) {
  return [
    `<!-- ${config.linear.botCommentMarker} -->`,
    "```json",
    JSON.stringify(metadata, null, 2),
    "```",
  ].join("\n");
}

function prBody(issue) {
  return [
    `Resolves ${issue.identifier}`,
    "",
    `Linear: ${issue.url}`,
    "",
    "## Summary",
    `- ${issue.title}`,
    "",
    "## Notes",
    "- Created by buyer-codex-runner",
  ].join("\n");
}

async function updateIssueBotComment(linear, issue, config, metadata) {
  const freshIssue = await linear.getIssue(issue.id);
  return linear.upsertBotComment(
    freshIssue,
    config.linear.botCommentMarker,
    botCommentBody(config, metadata),
  );
}

export async function selectNextIssue(config, linear) {
  const issues = await linear.listCandidateIssues();
  const activeParentIds = new Set(
    issues
      .filter((issue) => issue.parent?.id)
      .map((issue) => issue.parent.id),
  );

  const milestoneGate = buildMilestoneGate(issues, config);

  const filtered = issues.filter((issue) => {
    if (config.linear.skipStates.includes(issue.state.name)) {
      return false;
    }
    if (!looksLikePrdReady(issue, config)) {
      return false;
    }
    if (isUmbrella(issue, activeParentIds)) {
      return false;
    }
    if (
      milestoneGate !== null &&
      milestoneRank(issue, config) !== Number.MAX_SAFE_INTEGER &&
      milestoneRank(issue, config) > milestoneGate
    ) {
      return false;
    }
    return true;
  });

  filtered.sort((left, right) => {
    return (
      stateRank(left, config) - stateRank(right, config) ||
      priorityRank(left) - priorityRank(right) ||
      milestoneRank(left, config) - milestoneRank(right, config) ||
      new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
    );
  });

  for (const candidate of filtered) {
    const detailed = await linear.getIssue(candidate.id);
    const blockers = unresolvedBlockers(detailed);
    if (!blockers.length) {
      return {
        issue: detailed,
        blockers: [],
      };
    }
  }

  return null;
}

async function ensureRepoSlug(config) {
  if (!config.target.repoSlug) {
    config.target.repoSlug = await getRepoSlug(config.target.repoPath);
  }
  return config.target.repoSlug;
}

async function runValidation(config) {
  const { run } = await import("./utils.mjs");
  return run("zsh", ["-lc", config.target.validationCommand], {
    cwd: config.target.repoPath,
    allowFailure: true,
  });
}

async function transitionIssue(linear, issue, statesByName, nextStateName) {
  const state = statesByName.get(nextStateName);
  if (!state) {
    throw new Error(`Missing Linear state: ${nextStateName}`);
  }
  return linear.updateIssueState(issue.id, state.id);
}

export async function runImplementationCycle(config, linear, issue, statesByName) {
  await assertCleanRepo(config.target.repoPath);
  await syncBaseBranch(config.target.repoPath, config.target.baseBranch);

  const branch = branchNameForIssue(issue, config);
  await checkoutIssueBranch(config.target.repoPath, branch, config.target.baseBranch);

  if (issue.state.name === "Todo") {
    await transitionIssue(linear, issue, statesByName, "In Progress");
  }

  await updateIssueBotComment(linear, issue, config, {
    status: "implementing",
    branch,
    updatedAt: nowStamp(),
  });

  const codexRun = await runCodex(issue, config, branch);

  if (!(await hasChanges(config.target.repoPath))) {
    await transitionIssue(linear, issue, statesByName, "Rework");
    await updateIssueBotComment(linear, issue, config, {
      status: "rework",
      branch,
      updatedAt: nowStamp(),
      reason: "Codex finished without producing a diff.",
      codexSummary: codexRun.summary,
      runDir: codexRun.runDir,
    });
    return {
      action: "rework",
      issue: issue.identifier,
      reason: "no diff",
    };
  }

  const validation = await runValidation(config);
  const validationPassed = validation.code === 0;

  const commitMessage = validationPassed
    ? `${issue.identifier}: ${issue.title}`
    : `WIP: ${issue.identifier} validation failed`;

  await commitAll(config.target.repoPath, commitMessage);
  await pushBranch(config.target.repoPath, branch);

  if (!validationPassed) {
    await transitionIssue(linear, issue, statesByName, "Rework");
    await updateIssueBotComment(linear, issue, config, {
      status: "rework",
      branch,
      updatedAt: nowStamp(),
      reason: "Validation failed after Codex implementation.",
      codexSummary: codexRun.summary,
      validation: summarize(validation.stderr || validation.stdout, 1200),
      runDir: codexRun.runDir,
    });

    return {
      action: "rework",
      issue: issue.identifier,
      reason: "validation failed",
    };
  }

  let pr = await findPrByBranch(config.target.repoPath, branch);
  if (!pr) {
    pr = await createPr(config.target.repoPath, {
      title: `[${issue.identifier}] ${issue.title}`,
      body: prBody(issue),
      baseBranch: config.target.baseBranch,
      branch,
      labels: config.github.prLabels,
    });
  }

  await transitionIssue(linear, issue, statesByName, "Merging");

  if (config.github.autoMerge && pr) {
    await enableAutoMerge(config.target.repoPath, pr.number, config.github.mergeMethod);
  }

  await updateIssueBotComment(linear, issue, config, {
    status: "merging",
    branch,
    prNumber: pr?.number || null,
    prUrl: pr?.url || null,
    updatedAt: nowStamp(),
    codexSummary: codexRun.summary,
    runDir: codexRun.runDir,
  });

  return {
    action: "merging",
    issue: issue.identifier,
    branch,
    prNumber: pr?.number || null,
    prUrl: pr?.url || null,
  };
}

export async function runMergeCycle(config, linear, issue, statesByName) {
  const branch = branchNameForIssue(issue, config);
  const pr = await findPrByBranch(config.target.repoPath, branch);

  if (!pr) {
    await transitionIssue(linear, issue, statesByName, "Rework");
    await updateIssueBotComment(linear, issue, config, {
      status: "rework",
      branch,
      updatedAt: nowStamp(),
      reason: "Issue is in Merging but no PR was found for the expected branch.",
    });
    return {
      action: "rework",
      issue: issue.identifier,
      reason: "missing PR",
    };
  }

  const fullPr = await viewPr(config.target.repoPath, pr.number);

  if (fullPr.state === "MERGED") {
    await transitionIssue(linear, issue, statesByName, "Done");
    await updateIssueBotComment(linear, issue, config, {
      status: "done",
      branch,
      prNumber: fullPr.number,
      prUrl: fullPr.url,
      updatedAt: nowStamp(),
    });
    return {
      action: "done",
      issue: issue.identifier,
      prNumber: fullPr.number,
    };
  }

  if (config.github.autoMerge) {
    await enableAutoMerge(config.target.repoPath, fullPr.number, config.github.mergeMethod);
  }

  await updateIssueBotComment(linear, issue, config, {
    status: "merging",
    branch,
    prNumber: fullPr.number,
    prUrl: fullPr.url,
    updatedAt: nowStamp(),
    prStatus: summarizePrStatus(fullPr),
  });

  return {
    action: "waiting-for-merge",
    issue: issue.identifier,
    prNumber: fullPr.number,
    prUrl: fullPr.url,
  };
}

export async function runOnce(config, linear) {
  await ensureRepoSlug(config);

  const states = await linear.listWorkflowStates();
  const statesByName = new Map(states.map((state) => [state.name, state]));

  const selected = await selectNextIssue(config, linear);
  if (!selected) {
    return {
      action: "idle",
      reason: "No unblocked PRD-ready issues found.",
    };
  }

  const { issue } = selected;

  if (issue.state.name === "Merging") {
    return runMergeCycle(config, linear, issue, statesByName);
  }

  return runImplementationCycle(config, linear, issue, statesByName);
}
