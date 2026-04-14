import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..");
const envFiles = [
  ".env.local",
  ".env",
  "convex/.env.local",
  "convex/.env",
];

for (const relativePath of envFiles) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (existsSync(absolutePath)) {
    process.loadEnvFile(absolutePath);
  }
}

const commandArgs = process.argv.slice(2);
if (commandArgs.length === 0) {
  console.error("Usage: node scripts/convex-env.mjs <convex-subcommand> [...args]");
  process.exit(1);
}

const result = spawnSync("pnpm", ["exec", "convex", ...commandArgs], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
