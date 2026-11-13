# game-coordinator

Coordination home for three games and three shared kits. Each game and each kit is worked on by long-running AI coding agent sessions, one per role. This repository holds the coordination layout and documents how the pieces fit together. Machine-local state lives in an ignored directory.

[Cross-game policies](docs/game-policies.md) define shared product and development rules and how the game-coordinator communicates changes.

## Projects

| Project           | Repository                                                          | Purpose                                                      |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Archie            | [archies-dog-walks](https://github.com/andornaut/archies-dog-walks) | Game                                                         |
| Chibi             | [chibis-way-home](https://github.com/andornaut/chibis-way-home)     | Game                                                         |
| Ada the Navigator | [ada-the-navigator](https://github.com/andornaut/ada-the-navigator) | Game                                                         |
| art-kit           | [art-kit](https://github.com/andornaut/art-kit)                     | Raster, frame, font and Aseprite export primitives           |
| game-kit          | [game-kit](https://github.com/andornaut/game-kit)                   | Shared TypeScript runtime, input, layout and Phaser adapters |
| delivery-kit      | [delivery-kit](https://github.com/andornaut/delivery-kit)           | Scheduled gate, push, CI watch, deploy and reviews           |

Games consume kits as dev dependencies pinned to GitHub release tarballs.

## Roles

Each role is one agent conversation with a fixed scope.

- **Art, Gameplay and Tech**, per game:
  - Art owns assets and art pipelines.
  - Gameplay owns rules, values, tuning and player strings.
  - Tech owns implementation, integration, approval of exact release packages and the game's runner.
- **art-kit, game-kit and delivery-kit**, one coordinator each. Each owns its kit's source, tests, docs, CI and versioned releases. Kits release only after container checks and green CI on the exact commit.
- **game-coordinator**, one shared role that coordinates and runs the scheduled reviews:
  - triages and routes work between roles;
  - relays decisions to and from the user;
  - sets each game's desired delivery state;
  - reviews health on a schedule;
  - tracks every release through gate, CI and deployment.

Roles talk to each other by name through the agent harness's cross-session messaging. Coordinators delegate substantive work to short-lived worker agents, each in its own Git worktree and branch.

## Delivery

The [development and delivery policy](docs/game-policies.md#development-and-delivery) defines integration and release eligibility; the [approval ledger](docs/approval-ledger.md) tracks acceptance.

1. Art and Gameplay hand Tech an exact branch and commit. Tech reviews it, merges it into the game's local `main` once its tests pass, and deletes the branch. Kits merge their own approved work the same way.
2. Each game uses at most one resident delivery-kit runner. Hourly departures are alphabetical in America/Toronto: Ada the Navigator at :00, Archie at :10 and Chibi at :20. Each game's delivery control enables or pauses its departures.
3. A departure runs the full gate on local `main` HEAD in an isolated container, pushes that exact commit by fast-forward, watches CI for it, and deploys the gated build when CI passes. There is no queue: whatever is on `main` at departure time ships.
4. Failures are fixed forward with a new change on `main`. Failed trees are never retried unchanged, and nothing is reverted.

### Delivery control

game-coordinator sets the desired state using the configured game `ID`, a `STATE` of `enabled` or `paused`, and a non-empty reason:

```bash
npx --no-install delivery-kit control --game ID --state STATE \
  --reason 'TEXT' --requester game-coordinator
npx --no-install delivery-kit status --game ID
```

`var/games/<g>/bus/delivery-control.json` persists desired state separately from the runner's observed state. Tech readiness and blockers remain separate from desired control; enabling delivery does not establish readiness. Status reports desired and observed control, runner identity, drain state and blockers.

Pausing blocks new scheduled and requested departures. Already admitted gates, CI watches and deployments finish, and scheduled reviews continue. Missing or invalid control fails closed until explicitly initialized or repaired.

Before Tech adopts a runner version that requires persistent control, game-coordinator initializes each game's approved desired state with the upgraded CLI. Tech owns runner adoption and replaces the runner only when idle and drained. Check status before and after replacement, preserve existing desired state on later upgrades, and observe the next normal scheduled slot without a manual departure.

Delivery-kit 4 requires explicit `resources.memoryMiB` from 6 through 8192 in every registered game's delivery configuration. Version 3 rejects this field. Coordinate configuration and package adoption while affected residents and the shared route host are idle and drained; validate the complete layout with `check-config` before startup. Preserve controls, routes, singleton ownership and schedules.

## Monitoring

delivery-kit sends `game-coordinator` a scheduled review at :20 and :50 each hour, and sends every bus event (departure, gate failure, push, CI, deploy) as it happens. Both arrive over a channel into the `game-coordinator` conversation. `game-coordinator` records handling with explicit acknowledgements. At each review it does three things:

- surfaces any role's unanswered question to the user;
- asks the owning role to close a job that has made no progress across two reviews;
- routes failures to the owning Tech role.

## Sessions and handoffs

Each role keeps its exact conversation IDs and one shared edit worktree. Native cwd stays at the game root, or game-coordinator for kits and game-coordinator. Shared windows belong in `codex-game` or `claude-game`; each game's `art`, `gameplay` and `tech` windows belong in its own harness-prefixed session. The coordinator windows are `codex-game-coordinator` and `claude-game-coordinator`. Windows are alphabetical. Moving windows preserves processes and does not activate a role.

Delivery-kit resolves each role through its optional harness override, otherwise the registry default. Handoffs select explicit games and any included kit/game-coordinator roles; unselected owners remain unchanged.

### Inspect and resume

Run from game-coordinator, or pass `--root` with its authoritative checkout. Select each role explicitly:

```bash
node scripts/sessions.mjs plan --role game-coordinator --role art-kit
```

- `plan` reports sorted exact-ID slots and local blockers; `check` also exits nonzero for blockers.
- `resume` preserves live panes and resumes only eligible missing/dead slots. Another harness needs `--harness TARGET --held`, asserting caller-verified source HOLD.
- Repeat `--runner-pid PID` to inspect resident socket configuration. `--handoff-marker TEXT` preserves the original marker separately from the bounded role marker.

Local inspection does not prove native project identity, pending-question state, quota or an effective Remote Control connection. The helper never selects ownership, activates work, stops frontends or changes a runner/daemon.

1. Verify native identities, source HOLDs, checkpoints, owned jobs and pending questions. Commit unfinished work to named branches and preserve all independent holds. Keep current checkpoints concise; archive superseded state unchanged in sibling history before removing obsolete receipts.
2. Reuse matching live target panes. Resume missing or verified dead targets by exact ID, without an appended prompt. Verify effective Remote Control separately from launch flags and actual receipt. Select visible authorized trust choices explicitly; a default No or exit choice must not receive blind Enter.
3. Obtain each target's exact marker/role/ID acceptance before selecting its harness. Reconcile matching existing acceptance on retries instead of repeating activation. Delivery acceptance alone is not handling.
4. Apply scoped `delivery-kit harness select` with a fresh expected revision, reconcile compatibility records under locks, then validate configuration and scoped readiness. Keep delivery controls, route and cadence unchanged unless separately authorized. The route host's resident must have the effective target adapter/socket; a fresh CLI probe is not resident proof.
5. Exit held source frontends through their supported idle exit, verify owned MCP cleanup, then record role completion. If game-coordinator moves, keep scheduled review coverage pending until actual receipt at the next genuine review. Preserve runners, their gate containers and unrelated services.

If quota prevents activation, leave explicitly prepared targets idle and keep routing unchanged. A handoff never starts tests, builds or releases merely to move ownership.

## Conventions

- Test suites and harnesses run in isolated containers, with only the project checkout and scratch writable. Preserve per-job CPU, memory and worker caps.
- Tooling runs through a CLI or an imported Node module. Shell is limited to thin build wrappers, and there is no Python.
- Each repository keeps role worktrees in an ignored `.worktrees/` directory. Merged branches and their worktrees are deleted when they land.

## This repository

| Path                                | Committed | Contents                                                                                                                                         |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `README.md`                         | yes       | This overview                                                                                                                                    |
| `config.json`                       | yes       | delivery-kit configuration: games, kits, role names and the review schedule                                                                      |
| `package.json`, `package-lock.json` | yes       | The pinned delivery-kit release                                                                                                                  |
| `node_modules/`                     | no        | The installed delivery-kit                                                                                                                       |
| `.worktrees/`                       | no        | Worktrees for changes to this repository                                                                                                         |
| `var/`                              | no        | Registry (`registry.json`), review route (`route.json`), channel config, per-role checkpoints and each game's runner state (`games/<game>/bus/`) |
| `.claude/`                          | no        | Harness-local files                                                                                                                              |

### Source checks

Run `make check` or `make lint` for ShellCheck, Markdown lint and session lifecycle tests in isolated
stock containers. Dependencies install in the temporary working copy with lifecycle scripts disabled;
no project image is built. CI uses the same stock images and native tools.
`npm run lint` is lint-only; `npm run check` also runs lifecycle tests and requires the same test isolation.
Husky runs ordinary lint-staged on the host with serial native Prettier tasks.
