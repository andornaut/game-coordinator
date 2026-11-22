---
name: game-status
description: Report every outstanding and in-progress item across the games, kits and coordinator in a short descriptive line, with recent deliveries and decisions. Use for game-status, status, backlog and progress questions, or an audit of user requests and their outcomes.
---

# Game status

Use the coordinator-installed Coordination Kit CLI. Resolve the coordinator checkout from the registry. Run `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root>` followed by the commands below.

## Read

- For general status, run `status --format json` without a date filter. Include all open work regardless of age. Use `latestEvidenceAt` for recent activity and `recentCompletions[].at` for completions, defaulting to the last 24 hours for those summaries. Join completion references to `items` by repository and ID for titles and evidence.
- For a game, kit or role, add `--scope <registry name>`. For a history-only request with an explicit time window, add `--since <ISO timestamp>` using America/Toronto to resolve local dates.
- For an audit, add `--audit`. Follow the user's scope and time window and list every matching item.
- For a delivery verification check, `--state unverified` selects done items without qualifying delivery evidence.
- For a current status report, read `question list --state pending` and `hold list --state active`. Use registered roles, and the hold's scope where relevant, to match the requested game, kit or role.

The installed [command reference](../../node_modules/@andornaut/coordination-kit/docs/commands.md#status) defines the status JSON fields and evidence rules.

## Report

- Lead with decisions, active holds and a compact delivery summary. Include pending questions' owners, exact wording, options and where to answer. Distinguish recorded pending questions, proposals awaiting approval and confirmed visible structured prompts. Check role panes read-only for prompt visibility and say when it is unknown.
- Group the complete outstanding list by game, kit and coordinator, with counts. Within each group show in-progress work, proposed or approved work awaiting execution, and landed or deployed work still awaiting delivery, verification, acceptance or closure. Include every item in these states, even if it is old, blocked, waiting on the user or has a missing work file. Confirm counts against the list.
- Give each item one short line that starts with a plain-language description. Add what remains and the owner or blocker when useful and supported by the evidence. Put optional IDs or evidence links after the description. Keep the item's recorded state clear and name any unavailable evidence.
- List all open unmatched requests in a separate subsection grouped by owner or repository. Describe each from its summary and label it as unlinked. Treat corresponding `requested` items and open `unmatchedRequests` records as the same request, and report a linked import with its work item. State when an imported request lacks enough detail for a useful description.
- Keep the full itemized accounting in the response when it fits. If a response limit requires an attachment, provide the complete list in a linked report and include counts and immediate blockers in chat.
- Summarize recent milestones and name what shipped. Mark `deliveryEvidence: assumed` as "done (delivery assumed)" and `deliveryVerified: false` as "done (delivery unverified)".
- For an audit, include each item's ID, title, status and evidence: work file, landing commit, deployed SHA and time where available, or replacement or cancellation. Call out requests without work files.
- Report unavailable sources as unknown. An unavailable read gives no clearance.

This skill is read-only. Report discrepancies without editing work files, reconciling messages, publishing or contacting roles.
