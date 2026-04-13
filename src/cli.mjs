#!/usr/bin/env node

import { loadConfig } from "./config.mjs";
import { LinearClient } from "./linear.mjs";
import { runOnce, selectNextIssue } from "./runner.mjs";
import { sleep } from "./utils.mjs";
import { assertCleanRepo, getRepoSlug } from "./github.mjs";

async function runDoctor(config) {
  await assertCleanRepo(config.target.repoPath);
  const slug = config.target.repoSlug || (await getRepoSlug(config.target.repoPath));

  const linear = new LinearClient(config.linear);
  const workflowStates = await linear.listWorkflowStates();
  const selected = await selectNextIssue(config, linear);

  return {
    ok: true,
    repoSlug: slug,
    workflowStates: workflowStates.map((state) => state.name),
    nextIssue: selected?.issue
      ? {
          identifier: selected.issue.identifier,
          title: selected.issue.title,
          state: selected.issue.state.name,
        }
      : null,
  };
}

async function main() {
  const command = process.argv[2] || "once";
  const config = await loadConfig();
  const linear = new LinearClient(config.linear);

  if (command === "doctor") {
    console.log(JSON.stringify(await runDoctor(config), null, 2));
    return;
  }

  if (command === "pick") {
    const selected = await selectNextIssue(config, linear);
    console.log(JSON.stringify(selected, null, 2));
    return;
  }

  if (command === "once") {
    console.log(JSON.stringify(await runOnce(config, linear), null, 2));
    return;
  }

  if (command === "loop") {
    for (;;) {
      const startedAt = new Date().toISOString();
      try {
        const result = await runOnce(config, linear);
        console.log(
          JSON.stringify(
            {
              startedAt,
              finishedAt: new Date().toISOString(),
              result,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        console.error(
          JSON.stringify(
            {
              startedAt,
              finishedAt: new Date().toISOString(),
              error: error.message,
            },
            null,
            2,
          ),
        );
      }

      await sleep(config.polling.intervalMs);
    }
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
