# game-coordinator

Coordination home for three games and four shared kits. Each game and each kit is worked on by long-running AI coding agent sessions, one per role. This repository holds the coordination layout and documents how the pieces fit together. Machine-local state lives in an ignored directory.

[Architecture](docs/architecture.md) explains how the roles, coordination-kit and delivery-kit fit together. [Cross-game policies](docs/game-policies.md) define shared product and development rules and how the game-coordinator communicates changes.

## Projects

| Project           | Repository                                                          | Purpose                                                      |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Archie            | [archies-dog-walks](https://github.com/andornaut/archies-dog-walks) | Game                                                         |
| Chibi             | [chibis-way-home](https://github.com/andornaut/chibis-way-home)     | Game                                                         |
| Ada the Navigator | [ada-the-navigator](https://github.com/andornaut/ada-the-navigator) | Game                                                         |
| art-kit           | [art-kit](https://github.com/andornaut/art-kit)                     | Raster, frame, font and Aseprite export primitives           |
| game-kit          | [game-kit](https://github.com/andornaut/game-kit)                   | Shared TypeScript runtime, input, layout and Phaser adapters |
| delivery-kit      | [delivery-kit](https://github.com/andornaut/delivery-kit)           | Scheduled gate, push, CI watch, deploy and reviews           |
| coordination-kit  | [coordination-kit](https://github.com/andornaut/coordination-kit)   | Role registry, messaging, harness adapters, ledger, protocol |

Games consume kits as dev dependencies pinned to GitHub release tarballs.

## Roles

The generated [role catalog](docs/roles.md) defines scopes, ownership and startup requirements for both harnesses. Its source is `roles.json`; edit that catalog rather than duplicating role descriptions.

The shared [communication contract](docs/game-policies.md#communication) defines role-addressed delivery for Claude and Codex, including kits. Coordinators delegate substantive work to short-lived worker agents, each in its own Git worktree and branch.

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

The current operational owner defined in the [role catalog](docs/roles.md) performs authorized runner adoption only while the affected residents and the shared route host are idle and drained. Validate the complete layout with `check-config` before startup, check status before and after replacement, preserve controls, routes, singleton ownership and schedules, and observe the next normal scheduled slot without a manual departure.

Every registered game's `delivery-kit.json` sets `resources.memoryMiB`, an integer from 6 through 8192.

## Role messaging

All roles, in Claude and Codex, use the coordinator-installed coordination-kit CLI with its absolute root, including from a game or kit worktree. Invoke it as `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root> ...`, never through `npx`. Follow the [communication and recipient guards](docs/game-policies.md#communication).

SDK imports use `@andornaut/coordination-kit/build/registry` and `@andornaut/coordination-kit/build/transport`; `@andornaut/delivery-kit/build/source-identity` stays in delivery-kit. Each kit's CLI is its `dist/cli.js`.

Every message is stored in the coordination store (`coordination.db` in the protocol state root) before anything native happens. `msg send` is the only payload path for role-to-role coordination. Native session messages and channel notifications are wakes only: their fixed text, `N new messages for ROLE: run coordination-kit inbox`, never carries content, and a payload sent natively without a stored original is a policy violation.

The writing verbs (`msg send`, `inbox`, `msg done`, `msg retain`) identify the caller by the registry fence: the role whose effective harness binding equals the caller's native conversation ID (`CLAUDE_CODE_SESSION_ID` or `CODEX_THREAD_ID`, or `--native-id ID`). There are no epochs, claims or enrollment for messages, and `harness select` rotates the binding. Workers write under their parent's binding; `--worker NAME` is an unverified attribution.

Use the shared CLI and root prefix shown below, followed by these arguments:

| Operation | Arguments                                                                                        | Result                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Send      | `msg send --to ROLE --body-file FILE [--intent queue\|unblock] [--id UUID] [--link KIND=REF]...` | Store the message, then attempt at most one guarded wake. Pass `--id` when a retry must not duplicate; `--link` takes values such as `work=ck-0017`. |
| Read      | `inbox [--include-body] [--all]`                                                                 | List your undelivered and open messages and record them `delivered`.                                                                                 |
| Close     | `msg done ID [--work WORK_ID] [--superseded-by ID] [--evidence REF]...`                          | Close your own message as `handled`, or `superseded` with `--superseded-by`, in one write.                                                           |
| Retain    | `msg retain ID --reason TEXT --next-boundary TEXT [--owner ROLE]`                                | Keep your own message open with an owner, reason and next boundary; retain again or close later.                                                     |
| Inspect   | `msg status ID`                                                                                  | Read one message's metadata, without its body.                                                                                                       |
| History   | `msg history [--role ROLE] [--since ISO_TIMESTAMP] [--limit N]`                                  | Read message events in order, without bodies. The store's append-only event chain is the durable record.                                             |
| Diagnose  | `harness doctor --role ROLE`                                                                     | Inspect the selected role's harness capabilities, including the Claude channel command and loaded version.                                           |

States are `sent`, `delivered` (the recipient's own `inbox` read), then `handled`, `superseded` or `retained`. Only the recipient delivers, closes or retains its messages; a wake outcome never changes message state. The legacy `message send`, `dispatch`, `reconcile` and `retire-spool` writes are refused with `store-cutover` once the store is selected; `message status` reads the frozen legacy records.

For example, send a note to game-coordinator, then, as the recipient, read and close it:

```bash
COORDINATOR_ROOT=/absolute/path/to/game-coordinator
CK="$COORDINATOR_ROOT/node_modules/@andornaut/coordination-kit/dist/cli.js"
node "$CK" --root "$COORDINATOR_ROOT" msg send --to game-coordinator \
  --body-file /absolute/path/to/message.md --link work=ck-0017
node "$CK" --root "$COORDINATOR_ROOT" inbox --include-body
node "$CK" --root "$COORDINATOR_ROOT" msg done ID --work ck-0017
```

## Monitoring

delivery-kit delivers game-coordinator's review once per hour at :30 in America/Toronto and bus events as they happen. In store mode the review brief is a stored message from `delivery-kit`, at most one page, with `review show` for detail. At every review, game-coordinator works with owners to drain the whole message backlog, including independent work:

1. Inventory the store's open messages for every registered role, including game Art, Gameplay and Tech, shared coordinators and kits, plus ready handoffs, from the brief, `review show` and `msg history`. Report unavailable question visibility; never infer an empty backlog from an idle session.
2. Ask each recipient to run `inbox` and close every open message with `msg done` or `msg retain`. Only the recipient closes its own messages; a wake proves nothing about delivery or handling. Retained items name an owner, reason and next boundary. Do not skip ordinary independent work after prioritizing user replies and dependency unblockers.
3. Follow up stalled, unconfirmed and failed, ambiguous or guarded wake exceptions from the brief with the owning recipient. Send unblockers with `msg send --intent unblock`; never resend a stored message natively.
4. Surface pending user decisions through their owning session's structured prompt. Preserve unanswered questions, source holds and independent work. Never answer or cancel another owner's question, interrupt or restart its turn, or treat silence as a decision. Route release failures and cross-role dependencies to the role that can resolve them.
5. Escalate any item unhandled or repeatedly deferred across two scheduled slots with its exact ID, owner, blocker and next action. Ask owners to close finished or stalled jobs after preserving diagnostics; retain protected live resources and unresolved ownership.
6. Finish each pass with exact counts of messages inspected, handled, superseded and retained, plus unavailable scopes. Identify each remaining item's owner, reason and next boundary; record new arrivals at safe boundaries so they are included or explicitly retained for the next pass. Claim a fully drained backlog only when no open messages remain and visibility is complete.

Use the existing hourly :30 reviews; add no timers or teams. Preserve handoff and activation guards when communicating with held owners.

## Sessions and handoffs

Each role keeps its exact conversation IDs and one shared edit worktree. Native cwd stays at the game root, or game-coordinator for kits and game-coordinator. Shared windows belong in `codex-game` or `claude-game`; each game's `art`, `gameplay` and `tech` windows belong in its own harness-prefixed session. The coordinator window is `game-coordinator` in either shared session. Windows are alphabetical. Moving windows preserves processes and does not activate a role.

The coordination-kit registry resolves each role through its optional harness override, otherwise the registry default. Handoffs select explicit games and any included kit/game-coordinator roles; unselected owners remain unchanged.

### Inspect and resume

Run from game-coordinator, or pass `--root` with its authoritative checkout. Select each role explicitly:

```bash
node scripts/sessions.mjs plan --role game-coordinator --role art-kit
node scripts/sessions.mjs brief --role game-coordinator
```

- `plan` reports sorted exact-ID slots, catalog/tool checks and local blockers; `check` also exits nonzero for blockers. Optional role tools are reported separately from launch requirements.
- By default, `brief` writes the generated orientation artifact without delivery. Include it once in a new role's initial HOLD request after verified registry enrollment, or in an existing handoff activation packet.
- `brief --dispatch --role ROLE` completes previously unsent startup orientation after exact native identity verification for the live effective owner. It sends the brief with `msg send` under the caller's registry binding, which stores it and wakes the recipient; `--held` remains artifact-only. Do not use it for initial HOLD or handoff activation packets.
- `resume` preserves live panes and resumes only eligible missing/dead slots. A fresh resume sends one idempotent orientation with `msg send` after local identity readback; a wake is not handling or activation. `--held` suppresses standalone orientation for held preparation, including newly enrolled roles; include the artifact once in the HOLD or activation packet. Another harness also needs `--harness TARGET`, asserting caller-verified source HOLD.
- Repeat `--runner-pid PID` to inspect resident socket configuration. `--handoff-marker TEXT` preserves the original marker separately from the bounded role marker.

Local inspection does not prove native project identity, pending-question state, quota or an effective Remote Control connection. The helper never selects ownership, activates work, stops frontends or changes a runner/daemon.

1. Verify native identities, source HOLDs, checkpoints, owned jobs and pending questions. Commit unfinished work to named branches and preserve all independent holds. Keep current checkpoints concise; archive superseded state unchanged in sibling history before removing obsolete receipts.
2. Reuse matching live target panes. Resume missing or verified dead targets by exact ID, without an appended prompt. Verify effective Remote Control separately from launch flags and actual receipt. Select visible authorized trust choices explicitly; a default No or exit choice must not receive blind Enter.
3. Obtain each target's exact marker/role/ID acceptance before selecting its harness. Reconcile matching existing acceptance on retries instead of repeating activation. Delivery acceptance alone is not handling.
4. Apply scoped `coordination-kit harness select` with a fresh expected revision, reconcile compatibility records under locks, then validate configuration and scoped readiness. Keep delivery controls, route and cadence unchanged unless separately authorized. The route host's resident must have the effective target adapter/socket; a fresh CLI probe is not resident proof.
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
| `config.json`                       | yes       | Kit configuration: games, kits, role names and the review schedule                                                                               |
| `roles.json`                        | yes       | Role catalog source for the generated `docs/roles.md`                                                                                            |
| `docs/`                             | yes       | Architecture overview, cross-game policies, the approval ledger contract and the generated role catalog                                          |
| `scripts/`                          | yes       | The role catalog generator (`role-catalog.mjs`) and the session helper (`sessions.mjs` and its modules)                                          |
| `tests/`                            | yes       | Role catalog and session tests; `container/` holds the isolated check wrappers                                                                   |
| `Makefile`                          | yes       | `make check` and `make lint` entry points                                                                                                        |
| `package.json`, `package-lock.json` | yes       | The pinned delivery-kit and coordination-kit releases                                                                                            |
| `node_modules/`                     | no        | The installed delivery-kit and coordination-kit                                                                                                  |
| `.worktrees/`                       | no        | Worktrees for changes to this repository                                                                                                         |
| `var/`                              | no        | Registry (`registry.json`), review route (`route.json`), channel config, per-role checkpoints and each game's runner state (`games/<game>/bus/`) |
| `.claude/`                          | no        | Harness-local files                                                                                                                              |

### Source checks

Run `make check` or `make lint` for ShellCheck, Markdown lint, the role catalog drift check and the
role and session tests in isolated stock containers. Dependencies install in the temporary working
copy with lifecycle scripts disabled; no project image is built. CI uses the same stock images and
native tools. `npm run lint` is lint-only; `npm run check` also runs `npm test` and requires the same
test isolation.
Husky runs ordinary lint-staged on the host with serial native Prettier tasks.
