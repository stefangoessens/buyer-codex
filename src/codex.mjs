import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import { ensureDir, nowStamp, run, summarize } from "./utils.mjs";

function formatReferences(issue) {
  const lines = [];

  if (issue.attachments.nodes.length) {
    lines.push("Attachments:");
    for (const attachment of issue.attachments.nodes) {
      lines.push(`- ${attachment.title || attachment.url}: ${attachment.url}`);
    }
  }

  if (issue.documents.nodes.length) {
    lines.push("Documents:");
    for (const document of issue.documents.nodes) {
      lines.push(`- ${document.title || document.url}: ${document.url}`);
    }
  }

  return lines.length ? `${lines.join("\n")}\n\n` : "";
}

export function buildCodexPrompt(issue, config) {
  const references = formatReferences(issue);

  return [
    `Implement Linear issue ${issue.identifier}: ${issue.title}.`,
    "",
    "Rules:",
    `- Work only inside ${config.target.repoPath}.`,
    "- Stay within the issue scope. Do not broaden the change.",
    "- Leave changes in the working tree uncommitted. Do not open or merge a PR.",
    `- Run this validation command before finishing: ${config.target.validationCommand}`,
    "- If you hit missing credentials, missing environment, or ambiguous repo state, stop and explain exactly what blocked you.",
    "",
    `Issue URL: ${issue.url}`,
    issue.parent ? `Parent: ${issue.parent.identifier} - ${issue.parent.title}` : "",
    issue.projectMilestone ? `Milestone: ${issue.projectMilestone.name}` : "",
    issue.labels.nodes.length
      ? `Labels: ${issue.labels.nodes.map((label) => label.name).join(", ")}`
      : "",
    "",
    references,
    "Issue description:",
    issue.description || "(No description provided)",
    "",
    "Finish with:",
    "- a concise summary of the code changes",
    "- validation results",
    "- any remaining blockers or risks",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runCodex(issue, config, branch) {
  const runDir = path.join(
    config.runsDir,
    `${issue.identifier.toLowerCase()}-${Date.now()}`,
  );
  await ensureDir(runDir);

  const promptPath = path.join(runDir, "prompt.md");
  const lastMessagePath = path.join(runDir, "last-message.md");
  const stdoutPath = path.join(runDir, "stdout.log");
  const stderrPath = path.join(runDir, "stderr.log");

  const prompt = buildCodexPrompt(issue, config);
  await writeFile(promptPath, prompt, "utf8");

  const args = [
    "exec",
    "--cd",
    config.target.repoPath,
    "--full-auto",
    "--sandbox",
    config.codex.sandbox,
    "--color",
    "never",
    "--output-last-message",
    lastMessagePath,
    "-",
  ];

  if (config.codex.model) {
    args.splice(1, 0, "--model", config.codex.model);
  }

  const result = await run(config.codex.bin, args, {
    cwd: config.cwd,
    input: prompt,
    allowFailure: true,
  });

  await writeFile(stdoutPath, result.stdout, "utf8");
  await writeFile(stderrPath, result.stderr, "utf8");

  let lastMessage = "";
  try {
    lastMessage = await readFile(lastMessagePath, "utf8");
  } catch {
    lastMessage = "";
  }

  return {
    runDir,
    branch,
    exitCode: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    lastMessage,
    summary: summarize(lastMessage || result.stderr || result.stdout, 600),
    finishedAt: nowStamp(),
  };
}
