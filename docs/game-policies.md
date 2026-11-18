# Cross-game policies

These policies apply to every current and future game. Game-specific rules and explicit user decisions retain their scope; a policy update does not release independent holds or authorize unapproved features.

## Ownership and communication

The game-coordinator owns cross-game policy coordination, documentation and communication. Keep shared principles here and game-specific specifications with their game. Repository documentation is the source of truth for each project's current specifications. The [approval ledger contract](approval-ledger.md) defines acceptance evidence and delivery closure.

When defining or changing a policy:

1. Update the canonical policy and identify affected roles and approved scope.
2. Notify every registered game, including inactive and past games with retained owners, and any affected kit owners. Give the exact policy revision, required action and applicable exceptions. Notify retained owners without activating work, restarting sessions or releasing holds.
3. Track each recipient's delivery and handling receipt separately. Native acceptance proves delivery only. Record adopted, already compliant, blocked or deliberately retained outcomes with evidence, an owner and the next review boundary. Unavailable delivery or visibility stays unresolved; reconcile ambiguous delivery before retrying.
4. Include current policies in new-game onboarding, recovery and handoff. Verify adoption rather than inferring it from a message or registry entry.

## Decisions and ownership guards

Implement requested or approved scope only. A question is not authorization. The decision's owner opens a visible structured prompt in its own session, recommendation first, with exact text and options; preserve that prompt until the user's explicit answer or cancellation. Silence, elapsed time and transport acceptance are not decisions.

Route dependencies to the role that can clear them. Never answer, cancel or clear another owner's question. Preserve WIP, exact pins, recipient guards and independent holds. Unavailable question state is not clearance.

## Communication

Use one coordination-kit role-addressed messaging contract for Claude and Codex, including all game, coordinator and kit roles. Harness adapters implement the same interface and report unavailable or unsupported native capabilities explicitly. All roles use the coordinator-installed CLI; game-local delivery-runner package pins remain separate.

Use native messaging first. If it fails, ask the coordinator to relay the same original. Use the recipient's tmux pane only if the coordinator route also fails. Preserve the original ID and exact body, record every attempt and reconcile ambiguous or accepted delivery before changing transport. Verify the exact current recipient pane, pending questions and input drafts before tmux input; retain the original if safe delivery cannot be verified. Never interrupt a turn, answer or clear a question, overwrite a draft or duplicate an action on replay.

The coordinator owns communication health, reconciliation and escalation; it is not a mandatory relay for every message. Frontend bridge and authentication repair remain separate integration-owner responsibilities.

Durably record each original's stable ID, exact payload, recipient role and intent before dispatch. Resolve the current registry route at send time, including the recipient's effective harness. Use normal queues for ordinary independent work and supported native live delivery only for confirmed unblockers. Guard both queued and live native dispatch against pending questions and HOLDs. If recipient clearance is unknown, retain the original in the durable local inbox without native dispatch or wake; a native queue can wake an idle owner.

- Queued means the original is durably retained for delivery.
- Accepted means the transport accepted delivery, not that the recipient handled it.
- Handled requires actual recipient reconciliation of the exact original.

Preserve unavailable and ambiguous outcomes with an owner, reason and next boundary. Reconcile accepted or ambiguous delivery before retrying; never blindly resend or acknowledge an unreconciled original. Preserve recipient questions, independent holds and parent-owned native worker guards. Communication does not authorize activation, interruption, restart or routing changes.

Use the existing hourly :30 America/Toronto reviews to reconcile the whole backlog, retry only after reconciliation and escalate items unhandled or repeatedly deferred across two slots. Follow the [review procedure](../README.md#monitoring); add no daemon or timer.

## Session startup

Start every interactive game-development owner inside its appropriate managed tmux session and window on both Claude and Codex: game Art, Gameplay and Tech, shared kits and the coordinator. Follow the [session layout](../README.md#sessions-and-handoffs).

Preserve existing owners' identities, processes, working directories, worktrees, WIP, providers, questions and independent HOLDs. This rule does not authorize restarting or duplicating owners, changing ownership or treating regrouping as activation. Backend workers remain parent-managed; do not create interactive frontends solely for this policy.

## Development and delivery

Integrate approved, reviewed work into local main promptly after focused relevant checks. Workers run focused checks; the integration owner runs combined full gates on the exact integrated revision before publication or deployment. Avoid repeated full feature-branch gates. Ship rules and design changes with the behavior they describe. Reporting an immutable prior release does not freeze subsequent approved source integration; each new candidate needs its own exact-revision gates.

Working games that pass mandatory gates ship on the normal cadence despite known visual or design regressions, unfinished approved refinements or missing final acceptance. Fix forward without rollback or polish-based delivery holds. Game-breaking failures, required red gates and explicit user delivery pauses remain blockers. Unknown feature authority limits that feature, not unrelated releases.

Acceptance remains open until its clauses are proved, even after deployment. Worker READY, source presence and a successful deployment alone do not establish complete behavior. Use the existing delivery procedure; policy changes grant no manual departure authority.

Run tests and harnesses in isolated containers with only the project checkout and scratch writable. Fingerprint dirty paths and file contents before and after checks; discard changed-tree results. Run long checks in the background, preserve evidence and release completed owned resources.

### Resource admission

Use only the one-minute load average for admission: ordinary containers start below 20; scheduled delivery starts below 30, rechecking every minute for up to 15 minutes after the slot before skipping it. Keep at most four CPUs and four test workers per container, plus applicable memory caps. These execution caps add no admission conditions.

## Testing

Prune existing game and shared-kit test suites to reduce runtime while preserving coverage of realistic user scenarios and plausible critical edge cases. There is no fixed case-count reduction target. Prefer shared tables and helpers over repeated test bodies, but parameterization alone is not pruning.

Record baseline and after case counts and runtime separately, using comparable suite scope and execution settings. Report the achieved runtime and case-count changes and explicitly document accepted coverage losses in low-risk, low-churn areas.

Do not delete failing tests to get green, weaken timeouts, run mass mutation campaigns or add a new test matrix to reduce runtime. Test pruning does not authorize application changes or cross-game source imports. Use existing owners and assigned workers; focused worker checks and owner combined gates remain required. Preserve independent holds, publication controls and runtime state.

## Product consistency

Prefer simple, explicit designs and consistent behavior across games. Treat like cases alike; keep a difference only for a concrete current requirement. Review ergonomics against actual use, including controls, readability, layout and navigation. Preserve approved details and disclose unverified behavior rather than claiming completion.

- Disable text selection in noneditable UI, including mobile long-press selection of counters. Preserve normal editable inputs and game interactions.
- Center the button in every action row with one visible button, including Close, Back, Retry or a primary action. Hidden buttons do not count; native wrappers do not change the count. Keep bottom dismissal footers.
- In every action layout or group, place the existing primary action last at the bottom in vertical layouts and rightmost in horizontal layouts. For example, Resume goes below Back to title. Preserve existing primary and safety roles, secondary actions' relative order, callbacks, hidden-control identities, readiness, dismissal semantics, labels, navigation, controls, story and choice guards.
- Size modal windows by width family with a 16 logical px screen margin; height follows content and fonts stay full size. Widths: Ada and Chibi Large 688, Medium 500, Small 400; Archie Large 328, Medium 264.
- Place existing version/build metadata above the bottom Close or dismissal footer wherever both already appear. Keep that dismissal footer last, preserving existing typography, spacing, targets and centered sole-action rows. In rows-only scrolling layouts, keep metadata and dismissal fixed.

### Controls and input

Every discrete click/tap control defaults to the same action on hold unless a different hold action is explicitly bound. A hold fires once and suppresses the release click.

A hold on a discrete control fires after 500 ms in every game. Archie keeps its tuned hold timing only for drag input where no control is targeted. Use the canonical published kit action and gesture APIs through one shared binding, with the hold duration supplied by the game. Preserve explicit overrides, availability, focus, foreground and modal scopes, readiness guards, pointer and drag cancellation, and disposal. Continuous controls, dragging and native editable input retain their existing semantics; do not suppress scrolling or selection globally.

Each game audits all current control bindings and migrates bypasses to that shared binding, with a meaningful construction or architecture guard against future bypasses. Before changing a kit, distinguish an existing published hold fallback from a caller that bypasses it.

### Modal background isolation

Keep all game content outside the top modal window painted and laid out, visibly dimmed and inactive, including top controls, HUD and lower cards. Only the top modal is interactive; do not exempt a live topbar or substitute hiding, removing or reparenting background content.

A click anywhere in the background invokes the existing Cancel or Back action once when the modal is closeable. Mandatory choices remain nondismissible: add no cancellation or progress skip. Preserve existing callbacks, labels, choices, save behavior, foreground and readiness guards, pointer and drag cancellation, disposal and focus. Use canonical published kit ports when available; do not fork a local controller or assume an unpublished API. Policy approval alone does not establish consumer implementation or acceptance.

### Analytics

Keep analytics out of playable-game HTML and runtime, including authored, bundled and edge-injected beacons. Surrounding websites and landing pages may retain analytics. Verify generated and actually served game HTML and runtime network requests; preserve offline integrity, cache and security contracts.

### Pause and Menu navigation

Remove standalone Settings icons. Put Settings inside the Pause/Menu modal alongside navigation. Keep the entry control's position and navigation function consistent across screens. Show Pause whenever the current runtime context supports pausing; show a hamburger Menu when pausing is inapplicable, including Start/title and nonpausable Maps or story screens. Derive this from actual pause applicability, not merely whether the game has started. Center screen and modal titles and keep controls from occluding them.

Every Pause/Menu outside Start/title includes Back to title immediately above its bottom primary Resume or Close, including Ada's Earth narrative Menu. Omit Back to title only on Start/title; ordinary dialogs and choice cards keep their existing actions. Game callers own this navigation policy; preserve actual pausability, save/progress, settlement and exit-confirmation guards.

Start/title shows the Menu control and an Exit button. Show Exit only where exiting actually closes the app in the current runtime, such as the installed Chrome app (PWA) on Android, and hide it everywhere else, including plain browser tabs. Exit never navigates elsewhere. Detect this at runtime; do not decide it per game or per build.

Pause and Menu are one modal. On Start/title the entry control is Menu and the bottom button is Close; in game the entry control is Pause and the bottom button is Resume. The bottom button is the modal's primary action and uses the primary style. In game, Back to title sits directly above it. All other buttons in the modal are ordered alphabetically by label.

### Settings

Use consistent settings structure, labels, state text and help across games. Labels name the setting; state text uses On/Off or Shown/Hidden as appropriate. Help is stable, declarative text describing the actual effect, rather than changing instructions for the next click. Include only settings the game supports; consistency does not authorize inventing toggles.

### Installs

Every game follows one install model through the shared game-kit loader:

- The first install downloads the complete build up front, with determinate progress, and verifies it before play. After install the game is fully playable offline.
- There is one loading screen; do not chain a second loader or splash.
- Revisit staged first installs only if a measured first launch on a real phone is too slow; reduce asset size first.

### Download size

Keep downloads small and the file count low; measure actual transferred (compressed) bytes and file count, not disk usage.

- Consolidate frames into one sheet per asset set with frame data, instead of one file per frame. Keep each sheet within the texture limits verified on mid-range Android.
- Store each shared asset once and reference it; ship no duplicate copies.
- Round vector coordinates to the precision the display needs (one decimal unless a set proves it needs more) and minify generated SVG.
- Subset fonts to the glyphs the game's strings use, with a build check that every player-visible string is covered.
- Ship no file the runtime does not reference, and keep non-player copies (such as art galleries) out of the deployed build.
- Download one audio format per sound: the one the device plays.
- Keep vector art vector and pixel art at its authored resolution; do not rasterize vector sets or convert pixel art to SVG for size.

### Loading failures

Required assets must load before game entry. On failure, show **Loading failed**, the message **Some game files could not load. Try again.**, and **Retry**. Keep the error readable if the normal font fails. Present it through the published game-kit loading-failure presentation, with the Retry label in the same visible text colour as the game's primary Start button.

Retry is explicit, with at most one load attempt in flight. Use the single top loading bar for new loads and retries; success continues and another failure returns to the same error. Preserve saves and existing optional-asset placeholders.

### Updates

Download updates in the background, fetching only files that changed from the active build and reusing unchanged cached files. Stage the new build apart from the active build until it is complete. Switching to a staged build needs no further download.

- **At launch:** when a complete staged build exists, activate it silently before gameplay and save initialization, with no prompt.
- **During a session:** when staging completes, show an **Update now** prompt wherever the player is, pausing play while it is shown. Update now saves, then switches. Dismissing it continues play on the active build, and the next launch activates the staged build silently.

Serve the active build's assets from cache first; fetch only missing files matching that build. Never activate an update without the player's Update now choice while a session is running, including during play, a title return or a visibility resume. Reject incomplete staging and mixed-build assets, pages or manifests.

An explicitly approved newer-save recovery path may activate automatically when saved progress, statistics or achievements require a newer game. Block gameplay start, incompatible save loading and all save writes throughout recovery. Switch only to a complete, hash-verified build; resume only after the new document proves compatibility. Missing, unsafe or incomplete candidates, timeouts and continued incompatibility retain the fence and untouched saves, with connection/retry recovery. Activation alone is not compatibility proof.

### Ideas

Each game keeps an Ideas document for proposals outside its current version. The document location is game-specific. Ideas do not establish approval or implemented behavior; keep current specifications separate.

## Saves and cheats

Determine compatibility requirements from the current game/runtime release version, not the save schema version or save age.

- Before game version 1.0, backward compatibility and migrations are not required; incompatible saves may reset safely. This does not authorize deleting current progress or automatically resetting existing cloud saves.
- From game version 1.0 onward, published save-schema changes require compatibility or a migration preserving player progress.
- Cheats are available in browser tabs and unavailable in installed PWA windows. Detect this at runtime, both when opening cheats and when running an action.
- Settings is the only entry point: where cheats are available, Settings shows an Open Cheats button next to its Back button. It opens a Cheats modal sized to the game's content, whose body scrolls rather than pages, with Close as its bottom primary button.
- The modal has two groups, Run-only and Save-changing. Hide a group with no actions. Run-only cheats preserve normal saves, progression, statistics and achievements. Save-changing actions explicitly persist their grants.
- Grants that add an amount (currency, resources) are buttons that add a fixed amount on every press.
- Achievements and statistics come only from real play. No cheat grants an achievement, counts toward one or adds statistics, and unlocking content marks nothing cleared.
- Every game with first-time tips or hints offers Show tips again in Save-changing, which clears the seen record.
- Every game offers Reset save, last in Save-changing, after a confirmation. It resets the save entirely, including achievements and every cheat grant. Device settings that are not part of the save stay.
- Every game offers an FPS counter toggle, Off by default, showing frames per second in the bottom-right corner of the device viewport (inset from the safe area), drawn above everything, even over letterbox bars.
- Each game lists its cheats in its own cheats spec.

## Shared code

Games never import, link or depend on another game's source tree. Reuse code through published, pinned shared kit packages, or keep independent copies where appropriate. Kit owners retain reusable source; game Tech owners retain consumer adoption and integration. Kit publication and each consumer's adoption and deployment are separate outcomes.

## Design and work files

Every game and kit repository records design and approved work as committed files.

- `docs/design/<area>.md` holds a short design summary and an index table of ID, title and link, with no status column.
- Each approved task is `docs/work/<id>.md`. Its front matter holds `id`, `title`, `status` (milestone only: `approved`, `done`, `cancelled` or `superseded`), the approval reference, the design area, related IDs and `supersedes`. Its sections are scope, criteria, decisions and outcome.
- Live progress (claimed, in progress, blocked, ready, receipts and acceptance) stays in the protocol state root, not in work files.
- Only `main` edits index tables and approved scope. Approval commits the work-file stub and its index row on `main`; that commit allocates the ID. Workers edit only their own work file and the design prose that ships with their feature. Integration sets `status: done` in the merge.
- A changed or reverted decision is a new work item with `supersedes`; never rewrite a finished item's outcome.
- Work files are public. Use short approval references such as "user, 2026-11-18, option b"; never record session IDs, hostnames or quoted conversation.
- Condense old history only on request, and verify that no open item or live link is dropped.
- Docs-only changes run only the attribution and lint checks. Split CI so a first job detects changed paths, lint always runs, and heavier jobs are skipped by condition; games never serve or package `docs/`.
