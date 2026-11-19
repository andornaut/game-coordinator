import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  briefVerbs,
  catalogHash,
  commandVerbs,
  loadCatalog,
  main,
  renderBrief,
  renderRoleDocs,
  roleContract,
} from "../scripts/role-catalog.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const catalog = loadCatalog(root);
const context = {
  root: "/coordinator",
  role: "example-game/tech",
  harness: "codex",
  id: "existing-conversation",
  cwd: "/game",
  worktree: "/game/.worktrees/tech",
  registryRevision: 42,
  checkpoint: "/coordinator/var/handoffs/games/example-game/tech/current.md",
  held: true,
};

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), "role-catalog-"));
  try {
    mkdirSync(join(directory, "docs"));
    writeFileSync(join(directory, "roles.json"), JSON.stringify(catalog));
    run(directory);
  } finally {
    rmSync(directory, { recursive: true });
  }
}

test("role contracts resolve game ownership and shared kits without guessing unknown roles", () => {
  assert.deepEqual(Object.keys(catalog.roles), [
    "art",
    "gameplay",
    "tech",
    "art-kit",
    "game-kit",
    "delivery-kit",
    "coordination-kit",
    "game-coordinator",
  ]);
  for (const type of ["art", "gameplay", "tech"]) {
    assert.equal(roleContract(catalog, `Any_game.v2/${type}`).type, type);
    assert.equal(roleContract(catalog, type).scope, "game");
  }
  for (const type of [
    "art-kit",
    "game-kit",
    "delivery-kit",
    "coordination-kit",
  ]) {
    const contract = roleContract(catalog, type);
    assert.equal(contract.scope, "shared");
    assert.match(
      contract.owns.join(" "),
      /source, tests, documentation and checked publication/,
    );
    assert.match(contract.boundaries.join(" "), /[Nn]o game/);
  }
  for (const role of ["unknown", "game/design", "game/art/worker", ""])
    assert.throws(() => roleContract(catalog, role), /role|Role/);
});

test("catalog validation rejects missing ownership, unknown capabilities and unsupported schemas", () => {
  fixture((directory) => {
    for (const mutate of [
      (value) => {
        value.schema = 2;
      },
      (value) => {
        value.roles.tech.owns = [];
      },
      (value) => {
        value.roles.art.tools.required.push("invented-tool");
      },
      (value) => {
        value.roles.extra = value.roles.tech;
      },
    ]) {
      const value = structuredClone(catalog);
      mutate(value);
      writeFileSync(join(directory, "roles.json"), JSON.stringify(value));
      assert.throws(
        () => loadCatalog(directory),
        /Invalid|Unknown|known role types/,
      );
    }
  });
});

test("both harness briefs retain exact caller identity and holds without granting authority", () => {
  for (const harness of ["claude", "codex"]) {
    const brief = renderBrief(catalog, { ...context, harness });
    for (const value of [
      context.id,
      context.cwd,
      ".worktrees/tech under the native cwd",
      "var/handoffs/games/example-game/tech/current.md under COORDINATION_KIT_ROOT",
      "registry revision: 42",
      "Handoff HOLD: preserve",
    ])
      assert.ok(brief.includes(value));
    assert.match(
      brief,
      /grant no activation, write, publication or delivery authority/,
    );
    assert.match(
      brief,
      /preserve file ownership maps, WIP, unanswered questions and independent holds/,
    );
    assert.match(brief, /Desired tools, not installed proof/);
    assert.match(
      brief,
      /source READY, work ready and transport acceptance are not completion/,
    );
    const owners = brief.match(
      /^Shared kit owners \(purposes in docs\/roles\.md\): (.*)\.$/m,
    );
    assert.ok(owners, "shared kit owner line");
    for (const role of [
      "art-kit",
      "game-kit",
      "delivery-kit",
      "coordination-kit",
    ])
      assert.ok(owners[1].split(", ").includes(role), role);
    assert.ok(
      brief.includes(
        "COORDINATION_KIT_ROOT='/coordinator' node '/coordinator/node_modules/@andornaut/coordination-kit/dist/cli.js'",
      ),
    );
    for (const verb of [
      "`CK session start`",
      "`CK inbox --include-body`",
      "`CK msg send --to ROLE --body-file FILE`",
      "`CK msg done ID`",
      "`CK msg retain ID --reason TEXT --next-boundary TEXT`",
    ])
      assert.ok(brief.includes(verb), verb);
    assert.doesNotMatch(brief, /message (send|status|dispatch)|--from/);
    assert.doesNotMatch(
      brief,
      /--resume|--session-id|turn\/start|thread\/queue\/add/,
    );
  }
  const { id: _id, ...missing } = context;
  assert.throws(
    () => renderBrief(catalog, missing),
    /explicit startup context/,
  );
  assert.throws(
    () => renderBrief(catalog, { ...context, held: undefined }),
    /explicit startup context/,
  );
});

test("brief observations remain supplied evidence and retain unavailable tool state", () => {
  const contact = {
    role: "art-kit",
    harness: "claude",
    id: "retained-peer",
    cwd: "/art",
    worktree: "/art/.worktrees/coordinator",
    checkpoint: "/checkpoints/art.md",
  };
  const brief = renderBrief(catalog, {
    ...context,
    held: false,
    contacts: [contact],
    tools: [
      {
        id: "browser",
        status: "unavailable",
        reason: "native capability not inspected",
        required: false,
      },
    ],
  });
  assert.match(brief, /^Roles \(`CK msg send --to NAME`;.*\): art-kit\.$/m);
  assert.ok(
    !brief.includes("retained-peer"),
    "contact IDs stay in the registry",
  );
  assert.match(
    brief,
    /browser: unavailable; native capability not inspected; task-specific/,
  );
  assert.match(brief, /Handoff HOLD: none asserted\./);
  assert.throws(
    () =>
      renderBrief(catalog, {
        ...context,
        tools: [{ id: "invented", status: "available", required: true }],
      }),
    /tool observations/,
  );
  assert.throws(
    () =>
      renderBrief(catalog, { ...context, contacts: [{ ...contact, id: "" }] }),
    /role contacts/,
  );
});

test("catalog hash is semantic and changes with an ownership contract", () => {
  const reordered = Object.fromEntries(Object.entries(catalog).reverse());
  assert.match(catalogHash(catalog), /^[a-f0-9]{64}$/);
  assert.equal(catalogHash(reordered), catalogHash(catalog));
  const changed = structuredClone(catalog);
  changed.roles.tech.purpose += " Additional approved responsibility.";
  assert.notEqual(catalogHash(changed), catalogHash(catalog));
});

test("generated docs retain workflow boundaries, canonical references and actual checked output", () => {
  const docs = renderRoleDocs(catalog);
  assert.equal(readFileSync(join(root, "docs/roles.md"), "utf8"), docs);
  for (const reference of catalog.references)
    assert.ok(docs.includes(`](${reference.path.slice(5)})`));
  assert.match(docs, /After confirmed transfer: queue admission/);
  assert.match(
    docs,
    /Tech verifies interactions; item owner records evidence and finish/,
  );
  assert.match(docs, /existing runners execute game delivery gates/);
  assert.match(docs, /file ownership maps remain authoritative/);
  assert.doesNotMatch(
    docs + renderBrief(catalog, context),
    /AGENTS\.md|CLAUDE\.md|GEMINI\.md|\u2014/,
  );
});

const roles = [
  "example/art",
  "example/gameplay",
  "example/tech",
  "art-kit",
  "game-kit",
  "delivery-kit",
  "coordination-kit",
  "game-coordinator",
];
const retired =
  /\bepochs?\b|enrol|receipt|\bledger\b|accounting|\bmessage (?:send|dispatch|status|reconcile|retire-spool)\b|\binbox (?:snapshot|ack)\b|\bprotocol (?:boundary|claim|work)|\bnpx\b/i;

test("docs/roles.md and every role brief match what roles.json produces", () => {
  const onDisk = loadCatalog(root);
  assert.equal(
    readFileSync(join(root, "docs/roles.md"), "utf8"),
    renderRoleDocs(onDisk),
    "docs/roles.md is stale; run node scripts/role-catalog.mjs",
  );
  assert.doesNotMatch(renderRoleDocs(onDisk), retired);
  for (const role of roles) {
    const contract = roleContract(onDisk, role);
    const brief = renderBrief(onDisk, { ...context, role });
    for (const value of [
      contract.purpose,
      ...contract.owns,
      ...contract.boundaries,
      ...contract.handoffs,
      ...onDisk.protocol,
      ...onDisk.workflow.map((step) => `${step.stage} (${step.owner})`),
      `core ${contract.tools.required.join(", ")};`,
      `Catalog: ${catalogHash(onDisk).slice(0, 16)}`,
    ])
      assert.ok(brief.includes(value), `${role}: ${value}`);
    assert.doesNotMatch(brief, retired, role);
  }
});

test("every role brief stays within 60 lines and 4 KB with long absolute paths", () => {
  const coordinator =
    "/home/example-operator/src/github.com/example-organization/game-coordinator-main";
  const long = {
    root: coordinator,
    harness: "codex",
    id: "019a7f3e-5b2c-7d41-9e8f-0123456789ab",
    cwd: "/home/example-operator/src/github.com/example-organization/example-game-repository",
    worktree:
      "/home/example-operator/src/github.com/example-organization/example-game-worktrees",
    checkpoint: `${coordinator}/var/handoffs/games/example-game/gameplay/current.md`,
    registryRevision: 1234,
    held: true,
  };
  for (const path of [long.root, long.cwd, long.worktree])
    assert.ok(path.length >= 80, path);
  const games = ["ada-the-navigator", "archies-dog-walks", "chibis-way-home"];
  const contacts = [
    "game-coordinator",
    "art-kit",
    "coordination-kit",
    "delivery-kit",
    "game-kit",
    ...games.flatMap((game) =>
      ["art", "gameplay", "tech"].map((type) => `${game}/${type}`),
    ),
  ];
  // sessions.mjs gives game-coordinator every role, a game role the shared roles plus its own game, a kit the shared roles.
  const visible = (role) =>
    contacts
      .filter(
        (name) =>
          role === "game-coordinator" ||
          !name.includes("/") ||
          (["art", "gameplay", "tech"].includes(role) &&
            name.startsWith(`${games[0]}/`)),
      )
      .map((name) => ({
        role: name,
        harness: "claude",
        id: long.id,
        cwd: long.cwd,
        worktree: long.worktree,
        checkpoint: long.checkpoint,
      }));
  for (const role of roles) {
    const brief = renderBrief(catalog, {
      ...long,
      role,
      contacts: visible(role),
    });
    assert.ok(brief.includes(long.worktree), role);
    assert.ok(brief.split("\n").length - 1 <= 60, role);
    assert.ok(
      Buffer.byteLength(brief) <= 4096,
      `${role}: ${Buffer.byteLength(brief)} bytes`,
    );
  }
});

test("role briefs name only coordination-kit verbs the installed commands.md lists", () => {
  const known = commandVerbs(
    readFileSync(
      join(root, "node_modules/@andornaut/coordination-kit/docs/commands.md"),
      "utf8",
    ),
  );
  const common = [
    "session start",
    "inbox",
    "msg send",
    "msg done",
    "msg retain",
    "work start",
    "work evidence",
    "work block",
    "work ready",
    "work finish",
    "work show",
    "work history",
    "question open",
    "question answer",
    "question cancel",
    "hold set",
    "hold release",
    "hold list",
    "request close",
    "handoff ready",
    "handoff active",
    "handoff show",
    "status",
  ];
  for (const role of roles) {
    const verbs = briefVerbs(renderBrief(catalog, { ...context, role }));
    const expected =
      role === "game-coordinator"
        ? [...common, "handoff open", "handoff state"]
        : common;
    assert.deepEqual([...verbs].sort(), [...expected].sort(), role);
    for (const verb of verbs) assert.ok(known.has(verb), `${role}: ${verb}`);
  }
  assert.deepEqual(
    [
      ...commandVerbs(
        "## Command forms\n\n| `a b X`, `c [--d]` | x \\| y |\n| `--help` | z |\n",
      ),
    ],
    ["a b", "c"],
  );
  assert.ok(!known.has("message send") && !known.has("protocol boundary"));
  assert.deepEqual([...briefVerbs("`CK message send`")], ["message send"]);
});

test("generation and check distinguish missing or stale output without changing it", () => {
  fixture((directory) => {
    const args = ["--root", directory];
    assert.throws(() => main([...args, "--check"]), /stale/);
    main(args);
    const output = join(directory, "docs/roles.md");
    const expected = readFileSync(output, "utf8");
    main([...args, "--check"]);
    writeFileSync(output, expected + "changed\n");
    assert.throws(() => main([...args, "--check"]), /stale/);
    assert.equal(readFileSync(output, "utf8"), expected + "changed\n");
    main(args);
    assert.equal(readFileSync(output, "utf8"), expected);
    assert.throws(() => main(["--root", "--check"]), /Usage/);
    assert.throws(() => main(["--unknown"]), /Usage/);
  });
});

test("Gameplay preserves precise design decisions and distinct delivery evidence", () => {
  const contract = roleContract(catalog, "example/gameplay");
  const brief = renderBrief(catalog, { ...context, role: "example/gameplay" });
  assert.match(
    contract.owns.join(" "),
    /Precise approved rules, values and player copy/,
  );
  assert.match(brief, /existing design documents/);
  assert.match(brief, /Proposals and unresolved decisions/);
  assert.match(brief, /future source comparison/);
  assert.match(
    brief,
    /Exact native decision references in ignored local audit artifacts/,
  );
  assert.match(brief, /Pair design-document updates with implementation/);
  assert.match(
    brief,
    /reconcile superseded rules into a consistent current specification/,
  );
  assert.match(brief, /approval does not prove runtime behavior/);
  for (const state of [
    "proposed",
    "approved",
    "implemented",
    "checked",
    "integrated",
    "deployed",
    "accepted",
  ]) {
    assert.ok(catalog.protocol.some((rule) => rule.includes(state)));
  }
});
