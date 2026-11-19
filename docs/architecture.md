# Architecture

How the games, the shared kits and the agent sessions fit together. This page is an overview; each linked document owns the details.

```text
                          game-coordinator role
          routing, scheduled reviews, shared policy, approval ledger
                                    |
         +----------------- coordination-kit -----------------+
         | role registry, coordination store, request ledger, |
         | work protocol, wake adapters, session channels     |
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

## Roles and sessions

Every game has three permanent roles, Art, Gameplay and Tech. Each kit has one role, and game-coordinator is one more. Each role is a long-running agent session (Claude or Codex) with its own Git worktree in the owning repository's ignored `.worktrees/` directory.

- Art and Gameplay design and build within their scope on their own branches.
- Tech owns the game's `main`: it integrates reviewed work, runs the checks and owns the game's kit pins and runner.
- Kit roles own their kit's source, interfaces, checks and releases.
- game-coordinator owns shared policy, routing, the registry, the approval ledger and the scheduled reviews. It coordinates; it does not implement game or kit work.

Substantive work goes to short-lived workers, each in its own worktree and branch. The parent role reviews and integrates their results.

The [role catalog](roles.md), generated from `roles.json`, is the authoritative list of roles, scopes and boundaries.

## coordination-kit: how roles talk and keep records

[coordination-kit](https://github.com/andornaut/coordination-kit) is the common contract every role uses through one CLI installed at the game-coordinator root, invoked as `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root>`.

- **Registry.** `var/registry.json` maps each role name to its current conversation per harness and its worktree. Senders always address roles by name. Every send resolves the recipient's current conversation, so a relaunched or transferred session keeps receiving messages without changes elsewhere. The registry binding is also the writer fence: a writing command is accepted only from the role whose effective binding equals the caller's native conversation ID.
- **Coordination store.** `coordination.db`, a SQLite file in the protocol state root, holds an append-only, hash-chained event log and the message projections built from it. Review briefs and ingested runner events are stored there too, as messages from `delivery-kit`.
- **Messages.** Store first, wake second, pull third:
  1. `msg send` commits the message to the store. Nothing native happens before that commit.
  2. The store attempts at most one outstanding wake per recipient, skipping unregistered, unbound and held recipients. A wake carries no content, only `N new messages for ROLE: run coordination-kit inbox`. Claude wakes through a per-conversation wake file that the channel server announces; Codex wakes through one guarded control-socket queue add. A wake outcome is logged apart from message state.
  3. The recipient runs `inbox`, which records its messages `delivered`.
  4. The recipient closes each message in one write: `msg done` (handled or superseded) or `msg retain` with an owner, a reason and the next boundary.

  `msg history` reads the event log, the durable record of every send, delivery and close.

- **Work protocol.** Each role enrolls in its own namespace. Work starts only from an approved work reference, and passes boundaries at start, before work, review, integration and cleanup. This makes who is doing what, and who approved it, auditable after the fact. Messages do not depend on it.
- **Request ledger.** A durable record of every incoming request with its owner, status, targets and coverage, kept in the protocol state root outside all repositories.
- **Channels.** Each Claude session runs a channel server that watches its conversation's wake file and emits one notification per new wake. Channels use the stable command `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root> claude channel`, so a kit upgrade needs only `npm ci` and an `/mcp` reconnect; a changed command needs a relaunch.

## delivery-kit: how games ship

[delivery-kit](https://github.com/andornaut/delivery-kit) runs one resident runner per game, pinned in that game's `package.json`. It bundles coordination-kit, so games pin only delivery-kit.

Each game has a fixed hourly departure slot (Ada the Navigator :00, Archie :10, Chibi :20, America/Toronto). At its slot, when `main` has new commits, the runner:

1. runs the full gate on the exact local `main` HEAD in an isolated container;
2. pushes that exact commit without force;
3. watches CI for it;
4. deploys when CI passes.

There is no release queue, rollback or revert. A failed gate or CI run is fixed forward on `main`, and the next slot ships the fix. The runner reports each step as a delivery event, and at :30 each hour calls the coordinator-installed CLI to store game-coordinator's one-page review brief. A 6.1 runner appends events to `var/games/<g>/bus/events.jsonl`, which `events ingest` stores as messages; a 6.0 runner flushes its event outbox through the channel.

## How work flows

1. The user approves work, in the owning role's session or relayed through game-coordinator.
2. The owner records the approved work reference and starts it. Cross-role needs travel as role-addressed messages.
3. Art and Gameplay hand finished branches to Tech, which reviews, runs focused checks and integrates into local `main`.
4. delivery-kit ships `main` at the next slot and reports gate, push, CI and deploy.
5. game-coordinator follows the reports, routes any failure to the owning Tech and closes acceptance in the [approval ledger](approval-ledger.md).

Work records live with their repository: `docs/design/` holds the current rules for each area and `docs/work/` holds one file per approved task. Live progress stays in the protocol state, not in Git. The [Design and work files](game-policies.md#design-and-work-files) policy defines the convention.

## Scheduled reviews

At each :30 review, game-coordinator:

- inventories every role's open store messages and ready handoffs, and has each recipient close or retain them;
- finds every hold, block and pending user decision, and makes sure each decision is open as a prompt in its owner's session;
- escalates anything stuck for two scheduled slots with its owner, blocker and next action;
- closes stalled or ownerless containers, worktrees and scratch after preserving their diagnostics.

[Monitoring](../README.md#monitoring) lists the exact steps.

## Ownership and authority

- Only the user makes decisions. Roles ask through structured prompts with a recommendation first, and an unanswered question blocks only the work that depends on it.
- Each role writes only its own protocol namespace, worktree and records. game-coordinator alone writes the approval ledger and the registry.
- Delivery is never paused for polish. Required red gates, game-breaking failures and explicit user pauses are the only delivery blockers.
- Shared product rules live in [game policies](game-policies.md); game-specific specifications stay with each game.

## Where state lives

| Location                                                | Contents                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Each repository                                         | Source, design and work files, checks; role worktrees in `.worktrees/`  |
| game-coordinator `var/` (ignored)                       | Registry, runner bus state, review snapshots and role checkpoints       |
| Protocol state root (outside all repositories, ignored) | Coordination store, wake files, request ledger, work records, artifacts |
| GitHub releases                                         | Pinned kit archives consumed by the games and game-coordinator          |
