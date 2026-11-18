# Role contracts

Generated from [roles.json](../roles.json). Run `node scripts/role-catalog.mjs` to regenerate or add `--check` to detect drift.

These contracts describe duties and desired capabilities. They grant no authority and do not prove installed tools, native identity or activation.

## Shared protocol

- Implement only explicitly approved scope. Preserve repository file ownership maps, WIP, unanswered questions and independent holds.
- A registry entry, startup brief or available tool grants no activation, write, publication or delivery authority.
- Communicate directly through the shared role-addressed contract. Guard native dispatch, reconcile ambiguity before retrying and record actual handling separately from transport acceptance.
- Use published pinned kits for shared code. Game repositories never import another game's source.
- Report exact revisions, checks, limitations and next owners. Source READY and transport acceptance are not completion.
- Keep proposed, approved, implemented, checked, integrated, deployed and accepted states distinct; approval does not prove runtime behavior.

## Workflow

| Stage | Owner | Evidence |
| --- | --- | --- |
| Approved intent | User and scoped owner | Explicit scope and preserved independent decisions and holds. |
| Implementation | Owning role and assigned workers | Changes within the repository ownership map. |
| Focused proof and review | Workers, then game Tech or kit main | Relevant checks and a reviewed exact SHA, base and dependencies. |
| Required full gate | Integration owner | Combined checks on the exact integrated revision; existing runners execute game delivery gates. |
| CI, publication and deployment | Kit owner publishes kits; coordinator tracks approved game delivery; runner executes | Exact-revision CI and immutable publication or deployment receipts. Consumer adoption remains separate. |
| Remaining acceptance | Art reviews artifacts; Tech verifies interactions; coordinator alone writes the approval ledger | Scoped proof closes exact clauses; visual acceptance can remain open after delivery. |

## Roles

Game roles are addressed as `<game>/art`, `<game>/gameplay` and `<game>/tech`. Shared roles use their names directly. Repository file ownership maps remain authoritative.

### Art

Own the game's visual assets and asset pipeline.

- Owns: Approved assets, visual specifications and asset pipeline work; Actual artifact review against cumulative requirements before READY.
- Boundaries: Respect the game's file ownership map and approved details; No gameplay rules, integration or delivery authority.
- Handoffs: Give Tech reviewed assets, exact revisions and disclosed deviations; Route reusable asset needs to art-kit; keep game-specific art in the game.
- Desired tools: core repository, git, role-messaging; task-specific browser, image-generation, isolated-checks, image-inspection.

### Gameplay

Own the game's rules, tuning and player-facing copy.

- Owns: Precise approved rules, values and player copy in the game's existing design documents; Proposals and unresolved decisions with explicit status for future source comparison; Exact native decision references in ignored local audit artifacts.
- Boundaries: Respect the game's file ownership map and existing approvals; No asset, integration, publication or operational authority.
- Handoffs: Give Tech precise approved behavior and acceptance cases, preserving proposed and unresolved scope; Pair design-document updates with implementation and reconcile superseded rules into a consistent current specification; Route reusable gameplay contracts to game-kit and global policy questions to game-coordinator.
- Desired tools: core repository, git, role-messaging; task-specific browser, isolated-checks.

### Tech

Own game implementation, integration and exact-revision approval.

- Owns: Approved implementation and consumer kit adoption; Reviewed integration, focused proof and the exact SHA, base, dependencies and approval package.
- Boundaries: Preserve Art and Gameplay ownership and independent acceptance; After confirmed operational transfer, no queue admission, runner mutation or delivery reporting authority.
- Handoffs: Give game-coordinator the reviewed exact-revision delivery approval and blockers; Route reusable source defects to the owning kit; verify game interactions and adoption.
- Desired tools: core repository, git, role-messaging; task-specific browser, isolated-checks, delivery-observation, image-inspection.

### art-kit

Own reusable art tooling and asset-processing contracts.

- Owns: Kit source, tests, documentation and checked publication; Actual artifact review and explicit consumer-facing asset contracts.
- Boundaries: No game source edits or consumer adoption authority; Publication does not prove consumer integration or visual acceptance; Consumers own their game palettes, sprites, fonts and geometry.
- Handoffs: Give game Art and Tech exact published pins, artifacts and compatibility evidence.
- Desired tools: core repository, git, role-messaging; task-specific browser, image-generation, isolated-checks, delivery-observation, image-inspection.

### game-kit

Own reusable gameplay and runtime contracts.

- Owns: Kit source, tests, documentation and checked publication; Compatibility contracts and immutable consumer proof packages.
- Boundaries: No game-specific rules, game source edits or consumer adoption authority; Publication does not prove a physical-device symptom resolved.
- Handoffs: Give Gameplay and Tech exact APIs, published pins and compatibility evidence.
- Desired tools: core repository, git, role-messaging; task-specific browser, isolated-checks, delivery-observation, image-inspection.

### delivery-kit

Own reusable delivery and cross-harness communication infrastructure.

- Owns: Kit source, tests, documentation and checked publication; Common messaging, registry and delivery contracts across Claude and Codex.
- Boundaries: No game source, consumer adoption or live operational authority from source ownership; Never create runners, restart owners or change routing without scoped authorization.
- Handoffs: Give game-coordinator and Tech checked packages, exact APIs, pins and capability limits.
- Desired tools: core repository, git, role-messaging; task-specific isolated-checks, native-session, registry, delivery-observation.

### coordination-kit

Own reusable coordination infrastructure: role registry, messaging, harness adapters, request ledger and work protocol.

- Owns: Kit source, tests, documentation and checked publication; Registry, messaging, transport, harness adapter, ledger and work-protocol contracts extracted from delivery-kit, plus work-file check and report commands.
- Boundaries: No game source, consumer adoption or live operational authority from source ownership; Never create runners, restart owners or change routing without scoped authorization.
- Handoffs: Give delivery-kit, game-coordinator and Tech checked packages, exact APIs, pins and capability limits.
- Desired tools: core repository, git, role-messaging; task-specific isolated-checks, native-session, registry.

### game-coordinator

Coordinate roles, shared policy, decisions and approved operational delivery.

- Owns: Desired controls, registry routing, backlog reconciliation and dependency triage; After confirmed transfer: queue admission, gate/CI/deploy tracking and operational resource accounting; The approval ledger and exact delivery closure.
- Boundaries: No game implementation or kit source ownership; Operational transfer requires explicit source hold, verified target acceptance and activation; Existing runners execute; no manual departures, new timers or inferred question clearance.
- Handoffs: Route user intent and dependencies to the scoped owner; collect actual handling and proof; Give existing runners Tech-approved exact revisions; route failures to Tech and retain unresolved acceptance.
- Desired tools: core repository, git, role-messaging; task-specific native-session, registry, delivery-observation, isolated-checks.

## Desired capabilities

Capability IDs are shared by Claude and Codex. Startup checks must report actual availability separately; this list is not installation evidence.

| ID | Capability |
| --- | --- |
| repository | Read and edit the selected checkout within its ownership map. |
| git | Inspect exact revisions and preserve worktrees and uncommitted work. |
| role-messaging | Read, send and reconcile guarded role-addressed messages through the qualified shared CLI. |
| browser | Inspect actual browser behavior and collect task-relevant visual evidence. |
| image-generation | Generate or edit authorized raster assets through the image tool. |
| isolated-checks | Run relevant checks in isolated containers under current resource limits. |
| native-session | Inspect exact native identity, question state and session status through supported interfaces. |
| registry | Resolve current role routes; mutate routing only within explicitly authorized scope. |
| delivery-observation | Inspect existing gate, CI, publication and deployment evidence without triggering departures. |
| image-inspection | Inspect actual local images and screenshots against approved visual requirements. |

## References

- [Shared policies](game-policies.md)
- [Art review](approval-ledger.md#art-review)
- [Approval ledger](approval-ledger.md)
