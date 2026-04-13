# AGENTS.md

## Project Source Of Truth

This repository is tracked in Linear and agents should use the Linear MCP workflow as the primary backlog and execution source of truth.

- Linear project: `buyer-codex`
- Team: `Kindservices` (`KIN`)
- Project URL: https://linear.app/kindservices/project/buyer-codex-506407b8e366

## MCP Workflow

- Use the Linear MCP tools to read and update the `buyer-codex` project rather than treating local files as the task system.
- When you need project context, query the Linear project by name: `buyer-codex`.
- When you need implementation work, prefer leaf issues in `Todo` over epic issues.
- Treat Linear issue descriptions as execution specs. They have been adapted for agentic work and include dependencies, non-goals, delivery expectations, and verification guidance.

## Design Workflow

Design direction is also managed through Linear. For design-related work:

- Follow the design hierarchy documented in the `buyer-codex` Linear issues.
- Use Chrome DevTools MCP for reference capture and comparison.
- Reference sources include PayFit, Hosman, RealAdvisor, and the shadcn preset `b2D0wqNxS`.
- Design implementation should use screenshot-based parity loops against the captured references, not one-pass inspiration work.

## Working Rules

- Do not invent work that conflicts with the active Linear backlog.
- If local code and Linear differ, call out the mismatch and resolve it explicitly.
- If a task is ambiguous, inspect the relevant Linear issue and its parent epic before making assumptions.
