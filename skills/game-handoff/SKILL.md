---
name: game-handoff
description: Move named games and kits, or all of them, between Claude and Codex in three modes. prepare winds the source down to a clean, idle stop; send starts the target sessions by registered ID; complete selects the target harness and activates it. Use game-sessions for same-harness recovery.
---

# Game handoff

`game-handoff prepare|send|complete` for `--scope ROLE|all...`. A game moves with its Art, Gameplay and Tech. game-coordinator runs every step. Other roles never invoke this skill: each gets its part as a stored message (`ck msg send`) and runs the verbs already in its brief.

`ck` is `node <root>/node_modules/@andornaut/coordination-kit/dist/cli.js --root <root>` and `dk G` is `DELIVERY_KIT_ROOT=<root> node <game>/node_modules/@andornaut/delivery-kit/dist/cli.js`, where `<root>` is the game-coordinator checkout. Never use npx. Read `var/registry.json` for IDs, worktrees and cwd; never create a duplicate owner.

Status: `ck handoff show [--id ID]`, `dk G status --game G`.

## prepare (source)

1. `ck handoff open --scope ... --to claude|codex`.
2. `ck msg send` each in-scope role this checklist. Each role completes it, then runs `ck handoff ready`, which sets its role hold:
   - approved work integrated into `main`; unfinished work on a named branch (record name and SHA), never discarded; parent-owned workers merged and removed, or parked by branch and SHA;
   - kits: never stop mid-release (tag, assets, verification and tag CI all done, or nothing pushed); record the last tag and SHA and any candidate (SHA, archive sha256);
   - promote anything the target needs out of scratch to the artifact store or a durable path;
   - record consumer adoption waits and who owes what;
   - close or retain inbox items; record open user questions with `ck question open` and holds with `ck hold set`;
   - release containers, workers and scratch; list operator-only leftovers with the exact command;
   - update `current.md`: state, branches, open work, next action.
3. Open user questions do not block prepare. When every role is ready, run `dk G runner stop --game G` for each game in scope (waits for idle and drained). Sessions cancel loops and crons they own.
4. `ck handoff state prepared --id ID`. Source sessions stay open and idle for rollback.

## send (source to target)

1. Check target quota. Codex: the TUI footer shows `weekly N% left`. At 0%, stay at `prepared`, report, and start nothing.
2. Start each target role session by its registered ID in tmux, with the existing session and window conventions and the registry cwd and worktree: `node scripts/sessions.mjs resume --role ROLE --harness TARGET --held`. The Codex launch is `codex resume --remote unix://<socket> --dangerously-bypass-approvals-and-sandbox -C <cwd> <id>`; `--remote` rejects `--add-dir`.
3. On a relaunched Claude session, confirm only the exact "Loading development channels" prompt: option 1 highlighted, the role channel listed, no draft text. Answer nothing else.
4. Start the target game-coordinator last with "run `game-handoff complete` for the scope". `ck handoff state sent --id ID`.

## complete (target)

1. game-coordinator: read the revision, then `ck harness select --harness TARGET --expected-revision N --role R|--game G` for the scope. This comes first: it fences the source out and lets the wake guard skip the handoff hold for the bound target.
2. `ck msg send` each target role its complete checklist, which also wakes it. The checklist: read `current.md`; `ck session start` (binding, checkpoint, questions, holds, inbox counts); verify `main` equals `origin/main` and kit tags and candidates against stored artifacts; reconcile pending questions as in [game-sessions](../game-sessions/SKILL.md#resume-existing-sessions); resume independent approved work; tell dependants who owns it now; `ck handoff active`, which releases its handoff hold. Other holds stay with their owners.
3. `dk G runner start --game G` for each game; check `status` shows one lock holder and a supported coordinator CLI. The next :30 review confirms coverage.
4. `ck msg send` COMPLETE to the source game-coordinator. Source sessions `/exit`; verify each frontend ended. `ck handoff state completed --id ID`.

## Rollback (before completed)

`ck handoff state cancelled --id ID`, `ck harness select` back to the source harness, `dk G runner start --game G` from the source install, and `/exit` any target frontend that was started.

Never touch another owner's pending question, the delivery-kit gate containers, or anything outside game-coordinator and its game and kit repositories. No tests, builds or releases run only to transfer ownership.
