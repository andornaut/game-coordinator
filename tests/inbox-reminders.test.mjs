import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";

import { kitCommand, runInboxReminders } from "../scripts/inbox-reminders.mjs";

const ROLE = "chibis-way-home/gameplay";
const ID = "00000000-0000-4000-8000-0000000000a1";
const ORIGINAL = "00000000-0000-4000-8000-0000000000a2";
const SECOND = "00000000-0000-4000-8000-0000000000a3";
const ROOT = "/fixture/coordinator";
const CWD = resolve(ROOT, "../chibis-way-home");
const EMPTY = "Ask Codex to do anything";
const WAKE = `2 new messages for ${ROLE}: run coordination-kit inbox`;
const RECEIPT = {
  id: "00000000-0000-4000-8000-0000000000a4",
  role: ROLE,
  harness: "codex",
  nativeId: ID,
  originals: [ORIGINAL, SECOND],
  revision: 3,
};
const IN_FLIGHT = { id: RECEIPT.id, role: ROLE, originals: [ORIGINAL, SECOND] };

test("accepts the schema 2 reminder plan through the CLI adapter", async (t) => {
  const root = mkdtempSync(resolve(tmpdir(), "inbox-reminders-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dist = resolve(root, "node_modules/@andornaut/coordination-kit/dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    resolve(dist, "cli.js"),
    "console.log(JSON.stringify({ schema: 2, candidates: [], inFlight: [] }));\n",
  );

  assert.deepEqual(
    await runInboxReminders({ kit: (args) => kitCommand(root, args) }),
    { schema: 1, outcomes: [] },
  );
});

function fixture(options = {}) {
  const calls = [];
  const originals = options.originals ?? [ORIGINAL, SECOND];
  const deferredOriginals = options.deferredOriginals ?? [];
  const receipt = {
    ...RECEIPT,
    id: options.receiptId ?? RECEIPT.id,
    originals,
  };
  const defaultWake = `${originals.length} new messages for ${ROLE}: run coordination-kit inbox [${receipt.id}]`;
  const wake = options.notice ?? defaultWake;
  const registry = {
    harness: options.harness ?? "codex",
    host: { root: "." },
    revision: 3,
    roles: {
      [ROLE]: {
        conversations: { codex: ID, claude: ID },
        ownership: "active",
        phase: options.phase ?? "active",
        worktree: "../chibis-way-home/.worktrees/gameplay",
      },
    },
  };
  const config = {
    games: {
      "chibis-way-home": {
        name: "Chibi",
        path: "../chibis-way-home",
        roles: ["gameplay"],
      },
    },
  };
  const processList = [
    {
      pid: 211,
      ppid: 1,
      harness: "codex",
      id: ID,
      cwd: CWD,
      remoteRequested: false,
    },
  ];
  let input = options.initial ?? EMPTY;
  let transcript = [];
  let claims = 0;
  let checks = 0;
  let settled = false;
  const context = {
    layout: { config, root: ROOT },
    registry: () => registry,
    processes: () => processList,
    kit: (args) => {
      calls.push(args);
      switch (args[1]) {
        case "list":
          return {
            schema: options.listSchema ?? 2,
            inFlight: options.inFlight ?? [],
            candidates:
              options.candidates ??
              (settled || options.collected || options.inFlight
                ? []
                : [{ role: ROLE, originals, deferredOriginals }]),
          };
        case "claim":
          claims += 1;
          assert.deepEqual(args, [
            "reminder",
            "claim",
            "--role",
            ROLE,
            ...originals.flatMap((id) => ["--original", id]),
          ]);
          return {
            schema: options.claimSchema ?? 1,
            ...(options.omitNotice ? {} : { notice: wake }),
            receipt: { ...receipt, ...options.claim },
          };
        case "check":
          checks += 1;
          assert.deepEqual(args, ["reminder", "check", "--id", receipt.id]);
          if (options.checkFails === checks)
            throw new Error("original changed");
          if (options.changeBinding === checks) registry.revision += 1;
          return {
            schema: options.checkSchema ?? 1,
            receipt,
            nativeIdle: options.idle !== false,
          };
        case "settle":
          assert.deepEqual(args.slice(0, 4), [
            "reminder",
            "settle",
            "--id",
            receipt.id,
          ]);
          if (options.settlementLost)
            throw new Error("receipt write unavailable");
          settled = true;
          return {
            schema: options.settleSchema ?? 1,
            settlement: { id: receipt.id, outcome: args[5], reason: args[7] },
          };
        default:
          assert.fail(`Unexpected store command ${args[1]}`);
      }
    },
    tmux: (args) => {
      calls.push(args);
      switch (args[0]) {
        case "list-panes": {
          const main = `%8\tcodex-games\tchibi-gameplay\t0\t211\t${ROLE}\tcodex\t${ID}\tcodex\n`;
          return options.multiple
            ? main +
                `%9\tcodex-games\tchibi-gameplay\t0\t213\t${ROLE}\tcodex\t${ID}\tcodex\n`
            : main;
        }
        case "display-message":
          return (
            [
              "%8",
              "211",
              "codex",
              "0",
              options.modal ? "1" : "0",
              "0",
              "1",
              options.synchronized ? "1" : "0",
              String(options.width ?? 160),
              "30",
              String(
                (input === EMPTY ? 2 : input.length + 2) +
                  (options.caretOffset ?? 0),
              ),
              "24",
            ].join("\t") + "\n"
          );
        case "capture-pane": {
          assert.deepEqual(args, [
            "capture-pane",
            "-p",
            "-t",
            "%8",
            "-S",
            "18",
            "-E",
            "29",
          ]);
          return (
            [
              ...Array(4).fill(""),
              transcript.at(-1) ?? "",
              options.busy ? "• Working (esc to interrupt)" : "",
              `› ${input}`,
              "",
              ...(input === EMPTY ? [] : [""]),
              "  ~/fixture/chibis-way-home · main · GPT-6.2-Sol medium · weekly 100% left",
              "  ← for agents · ? for shortcuts             \u26a0 1 warning · f2 to view",
              ...(input === EMPTY ? [""] : []),
              "",
            ].join("\n") + "\n"
          );
        }
        case "if-shell": {
          assert.deepEqual(args.slice(0, 4), ["if-shell", "-F", "-t", "%8"]);
          assert.match(args[4], /synchronize-panes/);
          assert.match(args[4], /@agent-thread-id/);
          assert.match(args[4], /cursor_x/);
          assert.match(args[4], /#\{alternate_on\}/);
          assert.equal(args[6], "display-message -p reminder-refused");
          if (args[5].includes(" -l ")) {
            assert.equal(args[5], `send-keys -t %8 -l '${wake}'`);
            if (options.interlock) return "reminder-refused\n";
            input = options.insertChanged ? wake + " altered" : wake;
          } else {
            assert.equal(args[5], "send-keys -t %8 Enter");
            assert.equal(input, wake);
            if (!options.submitUncertain) {
              transcript = [`› ${input}`];
              input = EMPTY;
            }
          }
          return "";
        }
        default:
          assert.fail(`Unexpected tmux command ${args[0]}`);
      }
    },
    wait: async (ms) => {
      calls.push(["wait", ms]);
    },
  };
  return {
    context,
    calls,
    writes: () => calls.filter((args) => args[0] === "if-shell"),
    claimCount: () => claims,
  };
}

test("batches exact originals, rechecks the sole draft, and records one submitted wake", async () => {
  const { context, calls, writes, claimCount } = fixture();
  assert.deepEqual(await runInboxReminders(context), {
    schema: 1,
    outcomes: [
      {
        originals: [ORIGINAL, SECOND],
        outcome: "submitted",
        pane: "%8",
        reason: "exact-wake-observed",
        receipt: RECEIPT.id,
        role: ROLE,
        settlement: "recorded",
      },
    ],
  });
  assert.equal(claimCount(), 1);
  assert.deepEqual(
    calls
      .filter((args) => args[0] === "reminder" || args[0] === "if-shell")
      .map((args) => (args[0] === "if-shell" ? args[5] : args[1])),
    [
      "list",
      "claim",
      "check",
      `send-keys -t %8 -l '${WAKE} [${RECEIPT.id}]'`,
      "check",
      "send-keys -t %8 Enter",
      "settle",
    ],
  );
  assert.deepEqual(await runInboxReminders(context), {
    schema: 1,
    outcomes: [],
  });
  assert.equal(writes().length, 2);
});

test("submits the fixed notice with its exact claim ID", async () => {
  const notice = `${WAKE} [${ID}]`;
  const { context, writes } = fixture({ notice, receiptId: ID });
  const { outcomes } = await runInboxReminders(context);
  assert.equal(outcomes[0].outcome, "submitted");
  assert.equal(writes()[0][5], `send-keys -t %8 -l '${notice}'`);
});

for (const [name, options, reason] of [
  ["a missing claim notice", { omitNotice: true }, "store-notice-mismatch"],
  [
    "a changed claim ID",
    { notice: `${WAKE} [${SECOND}]` },
    "store-notice-mismatch",
  ],
  ["a narrow pane", { width: 80 }, "composer-width-unverified"],
]) {
  test(`settles without typing for ${name}`, async () => {
    const { context, writes } = fixture(options);
    const { outcomes } = await runInboxReminders(context);
    assert.equal(outcomes[0].outcome, "refused");
    assert.equal(outcomes[0].reason, reason);
    assert.equal(outcomes[0].settlement, "recorded");
    assert.equal(writes().length, 0);
  });
}

for (const [name, options] of [
  ["a nonempty draft", { initial: "Unrelated draft" }],
  ["a paste marker", { initial: "[Paste #1 +2 lines]" }],
  ["an off-composer cursor", { caretOffset: 1 }],
  ["a running turn indicator", { busy: true }],
  ["a modal", { modal: true }],
  ["synchronized pane input", { synchronized: true }],
  ["ambiguous pane identity", { multiple: true }],
  ["a held recipient", { phase: "held" }],
  ["an unsupported Claude frontend", { harness: "claude" }],
]) {
  test(`refuses ${name} before claiming or typing`, async () => {
    const instance = fixture(options);
    const { outcomes } = await runInboxReminders(instance.context);
    assert.equal(outcomes[0].outcome, "refused");
    assert.equal(outcomes[0].settlement, "not-claimed");
    assert.equal(instance.claimCount(), 0);
    assert.equal(instance.writes().length, 0);
  });
}

test("leaves an already collected original outside the executor", async () => {
  const { context, calls } = fixture({ collected: true });
  assert.deepEqual(await runInboxReminders(context), {
    schema: 1,
    outcomes: [],
  });
  assert.deepEqual(calls, [["reminder", "list"]]);
});

test("reports an interrupted claim for reconciliation without typing", async () => {
  const { context, calls } = fixture({ inFlight: [IN_FLIGHT] });
  assert.deepEqual(await runInboxReminders(context), {
    schema: 1,
    inFlight: [
      { originals: [ORIGINAL, SECOND], receipt: RECEIPT.id, role: ROLE },
    ],
    outcomes: [],
  });
  assert.deepEqual(calls, [["reminder", "list"]]);
});

test("forwards the kit's entire ordered batch and reports separate deferred IDs", async () => {
  const originals = [SECOND, "legacy-message:7", ORIGINAL];
  const deferredOriginals = ["legacy-message:8", "legacy-message:9"];
  const { context, writes } = fixture({ originals, deferredOriginals });
  const { outcomes } = await runInboxReminders(context);
  assert.equal(outcomes[0].outcome, "submitted");
  assert.deepEqual(outcomes[0].originals, originals);
  assert.deepEqual(outcomes[0].deferredOriginals, deferredOriginals);
  assert.equal(writes().length, 2);
  assert.match(writes()[0][5], /3 new messages/);
});

test("rejects a receipt that reorders the kit's originals before typing", async () => {
  const { context, writes } = fixture({
    claim: { originals: [SECOND, ORIGINAL] },
  });
  const { outcomes } = await runInboxReminders(context);
  assert.equal(outcomes[0].reason, "store-receipt-mismatch");
  assert.equal(outcomes[0].settlement, "claim-unverified");
  assert.equal(writes().length, 0);
});

const CANDIDATE = { role: ROLE, originals: [ORIGINAL], deferredOriginals: [] };
for (const [name, options, reason] of [
  [
    "duplicate recipient",
    { candidates: [CANDIDATE, CANDIDATE] },
    "store-candidate-invalid",
  ],
  [
    "claimed and deferred overlap",
    { candidates: [{ ...CANDIDATE, deferredOriginals: [ORIGINAL] }] },
    "store-original-invalid",
  ],
  [
    "original assigned to different recipients",
    { candidates: [CANDIDATE, { ...CANDIDATE, role: "chibis-way-home/tech" }] },
    "store-original-invalid",
  ],
  [
    "fresh original already in flight",
    {
      inFlight: [IN_FLIGHT],
      candidates: [{ ...CANDIDATE, role: "chibis-way-home/tech" }],
    },
    "store-original-invalid",
  ],
  [
    "invalid in-flight receipt ID",
    { inFlight: [{ ...IN_FLIGHT, id: "not-a-uuid" }] },
    "store-reconciliation-unavailable",
  ],
  ["old list schema", { listSchema: 1 }, "store-plan-schema-unverified"],
  [
    "old list shape",
    { candidates: [{ role: ROLE, originals: [{ id: ORIGINAL }] }] },
    "store-original-invalid",
  ],
]) {
  test(`rejects a kit plan with ${name} before claiming or typing`, async () => {
    const { calls, context } = fixture(options);
    await assert.rejects(runInboxReminders(context), { message: reason });
    assert.deepEqual(calls, [["reminder", "list"]]);
  });
}

test("leaves an unsupported claim response unverified without typing", async () => {
  const { context, writes } = fixture({ claimSchema: 2 });
  const { outcomes } = await runInboxReminders(context);
  assert.equal(outcomes[0].reason, "store-claim-unavailable");
  assert.equal(outcomes[0].settlement, "claim-unverified");
  assert.equal(writes().length, 0);
});

test("reports an unsupported settlement response as unavailable", async () => {
  const { context, writes } = fixture({ settleSchema: 2 });
  const { outcomes } = await runInboxReminders(context);
  assert.equal(outcomes[0].outcome, "submitted");
  assert.equal(outcomes[0].settlement, "unavailable");
  assert.equal(writes().length, 2);
});

for (const [name, options, reason] of [
  ["changed exact originals", { checkFails: 1 }, "store-recheck-unavailable"],
  [
    "an unsupported check response",
    { checkSchema: 2 },
    "store-recheck-unavailable",
  ],
  ["unavailable idle evidence", { idle: false }, "native-idle-unverified"],
  ["a rotated registry revision", { changeBinding: 1 }, "pane-binding-changed"],
  ["the final pane interlock", { interlock: true }, "pane-input-unverified"],
]) {
  test(`settles a refusal for ${name} before submission`, async () => {
    const { context, calls, writes } = fixture(options);
    const { outcomes } = await runInboxReminders(context);
    assert.equal(outcomes[0].outcome, "refused");
    assert.equal(outcomes[0].reason, reason);
    assert.equal(outcomes[0].settlement, "recorded");
    assert.equal(writes().length, options.interlock ? 1 : 0);
    assert.ok(
      calls.some((args) => args[1] === "settle" && args[5] === "refused"),
    );
  });
}

for (const [name, options, expectedWrites] of [
  ["changed literal draft", { insertChanged: true }, 1],
  ["original changed after insertion", { checkFails: 2 }, 1],
  ["unchanged draft after Enter", { submitUncertain: true }, 2],
]) {
  test(`records uncertainty for ${name} without retrying any key`, async () => {
    const { context, writes } = fixture(options);
    const { outcomes } = await runInboxReminders(context);
    assert.equal(outcomes[0].outcome, "uncertain");
    assert.equal(outcomes[0].settlement, "recorded");
    assert.equal(writes().length, expectedWrites);
    assert.deepEqual(await runInboxReminders(context), {
      schema: 1,
      outcomes: [],
    });
    assert.equal(writes().length, expectedWrites);
  });
}

test("reports an unavailable settlement without attempting another wake", async () => {
  const { context, writes } = fixture({ settlementLost: true });
  const { outcomes } = await runInboxReminders(context);
  assert.equal(outcomes[0].outcome, "submitted");
  assert.equal(outcomes[0].settlement, "unavailable");
  assert.equal(writes().length, 2);
});
