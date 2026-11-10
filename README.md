# game-dev

Coordination home for three games and three shared kits. Each game and each kit is worked on by long-running AI coding agent sessions, one per role. This repository holds the coordination layout and documents how the pieces fit together. Machine-local state lives in an ignored directory.

## Projects

| Project           | Repository                                                          | Purpose                                                      |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Archie            | [archies-dog-walks](https://github.com/andornaut/archies-dog-walks) | Game                                                         |
| Chibi             | [chibis-way-home](https://github.com/andornaut/chibis-way-home)     | Game                                                         |
| Ada the Navigator | [ada-the-navigator](https://github.com/andornaut/ada-the-navigator) | Game                                                         |
| art-kit           | [art-kit](https://github.com/andornaut/art-kit)                     | Raster, frame, font and Aseprite export primitives           |
| game-kit          | [game-kit](https://github.com/andornaut/game-kit)                   | Shared TypeScript runtime, input, layout and Phaser adapters |
| delivery-kit      | [delivery-kit](https://github.com/andornaut/delivery-kit)           | Scheduled gate, push, CI watch, deploy and monitoring        |

Games consume kits as dev dependencies pinned to GitHub release tarballs.

## Roles

Each role is one agent conversation with a fixed scope.

- **Art, Gameplay and Tech**, per game:
  - Art owns assets and art pipelines.
  - Gameplay owns rules, values, tuning and player strings.
  - Tech owns implementation, integration, approval of exact release packages and the game's runner.
- **art-kit, game-kit and delivery-kit**, one coordinator each. Each owns its kit's source, tests, docs, CI and versioned releases. Kits release only after container checks and green CI on the exact commit.
- **game-dev**, one shared coordinator and monitor:
  - triages and routes work between roles;
  - relays decisions to and from the user;
  - sets each game's desired delivery state;
  - reviews health on a schedule;
  - tracks every release through gate, CI and deployment.

Roles talk to each other by name through the agent harness's cross-session messaging. Coordinators delegate substantive work to short-lived worker agents, each in its own Git worktree and branch.

## Delivery

Development is trunk-based. Work is never held on an approved branch, and deployment ships `main`.

1. Art and Gameplay hand Tech an exact branch and commit. Tech reviews it, merges it into the game's local `main` once its tests pass, and deletes the branch. Kits merge their own approved work the same way.
2. Each game has one resident delivery-kit runner. It departs on a fixed schedule: Archie at :00 and Chibi at :10 each hour, America/Toronto.
3. A departure runs the full gate on local `main` HEAD in an isolated container, pushes that exact commit by fast-forward, watches CI for it, and deploys the gated build when CI passes. There is no queue: whatever is on `main` at departure time ships.
4. Failures are fixed forward with a new change on `main`. Failed trees are never retried unchanged, and nothing is reverted.

### Delivery control

game-dev sets the desired state using the configured game `ID`, a `STATE` of `enabled` or `paused`, and a non-empty reason:

```bash
npx --no-install delivery-kit control --game ID --state STATE \
  --reason 'TEXT' --requester game-dev
npx --no-install delivery-kit status --game ID
```

`var/games/<g>/bus/delivery-control.json` persists desired state separately from the runner's observed state. Tech readiness and blockers remain separate from desired control; enabling delivery does not establish readiness. Status reports desired and observed control, runner identity, drain state and blockers.

Pausing blocks new scheduled and requested departures. Already admitted gates, CI watches and deployments finish, and monitor wakes continue. Missing or invalid control fails closed until explicitly initialized or repaired.

Before Tech adopts a runner version that requires persistent control, game-dev initializes each game's approved desired state with the upgraded CLI. Tech owns runner adoption and replaces the runner only when idle and drained. Check status before and after replacement, preserve existing desired state on later upgrades, and observe the next normal scheduled slot without a manual departure.

## Monitoring

delivery-kit wakes `game-dev` at :20 and :50 each hour, and sends every bus event (departure, gate failure, push, CI, deploy) as it happens. Both arrive over a channel into the `game-dev` conversation. `game-dev` records handling with explicit acknowledgements. At each review it does three things:

- surfaces any role's unanswered question to the user;
- asks the owning role to close a job that has made no progress across two reviews;
- routes failures to the owning Tech role.

## Handoffs between harnesses

The agents run on one harness at a time, either Claude Code or Codex, and a handoff moves every role together. It is designed as a switch rather than a migration:

- **Registry:** it maps each role name to its conversation on each harness, plus one active-harness field. Delivery and messages address roles by name and resolve the conversation at send time.
- **Worktrees:** each role keeps one worktree, shared by both harnesses.
- **Checkpoints:** each role keeps a living checkpoint with its state, work in progress, next action and pending questions, refreshed at every safe boundary.
- **Steps:** a handoff holds every role, flips the active harness, resumes the paired conversations from their checkpoints, verifies delivery and stops the old frontends.

## Conventions

- Containers run as a dedicated uid that owns nothing on the host, with every host mount read-only. Results are copied out by the host user, so no container leaves files a user can't remove.
- Tooling is TypeScript, run through a CLI or imported as a node module. Shell is limited to thin build wrappers, and there is no Python.
- Each repository keeps role worktrees in an ignored `.worktrees/` directory. Merged branches and their worktrees are deleted when they land.

## This repository

| Path                                | Committed | Contents                                                                                                                                          |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                         | yes       | This overview                                                                                                                                     |
| `config.json`                       | yes       | delivery-kit configuration: games, kits, role names and the monitor wake schedule                                                                 |
| `package.json`, `package-lock.json` | yes       | The pinned delivery-kit release                                                                                                                   |
| `node_modules/`                     | no        | The installed delivery-kit                                                                                                                        |
| `.worktrees/`                       | no        | Worktrees for changes to this repository                                                                                                          |
| `var/`                              | no        | Registry (`registry.json`), monitor route (`route.json`), channel config, per-role checkpoints and each game's runner state (`games/<game>/bus/`) |
| `.claude/`                          | no        | Harness-local files                                                                                                                               |
