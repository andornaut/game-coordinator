---
name: game-create
description: Create a new game repository and its permanent Art, Gameplay and Tech sessions within the existing game-coordinator and shared-kit architecture. Use for authorized new-game infrastructure, not recovery (game-sessions) or transfers (game-handoff).
---

# Create a game

Create only the requested infrastructure under the supplied display name. Do not invent gameplay, story, assets, a licence or a publication plan. Creation does not authorize production deployment, credentials or a resident runner. Art and Gameplay may write concise infrastructure and interface docs, not gameplay or production assets.

## Scope

- Read `config.json`, `var/registry.json`, any existing `var/route.json`, the pinned kit docs and [contracts.md](contracts.md) before creating or registering identities. Use schemas and commands from the coordinator-installed releases.
- Create the three roles on the explicitly authorized harness, or the verified current one. Existing games, kits, game-coordinator, holds, questions and cadences stay unchanged. Preserve the existing harness bindings and reuse shared roles. For a different authorized harness, use the installed `coordination-kit harness select` scoped to the new roles.

## Repository

- Check the slug and checkout against local and remote repositories first. Explicit public-repository authorization permits creating one. Use existing authentication. Disable package publication.
- Build a minimal Phaser, TypeScript and Vite starter with current Node pins, strict types, ESLint, Prettier, Markdown lint, Vitest, Husky/lint-staged and CI (check, lint, test, build, attribution) with real check names. Orchestration lives in Node modules or CLIs, with thin shell build wrappers only. Do not copy gameplay, art or unrelated exceptions.
- Games share no code. No sibling-game imports, links or dependencies. Reuse goes through published kits or independent copies. Carry this into the new game's local role instructions and briefs.
- Consume published art-kit, game-kit and delivery-kit release tarballs only. Verify `SHA256SUMS`, `SOURCE_COMMIT`, version, exports and peers, then commit exact URLs and lockfile integrity. Prefer the newest supported version and report incompatibilities. Add smoke tests that assert observable results: a game-kit mechanism the starter uses and an art-kit transform on synthetic data.
- Before version 1.0, saves need no compatibility or migration code. From 1.0, published save schemas need backward compatibility or a migration. The milestone is the game's version, not a kit or tooling version. Carry this into role instructions and briefs. It does not authorize deleting player data.
- Create ignored `.worktrees/art`, `.worktrees/gameplay` and `.worktrees/tech` from `main` on distinct role branches. Native cwd is the game root. Keep instruction files local and uncommitted.

## Identities and frontends

- Verify the installed native creation API, managed daemon and effective Remote Control capability first. Create one project and three root conversations with explicit project/cwd; persist each returned ID before naming or launch. Reconcile ambiguous results against the creation journal before retrying. Never invent an ID or start a daemon without approval.
- Register verified IDs as held under `contracts.md` before helper launch; use `resume --held` to avoid a separate orientation message. Use game-sessions for canonical grouping, exact-ID recovery, trust handling and Remote Control verification; do not duplicate its launch procedure.
- Record the exact infrastructure approval, verified owner bindings and any unresolved worker lineage. After authorized activation, each role runs its own `session start` and records approved work by ID. For initial held orientation, run `node scripts/sessions.mjs brief --role ROLE --held` from game-coordinator for each new role. Include the reported generated artifact once in the initial HOLD request, alongside exact identity, worktree and blockers. The catalog supplies shared role, policy, Art-review and ledger guidance; do not copy it into another startup template. Only actual replies confirm HOLD. Journal and send infrastructure activation once; reuse matching acceptance on continuation instead of repeating it. Preserve independent questions and limits.

## Register and verify

- Apply the registration transaction, paused-control initialization and affected-resident adoption in `contracts.md`. Use the generated role catalog for current source and operational ownership. Never activate a new game or change existing schedules/controls implicitly.
- Prepare deployment configuration and credential names only when requested.
- Verify config, scoped readiness, paused status, hooks, smoke tests and build. Track authorized pushes through exact-commit CI. Tell game-coordinator the added scope and confirm handling; report identities, HOLD/activation evidence, controls and remaining approvals. Scheduled coverage stays pending until a genuine review receipt.
