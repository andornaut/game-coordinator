---
name: game-status
description: Report what is done, in progress, new, outstanding and waiting on the user across the games and kits, or audit every user request's status with evidence. Invoke whenever the user prompts with "game-status" or "status", or asks what's done, what's in progress, what's outstanding, what changed recently, or whether a requested change was implemented, superseded or cancelled.
---

# Game status

Use the coordinator-installed Coordination Kit CLI. Resolve the coordinator checkout from the registry. Run `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root>` followed by the commands below.

## Read

- For general status, run `status --format json` without a date filter. Include all open work. Use `latestEvidenceAt` to select recent activity and completions, defaulting to the last 24 hours.
- For a game, kit or role, add `--scope <registry name>`. For a history-only request with an explicit time window, add `--since <ISO timestamp>` using America/Toronto to resolve local dates.
- For an audit, add `--audit`. Follow the user's scope and time window and list every matching item.
- For a delivery verification check, `--state unverified` selects done items without qualifying delivery evidence.
- For a current status report, read `question list --state pending` and `hold list --state active`. Use registered roles, and the hold's scope where relevant, to match the requested game, kit or role.

The installed [command reference](../../node_modules/@andornaut/coordination-kit/docs/commands.md#status) defines the status JSON fields and evidence rules.

## Report

- Lead with decisions, active holds, and counts of current open work by game or kit. Include pending questions' owners, exact wording, options and where to answer. Distinguish recorded pending questions, proposals awaiting approval and confirmed visible structured prompts. Check role panes read-only for prompt visibility and say when it is unknown.
- Count open work files with status `proposed`, `approved`, `in-progress`, `landed` or `deployed`. A deployed item can still need acceptance or work closure. Name the owner or blocker and preserve the exact delivery evidence.
- Count unmatched imported requests separately. They have `status: requested` and `workFile: null`. Include their owners and evidence limits. A linked import stays with its work item.
- Summarize recent milestones and name what shipped. Mark `deliveryEvidence: assumed` as "done (delivery assumed)" and `deliveryVerified: false` as "done (delivery unverified)".
- For an audit, include each item's ID, title, status and evidence: work file, landing commit, deployed SHA and time where available, or replacement or cancellation. Call out requests without work files.
- Report unavailable sources as unknown. An unavailable read gives no clearance.

This skill is read-only. Report discrepancies without editing work files, reconciling messages, publishing or contacting roles.
