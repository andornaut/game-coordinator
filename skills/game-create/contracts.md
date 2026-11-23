# Creation contracts

Read the installed Coordination Kit registry and Delivery Kit configuration definitions before mutation. Verify configuration, registry, control and route schema versions against the installed release. Package major and JSON schema numbers differ. Resolve each role through its optional harness override, otherwise the global default. Use scoped `harness select` only after all affected readers support that contract. Never invent fields, switch unselected owners or infer activation from registration. Shared-role transfers require explicit authority; game-handoff owns that procedure.

## Coordination store

Check the selected authority with the installed `coordination-kit store migration-status`. Game
registration uses the existing authority. After scope and activation are verified, each owner runs
`session start` in its bound conversation and records approved work using the installed store
commands. Preserve questions, holds and unresolved worker lineage under their owning role. Use
the [workspace setup runbook](../../docs/setup.md#select-the-store-authority) for fresh authority
setup.

## Native identity transaction

Use game-sessions runtime/native preflight. The transaction below describes Codex; for Claude, first verify an equivalent supported creation adapter. Missing capability blocks creation rather than authorizing another daemon.

1. Persist a creation journal under ignored game-coordinator `var/` with slug, normalized game root, display name, authorization, a stable project idempotency key, role worktrees and per-step states. Write temp file, fsync, rename and fsync its directory for each transition.
2. Reconcile journaled project IDs through `project/read` and paginated `project/list`. `project/create` accepts `idempotencyKey`, `name` and `roots: [{path: absoluteGameRoot}]`; reuse the same key after an ambiguous response. Persist `response.project.id` before the next mutation. Reject conflicting roots or multiple candidates.
3. For each role, persist creation intent and a native listing baseline. `thread/start` must specify `projectId`, `cwd: absoluteGameRoot` and `ephemeral: false`, creating a root conversation rather than a spawned worker. Persist `response.thread.id` immediately, before `thread/name/set` or another start. Read back project association, cwd and parentage through supported metadata APIs. Store role-to-ID mapping in the journal.
4. Thread creation has no assumed idempotency key. If its response is lost, mark it ambiguous; reconcile paginated `thread/list` (explicit project/cwd) and `thread/read` against the baseline and recorded intent. Verify visibility of empty persistent threads through supported metadata before treating a listing as complete. Adopt only an unambiguously identified root thread. Incomplete visibility or multiple candidates require parent/user reconciliation. Never blindly retry or silently archive a possible duplicate.
5. Register returned IDs as held through the transaction below before using game-sessions frontend recovery. Keep native creation, held registration and infrastructure activation distinct.

## Coordinated registration

Use installed validators and writers. Treat the registry as the role identity source, preserve unknown fields and keep the verified native project identity in the creation journal.

- `config.json`: schema 1; append `games.<slug> = {name: displayName, path: relativeGameRoot, roles: ["art", "gameplay", "tech"]}`. Preserve `timezone`, `wakeMinutes`, `kits` and `sharedRoles`.
- `var/registry.json`: schema 1; preserve `harness`, `host`, existing conversations, holds, transfers and delivery-owned `operations.*.lastAdoption`. Append `<slug>/<role>` records with `ownership: "held"`, `phase: "held"`, relative `.worktrees/<role>` paths and the actual returned ID under its supported `conversations.codex` or `conversations.claude` mapping; preserve an existing other-harness ID or use null when absent. This mapping does not select an active harness. Select the new held roles' authorized harness with scoped `harness select` before frontend planning; selection does not activate work or switch remaining owners. Append `operations.<slug>.busOwner = "<slug>/tech"`. Never fabricate transfer or activation evidence.
- `var/route.json`: schema 2 with exactly `schema`, `state`, `host`, `targets`. Preserve the existing host and state; the scheduled review goes to the host game's `reports.recipient` (`game-coordinator`). Append the three distinct new role keys to targets, retaining every old target. Do not substitute the README's example host.

Hold `var/registry.lock` for registration. Re-read state after locking, reject changed registry revisions, validate the complete proposed configuration/registry/route set and increment registry `revision` with UTC `updatedAt`. Use durable writes and a journal identifying any partially completed multi-file transaction. Do not expose registration to launching consumers while incomplete. On interruption, reconcile exact recorded writes under lock before proceeding; never overwrite concurrent changes or roll back unrelated state.

Registration can change a resident's startup layout even though recipients resolve at send time. Preflight and residents must use the same effective adapter/socket. Route any required adoption to the affected Tech owner: drain gates/reporters, verify its singleton, replace only that authorized resident and verify pin/config/control again. Preserve existing schedules, route, state and artifacts. No extra runner, timer, daemon, manual wake or departure. A fresh CLI probe is not resident proof; actual scheduled receipt establishes coverage.

Follow the [current setup runbook](../../docs/setup.md#add-a-game) for the game's schema-1 `delivery-kit.json`, including the registered report recipient, actual CI names, approved departure minute and disabled deploy mode. Gate order is check, lint, test, build, then extras. CPUs stay at most four and delivery load uses current authorized policy. Preserve current cadences and paused control. Runner startup and delivery enablement require separate checked Tech READY and explicit activation.

After validation, game-coordinator initializes paused control through `delivery-kit control --root GAME_COORDINATOR_ROOT --game SLUG --state paused --reason TEXT --requester game-coordinator`. Verify `status` before runner approval. The command owns `control.lock` and durable control state; never handcraft observations. Missing control fails closed and is not initialization.
