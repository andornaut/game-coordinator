# Operating the workspace

Use [Workspace setup](setup.md) to initialize the coordinator and register games. See [Architecture](../design/architecture.md) for ownership and state.

## Delivery

The [development and delivery policy](../design/game-policies.md#development-and-delivery) defines integration and release eligibility. The [work lifecycle](../design/game-policies.md#work-lifecycle) records progress, evidence and acceptance.

1. Art and Gameplay hand Tech an exact branch and commit. Tech reviews it and merges it into the game's local `main` once its tests pass. Kit owners integrate their approved work the same way. The integrating owner handles [task branch cleanup](#task-branch-cleanup) as part of landing.
2. Each game uses at most one resident delivery-kit runner. Hourly departures follow the America/Toronto schedule of Ada the Navigator at :00, Archie at :10 and Chibi at :20. The operational owner can submit a user-authorized ad hoc departure to the same runner. Each game's delivery control enables or pauses both kinds of departure.
3. A departure runs the full gate on its captured local `main` commit in an isolated container, pushes that exact commit by fast-forward, watches CI for it, and deploys the gated build when CI passes.
4. Failures are fixed forward with a new change on `main`. Failed trees are never retried unchanged, and nothing is reverted.

### Delivery control

game-coordinator sets the desired state using the configured game `ID`, a `STATE` of `enabled` or `paused`, and a non-empty reason.

```bash
COORDINATOR_ROOT="$(pwd -P)"
DK="$COORDINATOR_ROOT/node_modules/@andornaut/delivery-kit/dist/cli.js"
node "$DK" --root "$COORDINATOR_ROOT" control --game ID --state STATE \
  --reason 'TEXT' --requester game-coordinator
node "$DK" --root "$COORDINATOR_ROOT" status --game ID
```

The operational owner uses the existing runner request command for a user-authorized ad hoc release.

```bash
node "$DK" --root "$COORDINATOR_ROOT" request --game ID --id REQUEST_ID
```

The request captures current `main`. The runner refuses it if `main` changes before departure.

`var/games/<g>/bus/delivery-control.json` persists desired state separately from the runner's observed state. Tech readiness and blockers remain separate from desired control. Status reports desired and observed control, runner identity, drain state and blockers.

Pausing blocks new scheduled and requested departures. Already admitted gates, CI watches and deployments finish, and scheduled reviews continue. Missing or invalid control fails closed until explicitly initialized or repaired.

The current operational owner defined in the [role catalog](../reference/roles.md) performs authorized runner adoption only while the affected residents and the shared route host are idle and drained. Validate the complete layout with `check-config` before startup, check status before and after replacement, preserve controls, routes, singleton ownership and schedules, and observe the next normal scheduled slot.

The games workspace sets `resources.memoryMiB` to `4096` in each game's `delivery-kit.json`. Local container launchers use the same 4 GiB ceiling. See [resource admission](../design/game-policies.md#resource-admission).

## Role messaging

All roles, in Claude and Codex, use the coordination-kit CLI installed in the primary game-coordinator checkout and pass that checkout's absolute root, including from a game or kit worktree. Invoke it as `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root> ...`, never through `npx`. Follow the [communication and recipient guards](../design/game-policies.md#communication).

Use `@andornaut/coordination-kit/build/registry` for registry SDK imports. The `@andornaut/delivery-kit/build/source-identity` import stays in delivery-kit. Each kit's CLI is its `dist/cli.js`.

Every message is committed to the selected coordination store before any native wake. This workspace uses the file authority under `.coordination-kit/coordination/`. `msg send` is the only payload path for role-to-role coordination. Native session messages and channel notifications carry only the wake `N new messages for ROLE: run coordination-kit inbox`.

The writing verbs (`msg send`, `inbox`, `msg done`, `msg retain`) identify the caller by the registry fence: the role whose effective harness binding equals the caller's native conversation ID (`CLAUDE_CODE_SESSION_ID` or `CODEX_THREAD_ID`, or `--native-id ID`). `harness select` rotates the binding. Parents record messages and decisions in their own session. A verified child can use its own binding for the documented linked work verbs. `--worker NAME` is an unverified label.

Use the shared CLI and root prefix shown below with these arguments.

| Operation | Arguments                                                                                        | Result                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Send      | `msg send --to ROLE --body-file FILE [--intent queue\|unblock] [--id UUID] [--link KIND=REF]...` | Store the message, then attempt at most one guarded wake. Pass `--id` when a retry must not duplicate. `--link` takes values such as `work=ck-0017`. |
| Read      | `inbox [--include-body] [--all]`                                                                 | List your undelivered and open messages and record them `delivered`.                                                                                 |
| Close     | `msg done ID [--work WORK_ID] [--superseded-by ID] [--evidence REF]...`                          | Close your own message as `handled`, or `superseded` with `--superseded-by`, in one write.                                                           |
| Retain    | `msg retain ID --reason TEXT --next-boundary TEXT [--owner ROLE]`                                | Keep your own message open with an owner, reason and next boundary. Retain again or close later.                                                     |
| Inspect   | `msg status ID [--include-body]`                                                                 | Read the exact message state and, with a qualified binding, the original body.                                                                       |
| History   | `msg history [--role ROLE] [--since ISO_TIMESTAMP] [--limit N] [--include-body]`                 | Read message events in order. Original bodies use the same visibility rules as exact lookup.                                                         |
| Diagnose  | `harness doctor --role ROLE`                                                                     | Inspect the selected role's harness capabilities, including the Claude channel command and loaded version.                                           |

States are `sent`, `delivered` (the recipient's own `inbox` read), then `handled`, `superseded` or `retained`. Only the recipient delivers, closes or retains its messages. A wake outcome leaves message state unchanged.

Pull your inbox at startup, on a wake and at each safe work boundary. After an ambiguous send, look up the original ID before retrying. A guarded wake leaves the original for the recipient’s next safe pull. Escalate repeated delays by original ID and owner.

Use `harness doctor --role ROLE` to check the route and managed endpoint without sending. Session startup, `codex ready`, diagnostics and wakes use the same managed socket when no override is set. Invalid overrides fail closed. A readiness probe does not establish native question clearance.

Send a note to game-coordinator. In the recipient session, read and close it.

```bash
COORDINATOR_ROOT=/absolute/path/to/game-coordinator
CK="$COORDINATOR_ROOT/node_modules/@andornaut/coordination-kit/dist/cli.js"
node "$CK" --root "$COORDINATOR_ROOT" msg send --to game-coordinator \
  --body-file /absolute/path/to/message.md --link work=ck-0017
node "$CK" --root "$COORDINATOR_ROOT" inbox --include-body
node "$CK" --root "$COORDINATOR_ROOT" msg done ID --work ck-0017
```

## Monitoring

delivery-kit delivers game-coordinator's review once per hour at :30 in America/Toronto and bus events as they happen. The review brief is a stored message from `delivery-kit`, at most one page, with `review show` for detail. At every review, game-coordinator works with owners to drain the whole message backlog, including independent work.

1. Inventory the store's open messages for every registered role, including game Art, Gameplay and Tech, shared coordinators and kits, plus ready handoffs, from the brief, `review show` and `msg history`. Report unavailable question visibility. An idle session can still have a backlog.
2. Work from exact originals and owner dispositions. Prioritize user replies and dependency unblockers, then process independent work. Verify each retained item’s reason, owner and next boundary.
3. Use the existing owner pull or handoff for unread, unconfirmed or ambiguous cases. Send new confirmed unblockers with `msg send --intent unblock`. Existing wake deduplication and recipient guards apply. Reconcile ambiguity before any retry and preserve guarded originals.
4. Surface pending user decisions through their owning session's structured prompt. Preserve unanswered questions, source holds and independent work. Never answer or cancel another owner's question, interrupt or restart its turn, or treat silence as a decision. Route release failures and cross-role dependencies to the role that can resolve them.
5. Escalate items unhandled or repeatedly deferred across two scheduled slots in one packet per owner. Include each exact ID, blocker and next action. Reuse an existing escalation while those facts are unchanged. Ask owners to close finished or stalled jobs after preserving diagnostics. Retain protected live resources and unresolved ownership.
6. Close the review notice in the same pass once its exact dispositions are stored. Carry unresolved work on the underlying original or its verified successor. Use the existing [communication rules](../design/game-policies.md#communication) to close completed handoffs without waiting for their downstream work.
7. Finish each pass with exact counts of messages inspected, handled and superseded, plus unavailable scopes. Report unread messages, delivered messages awaiting disposition and retained messages separately. Identify each remaining item's owner, reason and next boundary. Record new arrivals at safe boundaries so they are included or explicitly retained for the next pass. Claim a fully drained backlog only when no open messages remain and visibility is complete.

Use the existing hourly :30 reviews without adding timers or teams. Preserve handoff and activation guards when communicating with held owners.

## Sessions and handoffs

Each role keeps its exact conversation IDs and one shared edit worktree. Native cwd stays at the game root, or game-coordinator for kits and game-coordinator. Every role's window belongs in `codex-games` or `claude-games`. A game role's window is the first word of the game's `coordination-kit.json` name plus the role (`ada-tech`, `archie-art`, `chibi-gameplay`). Other windows use the role (`art-kit`, `game-coordinator`). Windows are alphabetical. Moving windows preserves processes and does not activate a role.

The coordination-kit registry resolves each role through its optional harness override, otherwise the registry default. Handoffs select explicit games and any included kit or game-coordinator roles. Unselected roles retain their existing owners.

### Inspect and resume

Run from game-coordinator, or pass `--root` with its authoritative checkout. Select each role explicitly.

```bash
node scripts/sessions.mjs plan --role game-coordinator --role art-kit
node scripts/sessions.mjs brief --role game-coordinator
```

- `plan` reports sorted exact-ID slots, catalog and tool checks and local blockers. `check` also exits nonzero for blockers. Optional role tools are reported separately from launch requirements.
- By default, `brief` writes the generated orientation artifact without delivery. Include it once in a new role's initial HOLD request after its registry entry is verified, or in an existing handoff activation packet.
- `brief --dispatch --role ROLE` completes previously unsent startup orientation after exact native identity verification for the live effective owner. It sends the brief with `msg send` under the caller's registry binding, which stores it and wakes the recipient. `--held` remains artifact-only. Do not use it for initial HOLD or handoff activation packets.
- `resume` preserves live panes and resumes only eligible missing/dead slots. A fresh resume briefly waits for the exact launched identity and sends one orientation with `msg send`. On timeout it reports the guarded `brief --dispatch` follow-up. An ambiguous send reports the original ID to inspect before retrying. `--held` suppresses standalone orientation for held preparation, including newly registered roles. Include the artifact once in the HOLD or activation packet. Another harness also needs `--harness TARGET`, asserting caller-verified source HOLD.
- `resume --new` starts Claude slots with `claude --session-id ID`, creating the conversation for a newly registered ID. Later launches resume it. It refuses Codex slots.
- Repeat `--runner-pid PID` to inspect resident socket configuration. `--handoff-marker TEXT` preserves the original marker separately from the bounded role marker.

Local inspection does not prove native project identity, pending-question state, quota or an effective Remote Control connection. The helper never selects ownership, activates work, stops frontends or changes a runner/daemon.

### Verify and complete a handoff

1. Verify native identities, source HOLDs, checkpoints, owned jobs and pending questions. Commit unfinished work to named branches and preserve all independent holds. Keep current checkpoints concise. Archive superseded state unchanged in sibling history before removing obsolete receipts.
2. Reuse matching live target panes. Resume missing or verified dead targets by exact ID, without an appended prompt. Verify effective Remote Control separately from launch flags and actual receipt. Leave directory-trust prompts to the user, including when No or exit is the default.
3. Obtain each target's exact marker/role/ID acceptance before selecting its harness. Reconcile matching existing acceptance on retries instead of repeating activation. Delivery acceptance alone is not handling.
4. Apply scoped `coordination-kit harness select` with a fresh expected registry revision, then validate configuration and scoped readiness. Keep delivery controls, route and cadence unchanged unless separately authorized. Verify that the route host's resident uses the effective target adapter and socket.
5. Exit held source frontends through their supported idle exit, verify owned MCP cleanup, then record role completion. If game-coordinator moves, keep scheduled review coverage pending until actual receipt at the next genuine review. Preserve runners, their gate containers and unrelated services.

If quota prevents activation, leave explicitly prepared targets idle and keep routing unchanged. A handoff never starts tests, builds or releases merely to move ownership.

## Conventions

- Test suites and harnesses run in isolated containers, with only the project checkout and scratch writable. Preserve per-job CPU, memory and worker caps.
- Tooling runs through a CLI or an imported Node module. Shell is limited to thin build wrappers, and there is no Python.
- Each repository keeps role worktrees in an ignored `.worktrees/` directory.

### Task branch cleanup

- Delete a merged local task branch after verifying its current tip is an ancestor of local `main`. Preserve `main` and permanent role branches.
- For rebased or squashed work, use the recorded integration and verify that no unique changes would be lost before deleting the task branch.
- Before removing an attached task worktree, verify that it is clean, its essential evidence has a durable reference, its owner has released it, and no consumer still uses it. Record an owner and reason for any deferred cleanup.
- Check integration against published `main` before deleting a merged GitHub task branch. Preserve protected branches and any branch used by an open pull request.
- Follow the [resource cleanup policy](../design/game-policies.md#resource-cleanup) for abandoned worktrees and branches, evidence retention and recovery archives.

## This repository

| Path                                | Committed | Contents                                                                                                |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `README.md`                         | yes       | Project overview and documentation links                                                                |
| `coordination-kit.json`             | yes       | Workspace configuration for games, kits, shared role names and the review schedule                      |
| `roles.json`                        | yes       | Role catalog source for the generated `docs/reference/roles.md`                                         |
| `docs/`                             | yes       | Workspace guides, shared policy, role catalog, design and work history                                  |
| `scripts/`                          | yes       | The role catalog generator (`role-catalog.mjs`) and the session helper (`sessions.mjs` and its modules) |
| `skills/`                           | yes       | Coordinator-local skills for game creation, handoff, session recovery and status                        |
| `tests/`                            | yes       | Role catalog and session tests. `container/` holds the isolated check wrappers                          |
| `Makefile`                          | yes       | `make check` and `make lint` entry points                                                               |
| `package.json`, `package-lock.json` | yes       | The pinned delivery-kit and coordination-kit releases                                                   |
| `node_modules/`                     | no        | The installed delivery-kit and coordination-kit                                                         |
| `.worktrees/`                       | no        | Worktrees for changes to this repository                                                                |
| `.coordination-kit/`                | no        | Native bindings, review route, live checkpoints and coordination journal.                               |
| `var/`                              | no        | Channel config, historical evidence and each game's runner state (`games/<game>/bus/`).                 |
| `.claude/`                          | no        | Harness-local files and the `skills` link to `skills/`                                                  |
| `.agents/`                          | no        | Harness-local files and the `skills` link to `skills/`                                                  |

See [where state lives](../design/architecture.md#where-state-lives) for runtime state and backup locations.

### Source checks

Run `make check` or `make lint` for ShellCheck, Markdown lint, the role catalog drift check and the
role and session tests in isolated stock containers. Dependencies install in the temporary working
copy with lifecycle scripts disabled. CI uses the same stock images and
native tools. `npm run lint` runs lint. `npm run check` also runs `npm test` and requires the same
test isolation.
Husky runs ordinary lint-staged on the host with serial native Prettier tasks.
