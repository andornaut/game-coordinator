---
name: game-sessions
description: Recover existing game Art, Gameplay and Tech sessions and the shared kit and game-coordinator roles on their registered harness by exact session ID, or replace a closed game-coordinator session on the same harness. Use game-create for new games and game-handoff for harness transfers.
---

# Game sessions

Same-harness recovery only. Recovery never changes ownership or harness; a harness change is `game-handoff`.

`ck` is `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root>` and `dk G` is `DELIVERY_KIT_ROOT=<root> node <game>/node_modules/@andornaut/delivery-kit/dist/cli.js`, where `<root>` is the game-coordinator checkout. Never use npx.

## Identity and scope

- For exact-ID resume, use `.coordination-kit/registry.json` as the sole source of role IDs, worktrees and effective harnesses. Ask only about unresolved identity or scope.
- Recover only the selected roles; preserve every other owner. Every role's window lives in `claude-games` or `codex-games`: a game role is the first word of the game's name plus the role (`ada-tech`, `archie-art`), any other role is its name (`art-kit`, `game-coordinator`).
- Native cwd is the game root (game roles) or the game-coordinator root (kits, game-coordinator). Edit scope is `.worktrees/art|gameplay|tech` (games) or `.worktrees/coordinator` (kits). Keep their branches and WIP.

## Resume existing sessions

1. From game-coordinator run `node scripts/sessions.mjs plan --role ROLE` (repeat `--role`; `--root` selects the checkout). Planning is read-only. Slot states: `live` (exact frontend present, preserved), `missing`, `dead` (pane exited, or back at its shell with exact role, harness and ID markers), `blocked` (any other mismatch; preserve it and report).
2. Verify exact native IDs and cwd. Local process identity is not native proof. Use no picker, latest-session fallback or raw store.
3. `node scripts/sessions.mjs resume --role ROLE` starts only `missing` and `dead` slots, without an appended prompt. It owns quoting, the control socket, pane markers and grouping; do not duplicate its launch logic.
4. On a relaunched Claude session, confirm only the exact "Loading development channels" prompt: option 1 highlighted, the role channel listed, no draft text. A directory-trust prompt is the user's decision: leave it and report it; never press Enter blindly.
5. The resumed role runs `ck session start` to read its binding, checkpoint, pending questions, holds and inbox counts. A held role is refused (`session-held`); leave the hold to its owner. Preserve an open native form. If it is no longer shown, the owning session asks the recorded question again as a structured prompt with the same options. The recorded question stays pending until the owner records the user's explicit answer with `question answer`.

## Replace a closed game-coordinator session

An explicit same-harness replacement request authorizes changing the ID, nothing broader.

1. Verify the old ID natively. A closed conversation does not prove its frontend or jobs stopped; the old turn must be terminal or quiescent. Preserve its checkpoint, inbox and unanswered questions.
2. Verify the user-selected replacement's native identity, then attach it to the `game-coordinator` window and verify pane markers. If the old slot is still occupied, use a separate window and do not declare two active owners.
3. Update only this role's ID for the current harness through the revision-checked registry API. Preserve unknown fields.
4. The replacement runs `ck session start`, reconciles the old inbox with exact IDs and outcomes, and never copies old decisions as answers to new questions.
5. Check `dk G status --game G` for each game. Recovery may complete while scheduled coverage stays pending until the next genuine :30 review.

## Report

Each role restored, pending or blocked, with its verification limits. Never claim scheduled review coverage from frontend presence alone.
