# Workspace setup

Use this runbook for a new coordinator checkout or an approved game addition. Restore the
registry, authority and backups when recovering an existing workspace. Use
[game-sessions](../skills/game-sessions/SKILL.md) for existing native identities.

## Initialize a new coordinator

1. Use a primary Git checkout of game-coordinator and sibling checkouts for the repositories
   selected in [config.json](../config.json). Check each relative path, game display name and
   role list. The committed example describes this workspace. An independent workspace
   supplies its own config. Keep game defaults and conventions in the
   [role catalog](roles.md) and [game policies](game-policies.md).
2. Install the pinned packages from the coordinator checkout. Both kits require Node 24.21.0
   or newer. Use the repository's pinned check image. Session operations need Git, `flock`,
   tmux and the authorized native harness. Delivery also needs
   the configured gate image and existing GitHub authentication. Keep credential values
   in their designated stores.
3. Through the approved harness's native interface, create or select the coordinator project
   and root conversations. Record the exact returned project and conversation IDs, verify
   their project, working directory and parentage, and reconcile an ambiguous create before
   retrying. The session helper plans and resumes existing IDs. Provision the managed Codex
   control socket or verify effective Claude Remote Control separately.
4. Prepare an initial registry draft using the installed
   [registry schema](https://github.com/andornaut/coordination-kit/blob/v3.2.0/docs/registry.md).
   It supplies `schema: 1`, the default `harness`, the native `host` with `root: "."`,
   `roles`, `operations` and `transfers`. Use the verified native coordinator project ID for
   `host.nativeProjectId`. Each role has its verified per-harness conversation binding,
   relative worktree and scoped ownership. Use `held` ownership and phase for roles awaiting
   activation. Give each game operation a registered bus owner. For an empty history use
   `transfers: []`. Keep the draft in private, ignored state. The SDK creates the registry at
   revision 1 under its lock and refuses to replace an existing registry.

```bash
COORDINATOR_ROOT="$(pwd -P)"
npm ci --ignore-scripts
CK="$COORDINATOR_ROOT/node_modules/@andornaut/coordination-kit/dist/cli.js"
DK="$COORDINATOR_ROOT/node_modules/@andornaut/delivery-kit/dist/cli.js"
node "$CK" --version --json
node "$DK" --version

# REGISTRY_DRAFT is the path to the reviewed JSON draft.
node --input-type=module - "$REGISTRY_DRAFT" <<'JS'
import { readFileSync } from "node:fs";
import { createRegistry, loadLayout } from "@andornaut/coordination-kit/build/registry";

const draft = JSON.parse(readFileSync(process.argv[2], "utf8"));
const registry = createRegistry(loadLayout(process.cwd()), draft);
console.log(JSON.stringify({ revision: registry.revision }));
JS
```

Reconcile the compatibility entries in `~/.local/state/game-sessions/libraries.json` if the
installed native session tooling uses them. To designate a game to dispatch scheduled reviews,
write ignored `var/route.json` using the schema-2 [route contract](https://github.com/andornaut/coordination-kit/blob/v3.2.0/docs/review.md#review-route).
Use `schema`, `state`, `host` and `targets`; the host game's committed `reports.recipient` is
`game-coordinator`. Keep the route held until review startup is approved. Scheduled reviews
require an active route and approved host runner. The host's delivery control can stay paused.

From the coordinator checkout, inspect the registered coordinator slot. If an authorized
frontend needs resuming, use the scoped [session procedure](../README.md#inspect-and-resume).
For Claude, that helper writes the per-conversation MCP configuration to ignored
`var/session-frontends/`. Current bindings, creation records and channel configuration are
local runtime state.

```bash
node scripts/sessions.mjs plan --role game-coordinator
node "$CK" --root "$COORDINATOR_ROOT" harness ready --role game-coordinator
node "$DK" --root "$COORDINATOR_ROOT" check-config
```

### Select the store authority

Coordination Kit 3.2 starts an empty workspace on SQLite. `store migration-status` reports
`sqlite` before the first write. After the coordinator's native binding and activation are
verified, `session start` in that conversation makes the first durable record and creates
`var/coordination.db` by default. An explicitly configured `var/work-protocol.json` can select
an external state root for the SQLite source and wake state.

```bash
node "$CK" --root "$COORDINATOR_ROOT" store migration-status
node "$CK" --root "$COORDINATOR_ROOT" session start
```

To select the filesystem authority, follow the
[Coordination Kit migration runbook](https://github.com/andornaut/coordination-kit/blob/v3.2.0/docs/upgrading.md#filesystem-authority-migration)
under the active coordinator binding. Prepare a snapshot using distinct, fresh backup and
restore paths outside the primary checkout. Verify the prepared receipt and activate that
exact ID under explicit authority.

```bash
node "$CK" --root "$COORDINATOR_ROOT" store migration-prepare \
  --backup "$BACKUP_FILE" --restore "$RESTORE_FILE"
node "$CK" --root "$COORDINATOR_ROOT" store migration-status
node "$CK" --root "$COORDINATOR_ROOT" store migration-activate --id "$RECEIPT_ID"
node "$CK" --root "$COORDINATOR_ROOT" store migration-status
```

Confirm the final status reports `files` and the exact active receipt. Retain the backup and
restore evidence, frozen SQLite source, and state-root pointer if used. Keep the primary
checkout and state root at their bound paths.

Fresh setup uses the registry SDK, the store migration commands and separate operator
steps for native identity, activation and delivery approval.

## Add a game

Use [game-create](../skills/game-create/SKILL.md) for authorized creation and its
[registration contract](../skills/game-create/contracts.md#coordinated-registration) for the
coordinated writes. If a checked repository already exists, start with its verified
location, pins, roles and approvals.

1. Create or prepare the game repository on `main`. Commit its source, checks and kit pins,
   a lockfile and schema-1 `delivery-kit.json`. See the
   [Delivery Kit example](https://github.com/andornaut/delivery-kit/blob/v7.1.0/examples/delivery-kit.json)
   for the shape. Match `reports.project` to the coordinator display name and name
   `game-coordinator` in `reports.recipient` and `reports.workerParents`. Use existing shared
   checks and actual required CI names. Pick an approved unused departure minute, keep
   `deploy.mode: "none"` until separately approved and leave other schedules intact.
2. Create distinct role branches and ignored `.worktrees/art`, `.worktrees/gameplay` and
   `.worktrees/tech`. Verify the native project and each persistent root conversation before
   registering. The native conversations use the game root. Work happens in each role's
   worktree.
3. Add the game ID, display name, relative path and the three role types to the coordinator's
   tracked `config.json`. Art, Gameplay and Tech already have shared role contracts. Add
   the exact IDs and role worktree paths to `var/registry.json` as held, and add the game
   operation's initial Tech bus owner. Keep the route host, state and existing targets while
   appending the three role keys, and reconcile compatibility mappings under their lock.
   Use the existing registration transaction and the SDK's revision-checked registry writer.
   If the approved harness differs from the default, use `coordination-kit harness select`
   with the fresh `--expected-revision` and `--game` scope for the new game. The roles stay held.
4. Validate the full layout from the coordinator checkout. Run the scoped role plan and
   generate each role's held brief. Its reported artifact belongs in the corresponding initial
   HOLD request. Verify actual replies and effective harness capability. Initialize desired
   delivery control as paused and inspect status before requesting runner startup.

```bash
# GAME_ID is the newly configured game slug.
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
