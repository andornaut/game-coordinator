# Cross-game policies

These policies apply to every current and future game. Game-specific rules and explicit user decisions retain their scope; a policy update does not release independent holds or authorize unapproved features.

## Ownership and communication

The game-coordinator owns cross-game policy coordination, documentation and communication. Keep shared principles here and game-specific specifications with their game. The [approval ledger contract](approval-ledger.md) defines acceptance evidence and delivery closure.

When defining or changing a policy:

1. Update the canonical policy and identify affected roles and approved scope.
2. Notify every registered game, including inactive and past games with retained owners, and any affected kit owners. Give the exact policy revision, required action and applicable exceptions. Notify retained owners without activating work, restarting sessions or releasing holds.
3. Track each recipient's delivery and handling receipt separately. Native acceptance proves delivery only. Record adopted, already compliant, blocked or deliberately retained outcomes with evidence, an owner and the next review boundary. Unavailable delivery or visibility stays unresolved; reconcile ambiguous delivery before retrying.
4. Include current policies in new-game onboarding, recovery and handoff. Verify adoption rather than inferring it from a message or registry entry.

## Decisions and ownership guards

Implement requested or approved scope only. A question is not authorization. The decision's owner opens a visible structured prompt in its own session, recommendation first, with exact text and options; preserve that prompt until the user's explicit answer or cancellation. Silence, elapsed time and transport acceptance are not decisions.

Route dependencies to the role that can clear them. Never answer, cancel or clear another owner's question. Preserve WIP, exact pins, recipient guards and independent holds. Unavailable question state is not clearance.

## Communication

Use one delivery-kit role-addressed messaging contract for Claude and Codex, including all game, coordinator and kit roles. Harness adapters implement the same interface and report unavailable or unsupported native capabilities explicitly. All roles use the coordinator-installed CLI; game-local delivery-runner package pins remain separate.

Deliver exact payloads directly through supported tools. The coordinator owns communication health, reconciliation and escalation; it is not a mandatory relay for every message. Frontend bridge and authentication repair remain separate integration-owner responsibilities; never bypass a refusal, type payloads into tmux as a fallback or overwrite user drafts.

Durably record each original's stable ID, exact payload, recipient role and intent before dispatch. Resolve the current registry route at send time, including the recipient's effective harness. Use normal queues for ordinary independent work and supported native live delivery only for confirmed unblockers. Guard both queued and live native dispatch against pending questions and HOLDs. If recipient clearance is unknown, retain the original in the durable local inbox without native dispatch or wake; a native queue can wake an idle owner.

- Queued means the original is durably retained for delivery.
- Accepted means the transport accepted delivery, not that the recipient handled it.
- Handled requires actual recipient reconciliation of the exact original.

Preserve unavailable and ambiguous outcomes with an owner, reason and next boundary. Reconcile accepted or ambiguous delivery before retrying; never blindly resend or acknowledge an unreconciled original. Preserve recipient questions, independent holds and parent-owned native worker guards. Communication does not authorize activation, interruption, restart or routing changes.

Use the existing :20/:50 reviews to reconcile the whole backlog, retry only after reconciliation and escalate items unhandled or repeatedly deferred across two slots. Follow the [review procedure](../README.md#monitoring); add no daemon or timer.

## Development and delivery

Integrate approved, reviewed work into local main promptly after focused relevant checks. Workers run focused checks; the integration owner runs combined full gates on the exact integrated revision before publication or deployment. Avoid repeated full feature-branch gates. Ship rules and design changes with the behavior they describe. Reporting an immutable prior release does not freeze subsequent approved source integration; each new candidate needs its own exact-revision gates.

Working games that pass mandatory gates ship on the normal cadence despite known visual or design regressions, unfinished approved refinements or missing final acceptance. Fix forward without rollback or polish-based delivery holds. Game-breaking failures, required red gates and explicit user delivery pauses remain blockers. Unknown feature authority limits that feature, not unrelated releases.

Acceptance remains open until its clauses are proved, even after deployment. Worker READY, source presence and a successful deployment alone do not establish complete behavior. Use the existing delivery procedure; policy changes grant no manual departure authority.

Run tests and harnesses in isolated containers with only the project checkout and scratch writable. Fingerprint dirty paths and file contents before and after checks; discard changed-tree results. Run long checks in the background, preserve evidence and release completed owned resources.

## Testing

Across all games and shared kits, target a 40% reduction in actual executed test cases across existing suites. Prioritize realistic user scenarios and plausible critical edge cases. Prefer shared tables and helpers over repeated test bodies, but parameterization alone is not case reduction.

Record baseline and after case counts and runtime separately, using comparable suite scope and execution settings. Report the achieved reduction and explicitly document accepted coverage losses in low-risk, low-churn areas.

Do not delete failing tests to get green, weaken timeouts, run mass mutation campaigns or add a new test matrix to meet the target. Test pruning does not authorize application changes or cross-game source imports. Use existing owners and assigned workers; focused worker checks and owner combined gates remain required. Preserve independent holds, publication controls and runtime state.

## Product consistency

Prefer simple, explicit designs and consistent behavior across games. Treat like cases alike; keep a difference only for a concrete current requirement. Review ergonomics against actual use, including controls, readability, layout and navigation. Preserve approved details and disclose unverified behavior rather than claiming completion.

- Disable UI text selection, including mobile long-press selection of counters. Preserve normal editable inputs and game interactions.
- Center Close when it is a modal's only visible footer action; hidden actions do not count. With multiple visible actions, place secondary actions left and the primary action right. Preserve labels, navigation, controls and story guards.
- In vertical menus, place the primary action last, at the bottom: Resume or Close as applicable. Place Back to title above the primary action whenever it is present.

### Pause and Menu navigation

Remove standalone Settings icons. Put Settings inside the Pause/Menu modal alongside navigation. Keep the entry control's position and navigation function consistent across screens: Pause only during active pausable gameplay; use a hamburger Menu everywhere else, including Start, Maps and nonpausable story screens. Center screen and modal titles and keep controls from occluding them.

### Settings

Use consistent settings structure, labels, state text and help across games. Labels name the setting; state text uses On/Off or Shown/Hidden as appropriate. Help is stable, declarative text describing the actual effect, rather than changing instructions for the next click. Include only settings the game supports; consistency does not authorize inventing toggles.

### Updates

Check online for updates on every return to the home screen and present available updates. Preserve each game's offer presentation and lifecycle.

For normal updates, serve the active build's assets from cache first; fetch only missing files matching that build. Check for versions separately and stage a complete new build apart from the active build. Activate normal updates only on Update now or a fresh document launch/restart before gameplay and save initialization, never automatically during play, a title return or a visibility resume. Reject incomplete staging and mixed-build assets, pages or manifests.

An explicitly approved newer-save recovery path may activate automatically when saved progress, statistics or achievements require a newer game. Block gameplay start, incompatible save loading and all save writes throughout recovery. Switch only to a complete, hash-verified build; resume only after the new document proves compatibility. Missing, unsafe or incomplete candidates, timeouts and continued incompatibility retain the fence and untouched saves, with connection/retry recovery. Activation alone is not compatibility proof.

### Ideas

Each game keeps an Ideas document for proposals outside its current version. The document location is game-specific. Ideas do not establish approval or implemented behavior; keep current specifications separate.

## Saves and cheats

Determine compatibility requirements from the current game/runtime release version, not the save schema version or save age.

- Before game version 1.0, backward compatibility and migrations are not required; incompatible saves may reset safely. This does not authorize deleting current progress or automatically resetting existing cloud saves.
- From game version 1.0 onward, published save-schema changes require compatibility or a migration preserving player progress.
- Cheats are available in browser tabs and unavailable in installed PWA windows. Use consistent Save-changing and Run-only groups.
- Run-only cheats preserve normal saves, progression, statistics and achievements. Save-changing actions explicitly persist their grants.

## Shared code

Games never import, link or depend on another game's source tree. Reuse code through published, pinned shared kit packages, or keep independent copies where appropriate. Kit owners retain reusable source; game Tech owners retain consumer adoption and integration. Kit publication and each consumer's adoption and deployment are separate outcomes.
