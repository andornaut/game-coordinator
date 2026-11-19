---
name: game-status
description: Report what is done, in progress, new, outstanding and waiting on the user across the games and kits, or audit every user request's status with evidence. Invoke whenever the user prompts with "game-status" or "status", or asks what's done, what's in progress, what's outstanding, what changed recently, or whether a requested change was implemented, superseded or cancelled.
---

# Game status

Answer from the shared bookkeeping, never from memory or session history. The single source is the read-only `coordination-kit status` command run against the game-coordinator root, which derives each item's status from the work files in every registered repository, live protocol state, the commit on `main` that set `status: done` and the delivery record.

## Run it

`C` is `node <game-coordinator root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <game-coordinator root>` (not npx, which adds a process per call), run from that root. Resolve the root from the registry's coordinator checkout, not from the current directory.

Map the prompt to filters, and combine them as needed:

| Prompt                                                   | Arguments                                             |
| -------------------------------------------------------- | ----------------------------------------------------- |
| No qualifier ("status")                                  | `--since <24 hours ago, ISO>`                         |
| A game, kit or role ("status Archie", "game-kit status") | `--scope <registry name>`                             |
| A time ("since Monday", "today", "this week")            | `--since <ISO, America/Toronto>`                      |
| "outstanding", "what's left", "backlog"                  | `--state approved --state requested --state proposed` |
| "in progress", "what's being worked on"                  | `--state in-progress --state landed`                  |
| "done", "what shipped"                                   | `--state done --state deployed`                       |
| "audit", "did my requests get done", a named request     | `--audit` (with `--since` when a period is given)     |
| "unverified"                                             | `--state unverified`                                  |

Read `--format json` for anything you filter or count yourself; use `--format markdown` only as a starting digest. The schema is in the installed `node_modules/@andornaut/coordination-kit/docs/commands.md#status`.

## Report

- Group per game and kit, in this order: Waiting on you, Outstanding, In progress, New, Done. Omit empty groups and repositories with nothing in the window.
- One line per item: ID, title, status, and the one fact that matters (owner or blocker for open items; deployed time for done; replacement ID for superseded).
- Mark `deliveryEvidence: assumed` as "done (delivery assumed)" and `deliveryVerified: false` as "done (unverified)".
- Lead with counts per group. For large windows, list Waiting on you and Outstanding in full and summarize Done by count with the most recent few.
- For `--audit`, list every user-originated item with its status and evidence: work file, landing commit, deployed SHA and time, or the replacement or cancellation. Call out anything requested but not yet a work file.
- Waiting on you also checks role panes for open structured prompts (the command reports pending questions it knows of). Name the owner, the question and where to answer.
- State limits plainly: a repository or protocol source the command reports as unavailable is unknown, never clear.

## Rules

- Read-only. Never edit work files, reconcile, publish or message roles from this skill. If the report exposes a gap (a request with no work file, a stale item, a red delivery), say so and offer the follow-up separately.
- Never infer a status the command did not derive.
