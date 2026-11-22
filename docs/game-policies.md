# Cross-game policies

These policies apply to every current and future game. Game-specific rules and explicit user decisions retain their scope; a policy update does not release independent holds or authorize unapproved features.

## Ownership and communication

The game-coordinator owns cross-game policy coordination, documentation and communication. Keep shared principles here and game-specific specifications with their game. Repository documentation is the source of truth for each project's current specifications. The [work lifecycle](#work-lifecycle) defines how progress, evidence, questions and holds are recorded.

When defining or changing a policy:

1. Update the canonical policy and identify affected roles and approved scope.
2. Notify every registered game, including inactive and past games with retained owners, and any affected kit owners. Give the exact policy revision, required action and applicable exceptions. Notify retained owners without activating work, restarting sessions or releasing holds.
3. Send each notice with `msg send` and track each recipient's delivery (its own `inbox` read) and close (`msg done` or `msg retain`) separately. Record adopted, already compliant, blocked or deliberately retained outcomes with evidence, an owner and the next review boundary. Unavailable visibility stays unresolved.
4. Include current policies in new-game onboarding, recovery and handoff. Verify adoption rather than inferring it from a message or registry entry.

## Decisions and ownership guards

Implement requested or approved scope only. A question is not authorization. The decision's owner opens a visible structured prompt in its own session, recommendation first, with exact text and options; preserve that prompt until the user's explicit answer or cancellation. Silence, elapsed time and transport acceptance are not decisions.

Route dependencies to the role that can clear them. Never answer, cancel or clear another owner's question. Preserve WIP, exact pins, recipient guards and independent holds. Unavailable question state is not clearance.

## Communication

Every game, coordinator and kit role, in Claude and Codex, uses one coordination-kit store and the same verbs, with identical output in both harnesses. All roles run the coordinator-installed CLI as `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root> ...`, never through `npx`; game-local delivery-runner package pins remain separate. The [role messaging](../README.md#role-messaging) table lists the verbs.

- **Send.** `msg send --to ROLE --body-file FILE` is the only payload path for role-to-role coordination. It stores the message before anything native happens, then attempts at most one wake. Use `--intent unblock` for a confirmed unblocker, `--link work=ID` for related work, and a fixed `--id UUID` when a retry must not duplicate.
- **Wake only.** Native session messages, channel notifications and tmux reminders only ask the recipient to run `inbox`. They may identify the count or exact original IDs. Keep message bodies in the store.
- **Read and close.** Recipients run `coordination-kit inbox` (with `--include-body` for bodies) at startup, on every wake and at each safe boundary, then close each message with `msg done ID` (with `--superseded-by ID` for a superseded one) or `msg retain ID --reason TEXT --next-boundary TEXT`. Only the recipient closes its own messages, in one write.
- **History.** `msg history` lists the store's append-only message events and is the durable record of what was sent, delivered and closed.
- **Fence.** Each writing verb identifies its caller as the registry role whose effective harness binding equals the caller's native conversation ID. `harness select` rotates the binding. A worker writes under its parent's binding, with `--worker NAME` as an unverified label.

Delivered means the recipient's own `inbox` read. Handled means its `msg done`. A wake, its acceptance or its failure is not delivery and never changes message state.

The store sends no wake to an unregistered, unbound or held recipient, and a Codex wake also passes the native question guard; a guarded or failed wake leaves the message stored for the recipient's next pull or the next review. Recipient guards still apply to everything a message asks for: never answer, cancel or clear another owner's question, and preserve independent holds, WIP and parent-owned worker guards. A held recipient pulls at its next boundary; reading or closing a message does not activate it. Communication does not authorize activation, interruption, restart or routing changes.

The coordinator owns communication health and escalation; it is not a relay. Frontend bridge and authentication repair remain separate integration-owner responsibilities.

Use the existing hourly :30 America/Toronto reviews to drain the whole backlog and escalate messages open across two slots. Follow the [review procedure](../README.md#monitoring); add no daemon or timer.

At the existing review or a safe boundary after a direct coordinator attention notice, the
[guarded reminder executor](../README.md#guarded-inbox-reminder) may use tmux after a confirmed
wake failure or refusal leaves an exact unblocker unread. The Coordination Kit ledger verifies
the original, registered binding, question and hold clearance, and exact native idle state.
The executor also verifies the matching Codex pane and its empty composer. It rechecks before
inserting the wake and verifies the exact sole draft before submitting it. The coordinator may
use the existing manual reminder path for another frontend when it can verify those same
conditions directly. When verification is unavailable, the owner pulls at a safe boundary.

Batch eligible originals in one inbox reminder per recipient. Record the exact originals, pane
and outcome. Preserve ambiguous wakes and uncertain reminders for reconciliation. When a guard
is unavailable or an original remains unread, record the owner, blocker and next boundary.
Escalate an item still open after two scheduled reviews with its exact ID and the action its
owner or the user can take to resolve it.
A reminder leaves delivery and handling to the recipient's own inbox. Preserve questions, holds
and drafts, and leave running turns uninterrupted.

## Session startup

Start every interactive game-development owner inside its appropriate managed tmux session and window on both Claude and Codex: game Art, Gameplay and Tech, shared kits and the coordinator. Follow the [session layout](../README.md#sessions-and-handoffs).

Preserve existing owners' identities, processes, working directories, worktrees, WIP, providers, questions and independent HOLDs. This rule does not authorize restarting or duplicating owners, changing ownership or treating regrouping as activation. Backend workers remain parent-managed; do not create interactive frontends solely for this policy.

## Development and delivery

Integrate approved, reviewed work into local main promptly after focused relevant checks. Workers run focused checks; the integration owner runs combined full gates on the exact integrated revision before publication or deployment. Avoid repeated full feature-branch gates. Ship rules and design changes with the behavior they describe. Reporting an immutable prior release does not freeze subsequent approved source integration; each new candidate needs its own exact-revision gates.

Working games that pass mandatory gates ship on the normal cadence despite known visual or design regressions, unfinished approved refinements or missing final acceptance. Fix forward without rollback or polish-based delivery holds. Game-breaking failures, required red gates and explicit user delivery pauses remain blockers. Unknown feature authority limits that feature, not unrelated releases.

Acceptance remains open until its clauses are proved, even after deployment. Worker READY, source presence and a successful deployment alone do not establish complete behavior. Use the existing delivery procedure; policy changes grant no manual departure authority.

Run tests and harnesses in isolated containers with only the project checkout and scratch writable. Fingerprint dirty paths and file contents before and after checks; discard changed-tree results. Run long checks in the background, preserve evidence and release completed owned resources.

### Resource admission

Use only the one-minute load average for admission: ordinary containers start below 20; scheduled delivery starts below 30, rechecking every minute for up to 15 minutes after the slot before skipping it. Keep at most four CPUs and four test workers per container. Set the memory ceiling to 4 GiB for containers launched for the games workspace, including gates, checks, browser tools and previews. Apply the ceiling at the next clean launch, or at an idle, drained boundary for a resident that needs replacement. These execution caps add no admission conditions.

## Testing

Prune existing game and shared-kit test suites to reduce runtime while preserving coverage of realistic user scenarios and plausible critical edge cases. There is no fixed case-count reduction target. Prefer shared tables and helpers over repeated test bodies, but parameterization alone is not pruning.

Record baseline and after case counts and runtime separately, using comparable suite scope and execution settings. Report the achieved runtime and case-count changes and explicitly document accepted coverage losses in low-risk, low-churn areas.

Do not delete failing tests to get green, weaken timeouts, run mass mutation campaigns or add a new test matrix to reduce runtime. Test pruning does not authorize application changes or cross-game source imports. Use existing owners and assigned workers; focused worker checks and owner combined gates remain required. Preserve independent holds, publication controls and runtime state.

## Product consistency

Prefer simple, explicit designs and consistent behavior across games. Treat like cases alike; keep a difference only for a concrete current requirement. Review ergonomics against actual use, including controls, readability, layout and navigation. Preserve approved details and disclose unverified behavior rather than claiming completion.

- Disable text selection in noneditable UI, including mobile long-press selection of counters. Preserve normal editable inputs and game interactions.
- Use consistent typography, a standard height and consistent text padding for labeled rectangular action buttons within each game. Stretch buttons in a vertical stack to a shared width. Size each button in a horizontal row to its own content plus the standard padding, including in wrapped rows. Round icon controls retain their own geometry.
- Center the button in every action row with one visible button, including Close, Back, Retry or a primary action. Hidden buttons do not count; native wrappers do not change the count. Keep bottom dismissal footers unless they duplicate a decision dialog's cancellation action.
- In every action layout or group, place the existing primary action last at the bottom in vertical layouts and rightmost in horizontal layouts. For example, Resume goes below Back to title. Preserve existing primary and safety roles, secondary actions' relative order, callbacks, hidden-control identities, readiness, dismissal semantics, labels, navigation, controls, story and choice guards.
- Size modal windows by width family with a 16 logical px screen margin; height follows content and fonts stay full size. Widths: Ada and Chibi Large 688, Medium 500, Small 400; Archie Large 328, Medium 264.
- Place existing version/build metadata above the bottom Close or dismissal footer wherever both already appear. Keep that dismissal footer last, preserving existing typography, spacing, targets and centered sole-action rows. In rows-only scrolling layouts, keep metadata and dismissal fixed.

### Controls and input

Use Game Kit to render standard text and icon buttons in menus, modals, HUDs and standalone game controls. Game Kit owns rendering, control states and discrete input. Each game supplies its skin, labels, placement and callbacks. Use the shared loading-safe Retry presentation where applicable and size the button to its label plus the game's standard horizontal padding. Preserve its existing height and recovery behaviour. Preserve the existing semantics of continuous steering, dragging, sliders and native editing.

Use smooth SVG for simple control glyphs and CSS or shared kit skins for simple surfaces. Reuse common controls through published kits. Keep characters, scenery, gear and badge illustrations, illustrated effects and pixel detail in raster at their authored resolution. Preserve each game's silhouettes, bevels and lips, persistent borders, state cues, hit targets and accessibility. When optimizing [download size](#download-size), compare transferred compressed bytes and requests in like-for-like builds and verify which dependencies are no longer downloaded.

Game buttons in HTML, canvas and mocks have no added outlines, border rings or ring-shaped shadows for focused, active (pressed) or selected states. Keep ordinary borders that are present in every state. Use a clearly visible change in face fill, text color or icon color, including in forced-colors mode. Existing pressed movement can supplement that treatment. Preserve native focus, tab order, keyboard activation, focus restoration and a distinct disabled state. Other game controls keep their authored visible focus treatment in place of the generic HTML ring. Verify the shared Game Kit defaults and each game against both source and rendered states.

Every discrete click/tap control defaults to the same action on hold unless a different hold action is explicitly bound. A hold fires once and suppresses the release click.

A hold on a discrete control fires after 500 ms in every game. Archie keeps its tuned hold timing only for drag input where no control is targeted. Use the canonical published kit action and gesture APIs through one shared binding, with the hold duration supplied by the game. Preserve explicit overrides, availability, focus, foreground and modal scopes, readiness guards, pointer and drag cancellation, and disposal. Continuous controls, dragging and native editable input retain their existing semantics; do not suppress scrolling or selection globally.

Each game audits all current control bindings and migrates bypasses to that shared binding, with a meaningful construction or architecture guard against future bypasses. Before changing a kit, distinguish an existing published hold fallback from a caller that bypasses it.

### Modal background isolation

Keep all game content outside the top modal window painted and laid out, visibly dimmed and inactive, including top controls, HUD and lower cards. Only the top modal is interactive; do not exempt a live topbar or substitute hiding, removing or reparenting background content.

A click anywhere in the background invokes the top modal's one-layer dismissal action once when dismissal is allowed. Mandatory choices remain nondismissible: add no cancellation or progress skip. Preserve existing callbacks, choices, save behavior, foreground and readiness guards, pointer and drag cancellation, disposal and focus. Use canonical published kit ports when available; do not fork a local controller or assume an unpublished API. Policy approval alone does not establish consumer implementation or acceptance.

### Analytics

Keep analytics out of playable-game HTML and runtime, including authored, bundled and edge-injected beacons. Surrounding websites and landing pages may retain analytics. Verify generated and actually served game HTML and runtime network requests; preserve offline integrity, cache and security contracts.

### Pause and Menu navigation

Remove standalone Settings icons. Put Settings inside the Pause/Menu modal alongside navigation. Keep the entry control's position and navigation function consistent across screens. Show Pause whenever the current runtime context supports pausing; show a hamburger Menu when pausing is inapplicable, including Start/title and nonpausable Maps or story screens. Derive this from actual pause applicability, not merely whether the game has started. Center screen and modal titles and keep controls from occluding them.

Every Pause/Menu outside Start/title includes Back to title immediately above its bottom primary Resume or Close, including Ada's Earth narrative Menu. Omit Back to title only on Start/title; ordinary dialogs and choice cards keep their existing actions. Game callers own this navigation policy; preserve actual pausability, save/progress, settlement and exit-confirmation guards.

Start/title shows the Menu control and an Exit button. Show Exit only where exiting actually closes the app in the current runtime, such as the installed Chrome app (PWA) on Android, and hide it everywhere else, including plain browser tabs. Exit never navigates elsewhere. Detect this at runtime; do not decide it per game or per build.

Pause and Menu are one modal. On Start/title the entry control is Menu and the bottom button is Close; in game the entry control is Pause and the bottom button is Resume. The bottom button is the modal's primary action and uses the primary style. In game, Back to title sits directly above it. All other buttons in the modal are ordered alphabetically by label.

### Back, Close and Resume

- **Back** returns one step to the view that opened the current page. Help, Logbook, Settings and other pages opened from Menu or Pause return to that same Menu or Pause. Preserve its state and actual pause status. Back to title is an explicitly named destination with its existing guards.
- **Close** dismisses one standalone dialog and restores the view underneath. Close on the title Menu returns to the title. A dialog opened directly from a HUD control returns to the underlying gameplay view. A dialog opened from another dialog returns to its immediate parent.
- **Resume** explicitly leaves Pause and returns to active play. Leaving a page opened from Pause keeps the game paused until Resume.
- When the decision actions in a modal each close it, as with Buy and Cancel, use the existing cancellation as the sole dismissal button in the action area. Label it Cancel, Close or Back according to its purpose and destination. The top-right X is separate from the action area.
- Provide a top-right X on every modal and route it to the same cancellation action exactly once. When dismissal is allowed, Escape and the backdrop use that same one-layer dismissal. Restore focus to the invoking control when available or to a logical target in the restored view. Preserve confirmation guards and the existing cancellation semantics.
- Review modals without a valid cancellation action case by case. Preserve each modal's existing blocking behaviour until the user approves a specific safe cancellation path for it. The X must never accept a decision or advance a story choice.

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
- Offer Cheats in browser tabs and installed apps. Preserve each action's gameplay eligibility and guards across display modes.
- Put one button labelled **Cheats** directly in the Menu or Pause modal, whichever applies in the current context. Use a shared modal structure with a title, a top-right X and a bottom primary Close button. Both dismissal controls return one layer to the invoking Menu or Pause and restore focus to the Cheats entry.
- Group Cheats actions logically and size the modal to fit the game's controls. Ada uses two logical columns and fits its controls without scrolling.
- Cheats never touch the save. Using any cheat starts a cheat session: from that moment nothing is saved, earned or banked (progress, unlocks, currency, achievements, statistics), and returning to Start/title from play, reloading or closing the game ends the session; the session itself is never stored. Continue then loads the save as it was before the first cheat. Cheats work on Start/title too: they apply to the session that the next Play or Continue starts.
- Grants that add an amount (currency, resources) are buttons that add a fixed amount on every press.
- The modal also holds three actions that are not cheats and start no cheat session: Show tips again (in every game with first-time tips or hints; it clears the seen record in the save), the FPS counter toggle, and Reset save.
- Reset save comes last, after a confirmation, and resets the save entirely, including achievements. Device settings that are not part of the save stay.
- The FPS counter is Off by default and shows frames per second in the bottom-right corner of the device viewport (inset from the safe area), drawn above everything, even over letterbox bars.
- Each game lists its cheats in its own cheats spec.

## Shared code

Games never import, link or depend on another game's source tree. Reuse code through published, pinned shared kit packages, or keep independent copies where appropriate. Kit owners retain reusable source; game Tech owners retain consumer adoption and integration. Kit publication and each consumer's adoption and deployment are separate outcomes.

## Design and work files

Every game and kit repository records design and approved work as committed files.

- `docs/design/<area>.md` holds a short design summary and an index table of ID, title and link, with no status column.
- Every user request is `docs/work/<id>.md`, approved or not. Its front matter holds `id`, `title`, `status` (milestone only: `proposed` until the user approves, `approved`, `done`, `declined` when the user declines, `cancelled` or `superseded`), the approval or request reference, the design area, related IDs and `supersedes`. Its sections are scope, criteria, decisions and outcome.
- Live progress (started, blocked, ready, finished, evidence and retained items) is coordination-store records written through the [work lifecycle](#work-lifecycle) verbs, not work-file content.
- Only `main` edits index tables and approved scope. Approval commits the work-file stub and its index row on `main`; that commit allocates the ID. Workers edit only their own work file and the design prose that ships with their feature. Integration sets `status: done` in the merge.
- A changed or reverted decision is a new work item with `supersedes`; never rewrite a finished item's outcome.
- Work files are public. Use short approval references such as "user, 2026-11-18, option b"; never record session IDs, hostnames or quoted conversation.
- Condense old history only on request, and verify that no open item or live link is dropped.
- Docs-only changes run only the attribution and lint checks. Split CI so a first job detects changed paths, lint always runs, and heavier jobs are skipped by condition; games never serve or package `docs/`.

## Work lifecycle

Work files and their coordination-store records are the single source of truth for every request. Run the verbs through the coordinator-installed CLI: the `work` verbs read `--root` as the repository and take the coordinator from `COORDINATION_KIT_ROOT`; `question`, `hold`, `status` and `graph` read `--root` as the coordinator. Every write is accepted only from the record's owner under the registry fence; a worker writes under its parent's binding. Work records add no admission gate and never change delivery controls.

- **Requests.** Every user request is a work file under [Design and work files](#design-and-work-files), `proposed` until approved. There is no other request record.
- **Progress.** The item's owner records `work start` (approved on `main`, no covering hold), `work block --reason TEXT --owner ROLE` naming the role that can clear it, `work unblock`, `work ready`, and `work finish` once integration has set `status: done` on `main`. A cross-role child request starts with `--parent REPOSITORY:WORK_ID`. `work show` and `work history` read an item's record, covering holds and events.
- **Evidence.** `work evidence ID --stage STAGE --sha SHA [--ref REF]` records each stage commit: `implemented`, `merged`, `verified`, `published` (kits only) and `deployed`. References name durable evidence (commits, run IDs, artifacts), never logs or secrets. Evidence continues after `work finish` while acceptance stays open. Kit publication, consumer adoption and each game's deployment are separate targets.
- **Acceptance.** A worker's `work ready` is a handoff, not completion. Tech verifies real interactions and state changes on the integrated revision, activating controls and observing their effects; source presence, screenshots and worker reports alone are not interaction proof. The owner records `verified` evidence and `work finish` after that proof. Missing coverage stays open as a block or retained item with its owner and next boundary, and adds no delivery hold.
- **Questions.** A user decision is a structured prompt in the owner's own pane plus a `question open --title TEXT [--work WORK_ID] [--options-file FILE]` record. After the user's explicit answer the owner runs `question answer --id ID --work WORK_ID --text TEXT`, which records the decision and appends its decision line, unstaged, to the work file in the main checkout for the owner's next commit. `question cancel --id ID --reason TEXT` records an explicit cancellation. A pending question withholds the owner's wakes.
- **Holds.** `hold set --id ID --scope work:WORK_ID|role|game:ID --reason TEXT` records a hold and `hold release --id ID` releases it. A work hold covers one item, a role hold every item its owner owns, and a game hold every item in that game's repository; a covering hold refuses `work start`. Only a role hold withholds the owner's wakes. An imported hold with no registered owner goes to the user through game-coordinator.
- **Status and audit.** `coordination-kit status` derives each item's status (requested, in progress, landed, deployed, done) from work files, store records, the commit on `main` that set `status: done` and the delivery record; `--audit` lists every user request with its evidence and `--format markdown` prints the digest. `question list --state pending` and `hold list --state active` list open questions and holds, and `graph` shows decisions and their supersedes chains. Unavailable output is reported as unavailable, never as clearance.

Only the owner answers, cancels or releases its own records. Never answer, cancel or clear another owner's question or hold.

### Art review

All Art owners and workers inspect each actual mockup and production artifact before presenting it or recording `work ready` or `work finish`. Compare against cumulative latest instructions, applicable approved references and the specification; preserve approved details unless explicitly superseded.

Check affected states, views and sizes, including visible pixel geometry and occlusion; DOM bounds alone are insufficient. Record the artifact or source pin and disclose deviations and unverified limits. Present incomplete or nonconforming work as WIP with its differences stated.

Art review adds no delivery hold; the fix-forward policy remains in force.
