# Architecture

How the games, shared kits and agent sessions fit together. For checkout and registration steps, see [Workspace setup](../guides/setup.md).

```text
                          game-coordinator role
          routing, scheduled reviews, shared policy, status audit
                                    |
         +----------------- coordination-kit -----------------+
         | role registry, coordination store, work records,   |
         | sessions, handoffs, wake adapters, channels        |
         +--+---------------+---------------+---------------+-+
            |               |               |               |
       Ada roles      Archie roles     Chibi roles      kit roles
     Art, Gameplay,  Art, Gameplay,  Art, Gameplay,   art-kit, game-kit,
         Tech            Tech            Tech         delivery-kit,
            |               |               |         coordination-kit
            |   Tech integrates approved work into local main
            |               |               |
         +--+---------------+---------------+--+
         | delivery-kit: one runner per game   |
         | gate, push, CI watch, deploy        |
         +-------------------------------------+
```

## Projects

| Project           | Repository                                                          | Purpose                                                        |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| Archie            | [archies-dog-walks](https://github.com/andornaut/archies-dog-walks) | Game                                                           |
| Chibi             | [chibis-way-home](https://github.com/andornaut/chibis-way-home)     | Game                                                           |
| Ada the Navigator | [ada-the-navigator](https://github.com/andornaut/ada-the-navigator) | Game                                                           |
| art-kit           | [art-kit](https://github.com/andornaut/art-kit)                     | Raster, frame, font and Aseprite export primitives             |
| game-kit          | [game-kit](https://github.com/andornaut/game-kit)                   | Shared TypeScript runtime, input, layout and Phaser adapters   |
| delivery-kit      | [delivery-kit](https://github.com/andornaut/delivery-kit)           | Scheduled and ad hoc delivery, plus scheduled reviews          |
| coordination-kit  | [coordination-kit](https://github.com/andornaut/coordination-kit)   | Role registry, coordination store, messaging, harness adapters |

Games consume kits as dev dependencies pinned to GitHub release tarballs.

## Roles and sessions

Every game has three permanent roles, Art, Gameplay and Tech. Each kit has one role, and game-coordinator is one more. Each role is a long-running agent session (Claude or Codex) with its own Git worktree in the owning repository's ignored `.worktrees/` directory.

- Art and Gameplay design and build within their scope on their own branches.
- Tech owns the game's `main`, integrates reviewed work and supplies checked source and pins. After a verified transfer, game-coordinator owns approved bus operations and the resident runner executes delivery.
- Kit roles own their kit's source, interfaces, checks and releases.
- game-coordinator owns shared policy, routing, the registry, the scheduled reviews and the status audit. It coordinates; it does not implement game or kit work.

Substantive work goes to short-lived workers, each in its own worktree and branch. The parent role reviews and integrates their results.

The [role catalog](../reference/roles.md), generated from `roles.json`, is the authoritative list of roles, scopes and boundaries.

## coordination-kit: how roles talk and keep records

[coordination-kit](https://github.com/andornaut/coordination-kit) is the common contract every role uses through one CLI installed in the primary game-coordinator checkout, invoked as `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root>`. Every caller passes that checkout as the explicit root from any working directory.

- **Registry.** `var/registry.json` maps each role name to its current conversation per harness and its worktree. Senders always address roles by name. Every send resolves the recipient's current conversation, so a relaunched or transferred session keeps receiving messages without changes elsewhere. The registry binding is also the writer fence: a writing command is accepted only from the role whose effective binding equals the caller's native conversation ID.
- **Current coordination store.** The file journal and its committed records in `var/coordination/` are authoritative. Coordination Kit rebuilds the query index from the journal. The store contains messages, work, decisions, holds, sessions, handoffs, review briefs and ingested runner events. See the [Coordination Kit filesystem layout](https://github.com/andornaut/coordination-kit/blob/main/docs/store.md#filesystem-layout) for record examples.
- **Messages.** Store first, wake second, pull third:
  1. `msg send` commits the message to the store. Nothing native happens before that commit.
  2. The store attempts at most one outstanding wake per recipient, skipping unregistered, unbound and held recipients. A wake carries no content, only `N new messages for ROLE: run coordination-kit inbox`. Claude wakes through a per-role wake file that the channel server announces; Codex wakes through one guarded control-socket queue add. A wake outcome is logged apart from message state.
  3. The recipient runs `inbox`, which records its messages `delivered`.
  4. The recipient closes each message in one write: `msg done` (handled or superseded) or `msg retain` with an owner, a reason and the next boundary.

  `msg history` reads the event log, the durable record of every send, delivery and close.

- **Work records.** The owner of a work file records its lifecycle with `work start`, `work evidence`, `work block`, `work ready` and `work finish`; only the owner writes. `question open|answer|cancel` and `hold set|release` record pending user prompts and holds, and a pending question or a role hold suppresses that role's wakes. `request close` closes an imported request the role owns.
- **Sessions and handoffs.** Each role runs `session start` at startup, which refuses a held role. game-coordinator opens a harness handoff with `handoff open` and moves it with `handoff state`; each selected role reports `handoff ready` and `handoff active`.
- **Channels.** Each Claude session runs a channel server that watches its role's wake file and emits one notification per new wake. Channels use the stable command `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root> claude channel`, so a kit upgrade needs only `npm ci` and an `/mcp` reconnect; a changed command needs a relaunch.

## delivery-kit: how games ship

[delivery-kit](https://github.com/andornaut/delivery-kit) runs one resident runner per game, using the pin in that game's `package.json`. For scheduled reviews and event ingest, the runner calls the Coordination Kit CLI pinned in the coordinator checkout.

Each game has a fixed hourly departure slot (Ada the Navigator :00, Archie :10, Chibi :20, America/Toronto). At its slot, when `main` has new commits, the runner:

1. runs the full gate on the exact local `main` HEAD in an isolated container;
2. pushes that exact commit without force;
3. watches CI for it;
4. deploys when CI passes.

There is no release queue, rollback or revert. A failed gate or CI run is fixed forward on `main`, and the next slot ships the fix. The runner reports each step as a delivery event, and at :30 each hour calls the coordinator-installed CLI to store game-coordinator's one-page review brief. The runner appends events to `var/games/<g>/bus/events.jsonl`, which `events ingest` stores as messages.

## How work flows

1. The user approves work, in the owning role's session or relayed through game-coordinator.
2. The owner starts the approved work file with `work start`. Cross-role needs travel as role-addressed messages.
3. Art and Gameplay hand finished branches to Tech, which reviews, runs focused checks and integrates into local `main`.
4. delivery-kit ships `main` at the next slot and reports gate, push, CI and deploy.
5. game-coordinator follows the reports, routes any failure to the owning Tech and audits acceptance with `coordination-kit status`. Owners record evidence and finish through the [work lifecycle](game-policies.md#work-lifecycle).

Work records live with their repository: `docs/design/` holds the current rules for each area and `docs/work/` holds one file per request. Live progress is coordination-store records, not Git. The [Design and work files](game-policies.md#design-and-work-files) policy defines the convention.

## Scheduled reviews

At each :30 review, game-coordinator:

- inventories every role's open store messages and ready handoffs, and has each recipient close or retain them;
- finds every hold, block and pending user decision, and makes sure each decision is open as a prompt in its owner's session;
- escalates anything stuck for two scheduled slots with its owner, blocker and next action;
- closes stalled or ownerless containers, worktrees and scratch after preserving their diagnostics.

[Monitoring](../guides/operations.md#monitoring) lists the exact steps.

## Ownership and authority

- Only the user makes decisions. Roles ask through structured prompts with a recommendation first, and an unanswered question blocks only the work that depends on it.
- Each role writes only its own worktree and records. Only the owner writes its work, question and hold records. game-coordinator alone writes the registry.
- Delivery is never paused for polish. Required red gates, game-breaking failures and explicit user pauses are the only delivery blockers.
- Shared product rules live in [game policies](game-policies.md); game-specific specifications stay with each game.

## Where state lives

This example shows the primary coordinator checkout alongside Archie and one kit.
Game and kit paths are relative to the coordinator checkout in `config.json`.

```text
workspace/
  game-coordinator/
    config.json, roles.json           tracked workspace and role definitions
    package.json, package-lock.json   tracked kit pins
    docs/, scripts/, skills/, tests/  tracked policy, tooling and checks
    .worktrees/                      ignored task checkouts
    node_modules/                    local installation
    var/                             ignored runtime state
      registry.json, route.json     native bindings and review route
      coordination-authority.json   selects the active file authority
      coordination/                authoritative journal and role records
      work-protocol.json           optional pointer to external state
      games/archies-dog-walks/bus/  runner state and delivery control
      handoffs/games/archies-dog-walks/tech/current.md  Tech checkpoint
      session-frontends/           generated Claude channel configuration
  archies-dog-walks/
    delivery-kit.json                tracked game delivery configuration
    package.json, package-lock.json  tracked game dependencies and pins
    docs/design/, docs/work/         tracked design and work specifications
    .worktrees/                      ignored checkout paths for role branches
      art/, gameplay/, tech/
  coordination-kit/
    .worktrees/coordinator/          ignored checkout path for the kit role
```

| Location                                                              | Contents                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Each repository, tracked source                                       | Source, tests, checked configuration, lockfiles, design, approved work specifications and public decision lines. |
| Each repository, ignored `.worktrees/`                                | Role and task checkouts. Commits belong to the owning repository.                                                |
| Coordinator `var/registry.json` and `var/route.json`                  | Native role bindings, ownership and scheduled review routing.                                                    |
| Coordinator `var/coordination/` and `var/coordination-authority.json` | The canonical journal, committed role records and verified authority selection.                                  |
| Coordinator `var/games/<game>/bus/`                                   | Delivery control, resident state, logs and ingest cursors.                                                       |
| Coordinator `var/handoffs/` and `var/session-frontends/`              | Live checkpoints and evidence links, and generated per-conversation Claude channel configuration.                |
| Configured external state root, or `var/` when unset                  | Wake and channel state, artifacts and the SQLite source retained after cutover.                                  |
| Coordinator `var/reviews/` and `var/scratch/`                         | Local review evidence and temporary output as needed.                                                            |
| Outside the coordinator checkout                                      | Independent backups and restore evidence.                                                                        |
| GitHub releases                                                       | Immutable kit archives pinned in consumer lockfiles.                                                             |

Commit reviewable inputs. Keep live messages, questions, holds, private evidence, native IDs,
locks, generated runtime files and secret values out of Git. Keep credential references in an
approved configuration where required. A fresh coordinator starts with the SQLite source.
Selecting file authority puts the journal in the primary checkout's `var/coordination/`.
An optional `var/work-protocol.json` pointer keeps the SQLite source, transport state and
artifacts at an external path. See [workspace setup](../guides/setup.md#select-the-store-authority)
for the activation procedure and the [filesystem layout work](../work/gc-0014.md) for verified
migration evidence.
