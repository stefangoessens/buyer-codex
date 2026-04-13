import path from "node:path";
import { tmpdir } from "node:os";
import { writeFile } from "node:fs/promises";

import { run, summarize } from "./utils.mjs";

function repoRun(repoPath, command, args, options = {}) {
  return run(command, args, { cwd: repoPath, ...options });
}

export async function gitStatusPorcelain(repoPath) {
  const result = await repoRun(repoPath, "git", ["status", "--porcelain"]);
  return result.stdout.trim();
}

export async function assertCleanRepo(repoPath) {
  const status = await gitStatusPorcelain(repoPath);
  if (status) {
    throw new Error(`Target repo is dirty:\n${status}`);
  }
}

export async function syncBaseBranch(repoPath, baseBranch) {
  await repoRun(repoPath, "git", ["fetch", "origin", baseBranch]);
  await repoRun(repoPath, "git", ["checkout", baseBranch]);
  await repoRun(repoPath, "git", ["pull", "--rebase", "origin", baseBranch]);
}

export async function remoteBranchExists(repoPath, branch) {
  const result = await repoRun(
    repoPath,
    "git",
    ["ls-remote", "--heads", "origin", branch],
    { allowFailure: true },
  );
  return Boolean(result.stdout.trim());
}

export async function checkoutIssueBranch(repoPath, branch, baseBranch) {
  if (await remoteBranchExists(repoPath, branch)) {
    await repoRun(repoPath, "git", ["checkout", branch]);
    await repoRun(repoPath, "git", ["pull", "--rebase", "origin", branch], {
      allowFailure: true,
    });
    return;
  }

  await repoRun(repoPath, "git", ["checkout", "-B", branch, `origin/${baseBranch}`]);
}

export async function hasChanges(repoPath) {
  return Boolean(await gitStatusPorcelain(repoPath));
}

export async function commitAll(repoPath, message) {
  await repoRun(repoPath, "git", ["add", "-A"]);
  const status = await hasChanges(repoPath);
  if (!status) {
    return false;
  }
  await repoRun(repoPath, "git", ["commit", "-m", message]);
  return true;
}

export async function pushBranch(repoPath, branch) {
  await repoRun(repoPath, "git", ["push", "-u", "origin", branch]);
}

export async function getRepoSlug(repoPath) {
  const result = await repoRun(repoPath, "git", ["remote", "get-url", "origin"]);
  const remote = result.stdout.trim();

  const match =
    remote.match(/github\.com[:/](.+?)(?:\.git)?$/) ||
    remote.match(/^git@github\.com:(.+?)(?:\.git)?$/);

  if (!match) {
    throw new Error(`Unable to parse GitHub repo slug from remote: ${remote}`);
  }

  return match[1];
}

export async function findPrByBranch(repoPath, branch) {
  const result = await repoRun(repoPath, "gh", [
    "pr",
    "list",
    "--head",
    branch,
    "--state",
    "all",
    "--limit",
    "1",
    "--json",
    "number,url,state,isDraft,mergeStateStatus,headRefName",
  ]);

  const prs = JSON.parse(result.stdout);
  return prs[0] || null;
}

export async function createPr(repoPath, { title, body, baseBranch, branch, labels }) {
  const bodyFile = path.join(tmpdir(), `buyer-codex-pr-${Date.now()}.md`);
  await writeFile(bodyFile, body, "utf8");

  const args = [
    "pr",
    "create",
    "--base",
    baseBranch,
    "--head",
    branch,
    "--title",
    title,
    "--body-file",
    bodyFile,
  ];

  for (const label of labels) {
    args.push("--label", label);
  }

  await repoRun(repoPath, "gh", args);
  return findPrByBranch(repoPath, branch);
}

export async function viewPr(repoPath, prNumber) {
  const result = await repoRun(repoPath, "gh", [
    "pr",
    "view",
    String(prNumber),
    "--json",
    "number,url,state,isDraft,mergeStateStatus,headRefName,statusCheckRollup",
  ]);

  return JSON.parse(result.stdout);
}

export async function enableAutoMerge(repoPath, prNumber, mergeMethod) {
  const result = await repoRun(
    repoPath,
    "gh",
    ["pr", "merge", String(prNumber), `--${mergeMethod}`, "--auto", "--delete-branch"],
    { allowFailure: true },
  );

  return {
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function summarizePrStatus(pr) {
  return summarize(
    JSON.stringify({
      number: pr.number,
      state: pr.state,
      mergeStateStatus: pr.mergeStateStatus,
      isDraft: pr.isDraft,
    }),
    240,
  );
}
