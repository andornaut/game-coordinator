# Workspace setup

Use this runbook for a new coordinator checkout or an approved game addition. Restore the
registry, authority and backups when recovering an existing workspace. Use
[game-sessions](../../skills/game-sessions/SKILL.md) for existing native identities.

## Initialize a new coordinator

Use the primary Git checkout of game-coordinator. Its committed [coordination-kit.json](../../coordination-kit.json)
describes the existing workspace. For an independent workspace, supply your own config with
game and kit paths relative to the coordinator checkout. You can start with just the
coordinator by using the following config, then register games and kits as they are added.

```json
{
  "schema": 1,
  "timezone": "America/Toronto",
  "wakeMinutes": [],
  "appStateRoot": "var",
  "games": {},
  "kits": {},
  "sharedRoles": ["game-coordinator"]
}
```

Install the pinned packages from the coordinator checkout. Both kits require Node 24.21.0 or
newer. Use the repository's pinned check image for source checks. Session operations need
Git, `flock`, tmux and the authorized native harness. Scheduled delivery also needs its
configured gate image and existing GitHub authentication.

```bash
COORDINATOR_ROOT="$(pwd -P)"
npm ci --ignore-scripts
CK="$COORDINATOR_ROOT/node_modules/@andornaut/coordination-kit/dist/cli.js"
DK="$COORDINATOR_ROOT/node_modules/@andornaut/delivery-kit/dist/cli.js"
node "$CK" --version --json
node "$DK" --version
```

Link the project skills for both harnesses. Claude reads `.claude/skills` and Codex reads
`.agents/skills`; each is an ignored symlink to the committed `skills/` directory.

```bash
mkdir -p .claude .agents
ln -s ../skills .claude/skills
ln -s ../skills .agents/skills
```

Through the approved harness, create or select the coordinator project and required root
conversations. Verify the returned project and conversation IDs, working directories and
parentage. Reconcile ambiguous creation before retrying. The session helper resumes existing
IDs. Verify the managed Codex control socket or effective Claude Remote Control separately.

Use the Coordination Kit registry SDK with a draft following the installed
[registry schema](https://github.com/andornaut/coordination-kit/blob/v8.0.0/docs/reference/registry.md).
See the [minimal registry seed](https://github.com/andornaut/coordination-kit/blob/v8.0.0/docs/reference/configuration.md#registry-seed-example).
Use the verified coordinator project ID for `host.nativeProjectId` and set `host.root` to
`"."`. Give each role its verified native conversation binding and worktree path relative
to game-coordinator. Use `held` ownership and phase for roles awaiting activation, a
registered bus owner for each game operation, and `transfers: []` for an empty history.
Keep the draft in ignored local state.

The SDK creates `.coordination-kit/registry.json` at revision 1 under its lock and refuses an existing
registry. The packaged CLI exposes store and session commands. The registry SDK is the
bootstrap entry point.

```bash
# REGISTRY_DRAFT is the path to the reviewed JSON draft.
node --input-type=module - "$REGISTRY_DRAFT" <<'JS'
import { readFileSync } from "node:fs";
import { createRegistry, loadLayout } from "@andornaut/coordination-kit/build/registry";

const draft = JSON.parse(readFileSync(process.argv[2], "utf8"));
const registry = createRegistry(() => new Date(), loadLayout(process.cwd()), draft);
console.log(JSON.stringify({ revision: registry.revision }));
JS
```

Configure scheduled reviews once you have a registered host game and an approved review
minute in `coordination-kit.json`. Use ignored `.coordination-kit/route.json` and the
[schema-2 route contract](https://github.com/andornaut/coordination-kit/blob/v8.0.0/docs/reference/review.md#review-route).
The host game's committed `reports.recipient` selects `game-coordinator`. This example
uses the game added in the next section.

```json
{
  "schema": 2,
  "state": "held",
  "host": "example-game",
  "targets": ["example-game/art", "example-game/gameplay", "example-game/tech"]
}
```

Keep the route held until review startup is approved. Scheduled reviews require an active
route and approved host runner. The host's delivery control can stay paused.

From the coordinator checkout, inspect the registered coordinator slot. If an authorized
frontend needs resuming, use the scoped [session procedure](operations.md#inspect-and-resume).
For Claude, that helper writes the per-conversation MCP configuration to ignored
`.coordination-kit/session-frontends/`. Current bindings, creation records and channel
configuration are local runtime state.

```bash
node scripts/sessions.mjs plan --role game-coordinator
node "$CK" --root "$COORDINATOR_ROOT" harness ready --role game-coordinator
node "$DK" --root "$COORDINATOR_ROOT" check-config
```

### Initialize the coordination store

Coordination Kit initializes the file journal on the first successful write. After verifying
the coordinator's native binding and activation, run this from the coordinator conversation.

```bash
node "$CK" --root "$COORDINATOR_ROOT" session start
```

Verify the returned binding and startup record. Keep `.coordination-kit/coordination/` and its authority
receipt in the primary checkout. An optional `.coordination-kit/work-protocol.json` selects an external
location for wake and channel files and artifacts. Preserve the existing journal, receipt,
state-root pointer, and independent backups when recovering a workspace.

See the [store layout](https://github.com/andornaut/coordination-kit/blob/v8.0.0/docs/reference/store.md#location-and-settings)
and the [upgrade guide](https://github.com/andornaut/coordination-kit/blob/v8.0.0/docs/guides/upgrading.md#coordination-kit-80)
for a workspace that reports `file-authority-legacy-state`.

## Add a game

Use [game-create](../../skills/game-create/SKILL.md) for authorized creation and its
[registration contract](../../skills/game-create/contracts.md#coordinated-registration) for the
coordinated writes. If a checked repository already exists, start with its verified
location, pins, roles and approvals.

1. Create or prepare the game repository on `main`. Commit its source, checks and kit pins,
   a lockfile and schema-1 `delivery-kit.json`. See the
   [Delivery Kit configuration reference](https://github.com/andornaut/delivery-kit/blob/v8.1.0/docs/configuration.md)
   for the shape. With Delivery Kit 8.1 or later, use the display name from the coordinator's
   game entry. Supply the matching legacy `reports.project` field only where a supported reader
   requires it. Name `game-coordinator` in `reports.recipient` and `reports.workerParents`. Use existing shared
   checks and actual required CI names. Pick an approved unused departure minute, keep
   `deploy.mode: "none"` until separately approved and leave other schedules intact.
2. Create distinct role branches and ignored `.worktrees/art`, `.worktrees/gameplay` and
   `.worktrees/tech`. Verify the native project and each persistent root conversation before
   registering. The native conversations use the game root. Work happens in each role's
   worktree.
3. Add the game ID, display name, relative path and the three role types to the coordinator's
   tracked `coordination-kit.json`. Art, Gameplay and Tech already have shared role contracts. Add
   the exact IDs and paths such as `../example-game/.worktrees/art` to `.coordination-kit/registry.json` as
   held, and add the game's initial Tech bus owner. Append the new role keys to the existing
   review route's targets while preserving its host, state and existing targets. If the
   workspace has no route, follow [coordinator setup](#initialize-a-new-coordinator) once a
   review host and minute are approved. Use the registration transaction and the SDK's
   revision-checked registry writer.
   If the approved harness differs from the default, use `coordination-kit harness select`
   with the fresh `--expected-revision` and `--app` scope for the new game. The roles stay held.
4. Validate the full layout from the coordinator checkout. Run the scoped role plan and
   generate each role's held brief. Its reported artifact belongs in the corresponding initial
   HOLD request. Verify actual replies and effective harness capability. Initialize desired
   delivery control as paused and inspect status before requesting runner startup.

For example, add this object as `games.example-game` in the coordinator's `coordination-kit.json`.
The sibling checkout uses the same game ID in registration and Delivery Kit commands.

```json
{
  "name": "Example Game",
  "path": "../example-game",
  "roles": ["art", "gameplay", "tech"]
}
```

```bash
GAME_ID=example-game
node "$DK" --root "$COORDINATOR_ROOT" check-config
node scripts/sessions.mjs plan --role "$GAME_ID/art" \
  --role "$GAME_ID/gameplay" --role "$GAME_ID/tech"
node scripts/sessions.mjs brief --role "$GAME_ID/art" \
  --role "$GAME_ID/gameplay" --role "$GAME_ID/tech" --held
node "$DK" --root "$COORDINATOR_ROOT" control --game "$GAME_ID" --state paused \
  --reason 'Approved initial pause' --requester game-coordinator
node "$DK" --root "$COORDINATOR_ROOT" status --game "$GAME_ID"
```

If a registered frontend needs to start for held preparation, use the exact roles with
`sessions.mjs resume --held` only under startup authority. Resolve any remaining blockers
with the owning role. Record infrastructure acceptance separately from registration and
preserve independent holds. Runner startup and delivery enablement require explicit approval
and checked Tech readiness. The next genuine scheduled review verifies review coverage.
