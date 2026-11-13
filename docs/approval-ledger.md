# Approval ledger

The ignored `var/handoffs/game-dev/approval-ledger.json` tracks approved behavior through delivery. Dev-manager is its sole writer. Every registered game and kit role reports evidence and gaps to dev-manager; a completed audit can still leave approvals open.

## Delivery policy

Working games that pass required gates ship on the normal cadence, including builds with known visual/design regressions, unfinished approved refinements or missing final acceptance. Fix forward without rollback or polish-based delivery pauses. The ledger is not an additional admission gate.

Game-breaking failures, required red gates and explicit user delivery pauses remain blockers. Unknown new-feature authority restricts that feature's work and adoption, not unrelated releases. Preserve scoped user questions and independent source holds.

## Records

`schemaVersion: 1` has `roles`, `entries` and `independentHolds`. Roles use registry names and retain their current owner, checkpoint and audit receipt. Entries use stable IDs scoped to a target and behavior. Split independent clauses or targets so a partial result cannot close the rest.

| Entry field                      | Required evidence                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `approval`                       | Recipient, exact user wording and native turn/item references when available. Preserve explicit owner-attestation/history provenance and unknown references; never invent IDs. |
| `behavior`, `owner`              | Approved outcome, exact target and responsible role.                                                                                                                           |
| `acceptanceCriteria`             | Observable clauses covering the whole approved scope, including relevant paths and states.                                                                                     |
| `implementationSha`              | Reviewed source commit, including dependencies.                                                                                                                                |
| `mainSha`                        | Exact integrated snapshot; reconcile cherry-picked/rebased changes rather than assuming branch identity.                                                                       |
| `interactionProof`               | Criterion-to-receipt references with artifact/source pins, actual actions and observed results.                                                                                |
| `deployedSha`                    | Actual successfully delivered source and receipt, even while acceptance remains open.                                                                                          |
| `stage`                          | Last proven acceptance milestone, independent of operational delivery. A label alone proves nothing.                                                                           |
| `unresolved`, `independentHolds` | Missing coverage/evidence, required owner and next action; references to existing independent holds.                                                                           |

Missing native approval IDs stay explicitly unknown. Existing owner-attested authority remains scoped; unknown references neither authorize new work nor block unrelated approvals. Partial or superseded clauses remain identifiable without changing another clause's approval.

## Stages

These stages track acceptance closure, not permission to deploy. Record actual `deployedSha` and delivery receipts even when incomplete criteria leave an entry at an earlier stage.

| Stage         | Meaning                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `approved`    | Actual approval is recorded with its scope and available provenance.                                                                        |
| `implemented` | The owner supplies the reviewed implementation pin and focused checks. Worker READY is a handoff.                                           |
| `merged`      | The implementation and required dependencies are present in the recorded local-main snapshot.                                               |
| `verified`    | Tech verifies every acceptance clause on the integrated artifact; required full main gates pass for the exact revision.                     |
| `published`   | A kit-only publication target has successful exact-source CI and an immutable release/artifact receipt. Consumer adoption remains separate. |
| `deployed`    | Dev-manager reconciles actual successful game/consumer deployment of the verified behavior for the exact target/SHA and closes all clauses. |

Acceptance with missing coverage stays open even after successful deployment; continue remediation without pausing otherwise eligible delivery. Preserve prior evidence when a regression reopens an item. Superseding one clause does not cancel independent requirements.

Kit publication, consumer pin adoption and each game's deployment are separate targets. Kit-only entries end at `published`, retain the published source in `mainSha` and its release/artifact receipt in `interactionProof`, and leave `deployedSha` null. They cannot close consumer behavior without that consumer's interaction and deployment evidence.

## Art review

All Art owners and workers inspect each actual mockup and production artifact before presenting it or claiming done/READY. Compare against cumulative latest instructions, applicable approved references and the specification; preserve approved details unless explicitly superseded.

Check affected states, views and sizes, including visible pixel geometry and occlusion; DOM bounds alone are insufficient. Record the artifact/source pin and disclose deviations and unverified limits. Present incomplete or nonconforming work as WIP with its differences stated.

Art review adds no delivery hold; the fix-forward policy remains in force.

## Reconciliation

1. Each role audits all its approved scope against current source, integrated behavior and actual delivery. Report every gap, its existing owner, exact pins/receipts and next action. A no-gap report needs evidence; idle sessions, empty queues and stale checkpoints are not coverage.
2. Remediate approved gaps within existing role scope. Preserve WIP, unanswered questions and independent holds, including capture-tool, Phase 5 and simulation boundaries. Ask the owner to surface any genuinely new user decision; never answer or clear another role's question.
3. Workers run focused relevant checks. The integrating owner reviews and merges promptly, then runs one combined full gate on exact main. Repeat only for changed source, an actual failure or unresolved evidence; do not inflate tests to restate this ledger. Mandatory delivery-runner gates remain required.
4. Tech checks real interactions and state changes, including affected edge cases. Activate controls and observe their required effects. Source presence, screenshots and worker reports alone do not establish interaction coverage. Noninteractive clauses use the relevant artifact/configuration proof.
5. Dev-manager matches each verified clause to the actual target, pushed SHA, successful required CI and deployment receipt. A later commit must demonstrably include the verified behavior and dependencies. Reused proof must identify unchanged covered code/assets and the retained artifact; ancestry alone is insufficient.
6. Record incomplete or unavailable evidence in `unresolved`; keep acceptance open with an owner and next boundary, without adding a delivery hold. Ledger updates never alter delivery controls, schedules, ownership, independent holds or another role's pending question.
