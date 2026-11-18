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
  catalogHash,
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
      context.worktree,
      context.checkpoint,
      "registry revision: 42",
      "Handoff HOLD: preserve",
    ])
      assert.ok(brief.includes(value));
    assert.match(
      brief,
      /grants no activation, write, publication or delivery authority/,
    );
    assert.match(brief, /preserve independent holds and pending questions/);
    assert.match(brief, /Desired tools, not installed proof/);
    assert.match(
      brief,
      /Source READY and transport acceptance are not completion/,
    );
    for (const role of [
      "game-coordinator",
      "art-kit",
      "game-kit",
      "delivery-kit",
      "coordination-kit",
    ])
      assert.ok(brief.includes(`${role}: ${catalog.roles[role].purpose}`));
    assert.ok(
      brief.includes(
        "'/coordinator/node_modules/@andornaut/delivery-kit/dist/cli.js' --root '/coordinator'",
      ),
    );
    assert.ok(brief.includes("--recipient 'example-game/tech' --include-body"));
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
  assert.match(brief, /art-kit: claude\/retained-peer/);
  assert.match(
    brief,
    /browser: unavailable; native capability not inspected; task-specific/,
  );
  assert.match(
    brief,
    /Handoff HOLD: none asserted; preserve independent holds/,
  );
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
  assert.match(docs, /coordinator alone writes the approval ledger/);
  assert.match(docs, /existing runners execute game delivery gates/);
  assert.match(docs, /file ownership maps remain authoritative/);
  assert.doesNotMatch(
    docs + renderBrief(catalog, context),
    /AGENTS\.md|CLAUDE\.md|GEMINI\.md|\u2014/,
  );
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
