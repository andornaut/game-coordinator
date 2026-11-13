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

## Development and delivery

Integrate approved, reviewed work into local main promptly after focused relevant checks. Workers run focused checks; the integration owner runs combined full gates on the exact integrated revision before publication or deployment. Avoid repeated full feature-branch gates. Ship rules and design changes with the behavior they describe. Reporting an immutable prior release does not freeze subsequent approved source integration; each new candidate needs its own exact-revision gates.

Working games that pass mandatory gates ship on the normal cadence despite known visual or design regressions, unfinished approved refinements or missing final acceptance. Fix forward without rollback or polish-based delivery holds. Game-breaking failures, required red gates and explicit user delivery pauses remain blockers. Unknown feature authority limits that feature, not unrelated releases.

Acceptance remains open until its clauses are proved, even after deployment. Worker READY, source presence and a successful deployment alone do not establish complete behavior. Use the existing delivery procedure; policy changes grant no manual departure authority.

Run tests and harnesses in isolated containers with only the project checkout and scratch writable. Fingerprint dirty paths and file contents before and after checks; discard changed-tree results. Run long checks in the background, preserve evidence and release completed owned resources.

## Product consistency

Prefer simple, explicit designs and consistent behavior across games. Treat like cases alike; keep a difference only for a concrete current requirement. Review ergonomics against actual use, including controls, readability, layout and navigation. Preserve approved details and disclose unverified behavior rather than claiming completion.

- Disable UI text selection, including mobile long-press selection of counters. Preserve normal editable inputs and game interactions.
- Center Close when it is a modal's only visible footer action; hidden actions do not count. With multiple visible actions, place secondary actions left and the primary action right. Preserve labels, navigation, controls and story guards.
- Check online for updates on every return to the home screen and present available updates. Preserve each game's presentation and update-activation lifecycle.

## Saves and cheats

Determine compatibility requirements from the current game/runtime release version, not the save schema version or save age.

- Before game version 1.0, backward compatibility and migrations are not required; incompatible saves may reset safely. This does not authorize deleting current progress or automatically resetting existing cloud saves.
- From game version 1.0 onward, published save-schema changes require compatibility or a migration preserving player progress.
- Cheats are available in browser tabs and unavailable in installed PWA windows. Use consistent Save-changing and Run-only groups.
- Run-only cheats preserve normal saves, progression, statistics and achievements. Save-changing actions explicitly persist their grants.

## Shared code

Games never import, link or depend on another game's source tree. Reuse code through published, pinned shared kit packages, or keep independent copies where appropriate. Kit owners retain reusable source; game Tech owners retain consumer adoption and integration. Kit publication and each consumer's adoption and deployment are separate outcomes.
