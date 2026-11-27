import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  statSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  identity,
  launchArgs,
  marker,
  plan,
  quote,
} from "../scripts/session-plan.mjs";
import {
  controlSocket,
  inspectPanes,
  main,
  startupBrief,
  orientationId,
  queueOrientation,
  roleChannel,
  processes,
  resumeLock,
  resumeSlot,
  runnerSocket,
  sortWindows,
} from "../scripts/sessions.mjs";

import { loadCatalog } from "../scripts/role-catalog.mjs";
import {
  installedMessaging,
  probeBinary,
  roleTools,
} from "../scripts/role-tools.mjs";

const id = "12345678-1234-1234-1234-123456789abc";
const target = "abcdefab-1234-1234-1234-123456789abc";
const config = {
  games: { game: { name: "Gizmo the Fixture", path: "../game" } },
};
const registry = {
  revision: 14,
  harness: "codex",
  host: { root: ".", nativeProjectId: "fixture-project" },
  roles: {
    "game-coordinator": {
      worktree: ".",
      conversations: { codex: id, claude: target },
    },
    "game/art": {
      worktree: "../game/.worktrees/art",
      harness: "claude",
      conversations: { claude: target, codex: id },
    },
  },
};
const options = { roles: ["game-coordinator"], config };
const frontend = {
  pid: 42,
  ppid: 41,
  harness: "codex",
  id,
  remoteRequested: true,
  cwd: "/repo",
};
const pane = {
  pane: "%1",
  session: "codex-games",
  name: "game-coordinator",
  dead: false,
  role: "game-coordinator",
  harness: "codex",
  id,
  frontends: [frontend],
};
const slot = () => plan("/repo", registry, options, [], [])[0];

test("selection is explicit, sorted and uses each effective harness", () => {
  assert.throws(() => plan("/repo", registry, {}, [], []), /Select/);
  assert.throws(
    () => plan("/repo", registry, { roles: ["unknown"] }, [], []),
    /registered role/,
  );
  const slots = plan(
    "/repo",
    registry,
    { roles: ["game/art", "game-coordinator", "game/art"], config },
    [],
    [],
  );
  assert.deepEqual(
    slots.map((s) => [s.role, s.harness, s.session, s.name, s.cwd]),
    [
      ["game-coordinator", "codex", "codex-games", "game-coordinator", "/repo"],
      ["game/art", "claude", "claude-games", "gizmo-art", "/game"],
    ],
  );
});

test("canonical native roots differ from role worktrees for games and kits", () => {
  const value = structuredClone(registry);
  value.roles["art-kit"] = {
    worktree: "../art-kit/.worktrees/coordinator",
    conversations: { codex: target },
  };
  const slots = plan(
    "/repo",
    value,
    { roles: ["game/art", "art-kit"], config },
    [],
    [],
  );
  assert.deepEqual(
    slots.map((s) => [s.cwd, s.worktree]),
    [
      ["/repo", "/art-kit/.worktrees/coordinator"],
      ["/game", "/game/.worktrees/art"],
    ],
  );
  const game = slots[1];
  assert.equal(
    plan(
      "/repo",
      value,
      { roles: ["game/art"], config },
      [
        {
          ...pane,
          name: "art",
          session: "claude-games",
          role: "game/art",
          harness: "claude",
          id: target,
          frontends: [{ harness: "claude", id: target, cwd: "/game" }],
        },
      ],
      [],
    )[0].state,
    "live",
  );
  // Claude launches in the game root; a worktree in another directory would raise a trust prompt.
  const args = launchArgs(game, "/socket");
  assert.equal(args.includes("--add-dir"), false);
  assert.equal(args.includes(game.worktree), false);
  assert.equal(args.includes("--dangerously-skip-permissions"), true);
});

test("coordinator windows omit harness prefixes while sessions retain them", () => {
  for (const harness of ["codex", "claude"]) {
    const value = structuredClone(registry);
    value.harness = harness;
    value.roles["art-kit"] = {
      worktree: "../art-kit/.worktrees/coordinator",
      conversations: { codex: target, claude: id },
    };
    const slots = plan(
      "/game-coordinator",
      value,
      { roles: ["game-coordinator", "art-kit"], config },
      [],
      [],
    );
    assert.deepEqual(
      slots.map((s) => [s.role, s.session, s.name, s.cwd]),
      [
        ["art-kit", `${harness}-games`, "art-kit", "/game-coordinator"],
        [
          "game-coordinator",
          `${harness}-games`,
          "game-coordinator",
          "/game-coordinator",
        ],
      ],
    );
    assert.equal(slots[1].id, harness === "codex" ? id : target);
    const current = slots[1];
    const existing = { ...frontend, harness, id: current.id, cwd: current.cwd };
    const live = plan(
      "/game-coordinator",
      value,
      { roles: [current.role], config },
      [
        {
          ...pane,
          session: current.session,
          name: current.name,
          harness,
          id: current.id,
          frontends: [existing],
        },
      ],
      [existing],
    )[0];
    assert.equal(live.state, "live");
    assert.equal(
      resumeSlot(live, "/socket", null, () => assert.fail("live pane mutation"))
        .action,
      "preserved",
    );
  }
});

test("CLI parser passes layout config and resolves --root independently of caller cwd", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "sessions-cli-"));
  t.after(() => rmSync(dir, { recursive: true }));
  const root = join(dir, "repo");
  mkdirSync(join(root, "var"), { recursive: true });
  mkdirSync(join(dir, "game/.worktrees/art"), { recursive: true });
  writeFileSync(
    join(root, "config.json"),
    JSON.stringify({
      schema: 1,
      timezone: "America/Toronto",
      wakeMinutes: [],
      games: { game: { name: "Game", path: "../game", roles: ["art"] } },
      kits: {},
      sharedRoles: ["game-coordinator"],
    }),
  );
  writeFileSync(
    join(root, "var/registry.json"),
    JSON.stringify({
      ...registry,
      schema: 1,
      updatedAt: "2026-11-12T00:00:00Z",
      roles: Object.fromEntries(
        Object.entries(registry.roles).map(([role, record]) => [
          role,
          { ...record, ownership: role.replace("/", "-") },
        ]),
      ),
      operations: {},
      transfers: [],
    }),
  );
  writeFileSync(
    join(root, "roles.json"),
    readFileSync(new URL("../roles.json", import.meta.url)),
  );
  let output;
  await main(
    {
      tools: () => ({ launchIssues: [], capabilities: [] }),
      processes: () => [],
      panes: () => [],
      socketAvailable: async () => true,
      output: (value) => {
        output = JSON.parse(value);
      },
    },
    ["plan", "--root", root, "--role", "game/art"],
  );
  assert.equal(output.slots[0].cwd, join(dir, "game"));
  assert.equal(output.slots[0].worktree, join(dir, "game/.worktrees/art"));
  assert.equal(output.slots[0].state, "missing");
});

test("socket override is explicit, absolute and fails closed when invalid", () => {
  assert.equal(
    controlSocket({ CODEX_CONTROL_SOCKET: "/explicit/socket" }),
    "/explicit/socket",
  );
  assert.equal(
    controlSocket({ HOME: "/home/user" }),
    "/home/user/.codex/app-server-control/app-server-control.sock",
  );
  for (const value of ["", "relative/socket"])
    assert.throws(
      () => controlSocket({ CODEX_CONTROL_SOCKET: value }),
      /absolute/,
    );
});

test("Claude role channel requires installed CLI and preserves immutable owned config", (t) => {
  const root = mkdtempSync(join(tmpdir(), "sessions-channel-"));
  t.after(() => rmSync(root, { recursive: true }));
  const current = { ...slot(), harness: "claude", id: target };
  assert.throws(
    () => roleChannel(root, false, current),
    /installed coordination-kit/,
  );
  mkdirSync(join(root, "node_modules/@andornaut/coordination-kit/dist"), {
    recursive: true,
  });
  writeFileSync(
    join(root, "node_modules/@andornaut/coordination-kit/dist/cli.js"),
    "",
  );
  const configured = roleChannel(root, true, current);
  const args = launchArgs(configured, "/socket");
  assert.equal(args.includes("--mcp-config"), true);
  assert.equal(args.includes("--strict-mcp-config"), false);
  assert.equal(args.includes("--dangerously-load-development-channels"), true);
  assert.equal(
    roleChannel(root, false, current).channelConfig,
    configured.channelConfig,
  );
  writeFileSync(configured.channelConfig, "{}");
  assert.throws(() => roleChannel(root, true, current), /exact owned match/);
});

for (const [role, conversation] of [
  ["game-coordinator", id],
  ["art-kit", target],
  ["game/art", "abcdefab-1234-1234-1234-123456789abd"],
]) {
  test(`Claude channel binds exact identity for ${role} without changing startup authority`, (t) => {
    const root = mkdtempSync(join(tmpdir(), "sessions-role-channel-"));
    t.after(() => rmSync(root, { recursive: true }));
    const cli = join(
      root,
      "node_modules/@andornaut/coordination-kit/dist/cli.js",
    );
    mkdirSync(join(root, "node_modules/@andornaut/coordination-kit/dist"), {
      recursive: true,
    });
    writeFileSync(cli, "");
    const current = { ...slot(), role, harness: "claude", id: conversation };
    const configured = roleChannel(root, true, current);
    assert.deepEqual(configured, {
      ...current,
      channelConfig: join(
        root,
        `var/session-frontends/${conversation}.mcp.json`,
      ),
    });
    const expected = {
      mcpServers: {
        "delivery-kit-monitor": {
          command: process.execPath,
          args: [
            cli,
            "--root",
            root,
            "claude",
            "channel",
            "--conversation",
            conversation,
          ],
        },
      },
    };
    assert.equal(
      readFileSync(configured.channelConfig, "utf8"),
      JSON.stringify(expected, null, 2) + "\n",
    );
    assert.equal(statSync(configured.channelConfig).mode & 0o777, 0o600);
    assert.equal(
      roleChannel(root, false, current).channelConfig,
      configured.channelConfig,
    );
    const args = launchArgs(configured, "/socket");
    assert.equal(args[args.indexOf("--resume") + 1], conversation);
    assert.equal(
      args[args.indexOf("--mcp-config") + 1],
      configured.channelConfig,
    );
    assert.equal(
      args.includes("--dangerously-load-development-channels"),
      true,
    );
    assert.equal(args.includes("--strict-mcp-config"), false);
    assert.equal(args.includes("--remote-control"), true);
    assert.equal(
      readFileSync(configured.channelConfig, "utf8").includes("/socket"),
      false,
    );
  });
}

test("Codex roles do not require or create Claude channel configuration", (t) => {
  const root = mkdtempSync(join(tmpdir(), "sessions-codex-channel-"));
  t.after(() => rmSync(root, { recursive: true }));
  for (const role of ["game-coordinator", "art-kit", "game/art"]) {
    const current = { ...slot(), role };
    assert.equal(roleChannel(root, true, current), current);
  }
});

test("Claude channel refuses a symlink config without changing its target", (t) => {
  const root = mkdtempSync(join(tmpdir(), "sessions-channel-link-"));
  t.after(() => rmSync(root, { recursive: true }));
  mkdirSync(join(root, "node_modules/@andornaut/coordination-kit/dist"), {
    recursive: true,
  });
  writeFileSync(
    join(root, "node_modules/@andornaut/coordination-kit/dist/cli.js"),
    "",
  );
  mkdirSync(join(root, "var/session-frontends"), { recursive: true });
  const original = join(root, "original.json");
  writeFileSync(original, "private fixture");
  symlinkSync(original, join(root, `var/session-frontends/${target}.mcp.json`));
  assert.throws(
    () =>
      roleChannel(root, true, {
        ...slot(),
        role: "game/art",
        harness: "claude",
        id: target,
      }),
    /exact owned match/,
  );
  assert.equal(readFileSync(original, "utf8"), "private fixture");
});

test("resume lock excludes concurrent helpers across an await and releases on descriptor close", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "sessions-lock-"));
  t.after(() => rmSync(root, { recursive: true }));
  const path = join(root, "lock");
  await resumeLock(path, async () => {
    await Promise.resolve();
    await assert.rejects(
      () => resumeLock(path, () => assert.fail("duplicate lock")),
      /lock unavailable/,
    );
  });
  assert.equal(await resumeLock(path, () => "released"), "released");
});

test("marker repair changes metadata only on exact live child and is retry-idempotent", () => {
  const current = plan(
    "/repo",
    registry,
    options,
    [{ ...pane, role: "", harness: "", id: "" }],
    [frontend],
  )[0];
  const calls = [];
  assert.equal(
    resumeSlot(current, "/socket", null, (args) => calls.push(args)).action,
    "markers-repaired",
  );
  assert.equal(
    calls.every((args) => args[0] === "set-option" && args[1] === "-p"),
    true,
  );
  const repaired = plan("/repo", registry, options, [pane], [frontend])[0];
  resumeSlot(repaired, "/socket", null, () => assert.fail("repeat mutation"));
});

test("alphabetical insertion swaps only known windows and leaves unknown windows fixed", () => {
  const calls = [];
  const value = structuredClone(registry);
  value.roles["art-kit"] = {};
  sortWindows(value, config, slot(), (args) => {
    calls.push(args);
    return args[0] === "list-panes"
      ? "@1\t1\tgame-coordinator\tgame-coordinator\tcodex\n@2\t2\tscratch\t\t\n@3\t3\tart-kit\tart-kit\tcodex"
      : "";
  });
  assert.deepEqual(calls.slice(1), [["swap-window", "-s", "@3", "-t", "@1"]]);
});

test("local-only matching live frontend is preserved without claiming remote requested", () => {
  const current = plan(
    "/repo",
    registry,
    options,
    [{ ...pane, frontends: [{ ...frontend, remoteRequested: false }] }],
    [],
  )[0];
  assert.equal(current.state, "live");
  assert.equal(current.remoteRequested, false);
  assert.equal(
    identity("/socket", ["codex", "resume", id]).remoteRequested,
    false,
  );
  assert.equal(
    identity("/socket", ["codex", "resume", "--remote", "unix:///wrong", id])
      .remoteRequested,
    false,
  );
  assert.equal(
    identity("/socket", ["claude", "--resume", id]).remoteRequested,
    false,
  );
  assert.equal(
    identity("/socket", [
      "claude",
      "--session-id",
      id,
      "--remote-control",
      "role",
    ]).id,
    id,
  );
  assert.equal(
    resumeSlot(current, "/socket", null, () => assert.fail("must preserve"))
      .action,
    "preserved",
  );
});

test("different harness preparation requires explicit held assertion and an existing ID", () => {
  assert.throws(
    () => plan("/repo", registry, { ...options, harness: "claude" }, [], []),
    /--held/,
  );
  assert.equal(
    plan(
      "/repo",
      registry,
      { ...options, harness: "claude", held: true },
      [],
      [],
    )[0].id,
    target,
  );
  const missing = structuredClone(registry);
  delete missing.roles["game-coordinator"].conversations.codex;
  assert.throws(() => plan("/repo", missing, options, [], []), /no registered/);
});

test("exact live child establishes identity even without pane markers", () => {
  const unmarked = { ...pane, role: "", harness: "", id: "" };
  assert.equal(
    plan("/repo", registry, options, [unmarked], [frontend])[0].state,
    "live",
  );
  assert.equal(
    plan("/repo", registry, options, [{ ...unmarked, frontends: [] }], [])[0]
      .state,
    "blocked",
  );
});

test("conflicts, duplicate owners and foreign live slots are never resumed", () => {
  for (const [panes, owners] of [
    [[pane, { ...pane, pane: "%2" }], [frontend]],
    [[pane], [frontend, { ...frontend, pid: 43 }]],
    [[{ ...pane, id: target }], [frontend]],
    [[{ ...pane, frontends: [{ ...frontend, cwd: "/wrong" }] }], []],
    [[], [frontend]],
    [[{ ...pane, shell: true, frontends: [] }], [frontend]],
    [[{ ...pane, frontends: [{ ...frontend, id: target }] }], []],
  ])
    assert.equal(
      plan("/repo", registry, options, panes, owners)[0].state,
      "blocked",
    );
});

test("dead exact slots require all identity markers", () => {
  assert.equal(
    plan(
      "/repo",
      registry,
      options,
      [{ ...pane, dead: true, frontends: [] }],
      [],
    )[0].state,
    "dead",
  );
  assert.equal(
    plan(
      "/repo",
      registry,
      options,
      [{ ...pane, dead: true, role: "", frontends: [] }],
      [],
    )[0].state,
    "blocked",
  );
});

test("exact marked pane back at its shell is dead; other live mismatches stay blocked", () => {
  const shell = { ...pane, shell: true, frontends: [] };
  const exact = plan("/repo", registry, options, [shell], [])[0];
  assert.equal(exact.state, "dead");
  assert.equal(exact.shell, true);
  for (const variant of [
    { ...shell, shell: false },
    { ...shell, role: "" },
    { ...shell, harness: "claude" },
    { ...shell, id: target },
    { ...shell, frontends: [{ ...frontend, id: target }] },
  ])
    assert.equal(
      plan("/repo", registry, options, [variant], [])[0].state,
      "blocked",
    );
  const deadPane = plan(
    "/repo",
    registry,
    options,
    [{ ...pane, dead: true, frontends: [] }],
    [],
  )[0];
  assert.equal(deadPane.shell, undefined);
  const calls = [];
  for (const current of [exact, deadPane])
    resumeSlot(current, "/managed/socket", null, (args) => {
      calls.push(args);
      return "";
    });
  const respawns = calls.filter((args) => args[0] === "respawn-pane");
  assert.deepEqual(
    respawns.map((args) => args.includes("-k")),
    [true, false],
  );
});

test("safe marker is deterministic, revision-sensitive and bounded for slash/plus inputs", () => {
  const value = marker(14, "game/art+copy", "codex", id);
  assert.match(value, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
  assert.equal(value, marker(14, "game/art+copy", "codex", id));
  assert.notEqual(value, marker(15, "game/art+copy", "codex", id));
});

test("POSIX quoting roundtrips arbitrary arguments without evaluation", () => {
  const args = [
    "spaces here",
    "single'quote",
    "$(exit 9)",
    "`exit 8`",
    "line\nbreak",
    "+slash/name",
  ];
  const output = execFileSync("/bin/sh", [
    "-c",
    `printf '%s\\0' ${args.map(quote).join(" ")}`,
  ]);
  assert.deepEqual(output.toString().split("\0").slice(0, -1), args);
});

test("resume argv contains exact ID and no new-session flag or appended prompt", () => {
  const codex = launchArgs(slot(), "/managed/socket");
  assert.deepEqual(codex, [
    "codex",
    "resume",
    "--remote",
    "unix:///managed/socket",
    "--dangerously-bypass-approvals-and-sandbox",
    "-C",
    "/repo",
    id,
  ]);
  const claude = launchArgs(
    { ...slot(), harness: "claude" },
    "/managed/socket",
  );
  assert.deepEqual(claude, [
    "claude",
    "--resume",
    id,
    "--name",
    "game-coordinator",
    "--remote-control",
    "game-coordinator",
    "--model",
    "claude-opus-5-5",
    "--dangerously-skip-permissions",
  ]);
  assert.equal(identity("/managed/socket", codex).id, id);
  assert.equal(identity("/managed/socket", codex).remoteRequested, true);
  assert.equal(identity("/managed/socket", claude).id, id);
  assert.equal(identity("/socket", ["codex", "app-server"]), null);
  assert.equal(identity("/socket", ["bash", "-c", codex.join(" ")]), null);
});

test("a new Claude conversation launches with its registered ID as --session-id", () => {
  const created = launchArgs(
    { ...slot(), harness: "claude", create: true },
    "/managed/socket",
  );
  assert.deepEqual(created.slice(0, 3), ["claude", "--session-id", id]);
  assert.equal(created.includes("--resume"), false);
  assert.equal(identity("/managed/socket", created).id, id);
});

test("--new is limited to resuming Claude slots", async (t) => {
  await assert.rejects(main({}, ["plan", "--new"]), /only with resume/);
  const { root } = startupFixture(t);
  await assert.rejects(
    main(
      {
        tools: availableTools,
        processes: () => [],
        panes: () => [],
        tmux: () => assert.fail("rejected --new touched tmux"),
      },
      ["resume", "--new", "--root", root, "--role", "game-coordinator"],
    ),
    /only Claude/,
  );
  const path = join(root, "var/registry.json");
  writeFileSync(
    path,
    JSON.stringify({
      ...JSON.parse(readFileSync(path, "utf8")),
      harness: "claude",
    }),
  );
  const cli = join(root, "node_modules/@andornaut/coordination-kit/dist");
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(cli, "cli.js"), "");
  const launches = [];
  await main(
    {
      tools: availableTools,
      processes: () => [],
      panes: () => [],
      socketAvailable: async () => false,
      tmux: (args) => {
        if (args[0] === "new-session") launches.push(args.at(-1));
        return args[0] === "new-session" ? "%1" : "";
      },
      output: () => {},
    },
    ["resume", "--new", "--held", "--root", root, "--role", "game-coordinator"],
  );
  assert.equal(launches.length, 1);
  assert.match(launches[0], new RegExp(`'--session-id' '${target}'`));
  assert.doesNotMatch(launches[0], /'--resume'/);
});

test("Bash wrapper descendants are inspected without pane_start_command or terminal contents", () => {
  const all = [
    { pid: 40, ppid: 1 },
    { pid: 41, ppid: 40 },
    frontend,
    { ...frontend, pid: 99, ppid: 1 },
  ];
  const panes = inspectPanes(all, (args) => {
    assert.equal(args.includes("capture-pane"), false);
    assert.equal(args.join(" ").includes("pane_start_command"), false);
    return "%1\tcodex-games\tgame-coordinator\t0\t40\t\t\t\tcodex\n%2\tcodex-games\tshell\t0\t50\t\t\t\tbash";
  });
  assert.deepEqual(panes[0].frontends, [frontend]);
  assert.deepEqual(
    panes.map((p) => p.shell),
    [false, true],
  );
  assert.equal(
    plan("/repo", registry, options, panes, [frontend])[0].state,
    "live",
  );
});

test("process snapshot follows exact argv identity and CWD only", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "session-proc-"));
  t.after(() => rmSync(dir, { recursive: true }));
  mkdirSync(join(dir, "42"));
  writeFileSync(join(dir, "42/stat"), "42 (codex) S 41 0");
  writeFileSync(
    join(dir, "42/cmdline"),
    ["codex", "resume", "--remote", "unix:///socket", id, ""].join("\0"),
  );
  symlinkSync("/repo", join(dir, "42/cwd"));
  assert.deepEqual(processes(dir, "/socket"), [frontend]);
  mkdirSync(join(dir, "43"));
  writeFileSync(join(dir, "43/stat"), "43 (unrelated name) S 1 0");
  assert.deepEqual(processes(dir, "/socket"), [frontend, { pid: 43, ppid: 1 }]);
});

test("resident socket status does not inherit helper environment or expose other values", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "session-env-"));
  t.after(() => rmSync(dir, { recursive: true }));
  mkdirSync(join(dir, "42"));
  writeFileSync(join(dir, "42/environ"), "UNRELATED=fixture\0");
  assert.deepEqual(runnerSocket(42, "/managed/socket", dir), {
    pid: 42,
    readable: true,
    present: false,
    matching: false,
  });
  writeFileSync(
    join(dir, "42/environ"),
    "CODEX_CONTROL_SOCKET=/managed/socket\0UNRELATED=fixture\0",
  );
  assert.equal(runnerSocket(42, "/managed/socket", dir).matching, true);
  writeFileSync(join(dir, "42/environ"), "CODEX_CONTROL_SOCKET=/different\0");
  const result = runnerSocket(42, "/managed/socket", dir);
  assert.equal(result.present, true);
  assert.equal(result.matching, false);
  assert.equal(JSON.stringify(result).includes("/different"), false);
  assert.throws(() => runnerSocket("../42", "/managed/socket", dir), /Invalid/);
});

test("live owners are preserved without a single tmux mutation", () => {
  const current = plan("/repo", registry, options, [pane], [frontend])[0];
  assert.equal(
    resumeSlot(current, "/managed/socket", null, () =>
      assert.fail("live mutation"),
    ).action,
    "preserved",
  );
  assert.throws(
    () =>
      resumeSlot(
        { ...slot(), state: "blocked", reason: "ambiguous" },
        "/socket",
        null,
      ),
    /ambiguous/,
  );
});

test("dead resume uses new quoted command and exact markers, never kill or send-keys", () => {
  const calls = [];
  const current = {
    ...slot(),
    state: "dead",
    pane: "%1",
    cwd: "/repo/it's here",
  };
  resumeSlot(current, "/managed/socket", "original+marker/path", (args) => {
    calls.push(args);
    return "";
  });
  assert.deepEqual(calls[0].slice(0, 5), [
    "respawn-pane",
    "-t",
    "%1",
    "-c",
    current.cwd,
  ]);
  assert.match(calls[0][5], /CODEX_CONTROL_SOCKET=/);
  assert.match(
    calls[0][5],
    /^tmux set-option -p -t "\$TMUX_PANE" remain-on-exit on && exec /,
  );
  assert.equal(
    calls.some((args) => args[0] === "kill-pane" || args[0] === "send-keys"),
    false,
  );
  assert.equal(
    calls.find((args) => args.includes("@game-handoff-marker")).at(-1),
    "original+marker/path",
  );
});

test("missing shared slot joins canonical session and repeated live observation is idempotent", () => {
  const calls = [];
  const result = resumeSlot(slot(), "/managed/socket", null, (args) => {
    calls.push(args);
    return args[0] === "list-sessions"
      ? "codex-games"
      : args[0] === "new-window"
        ? "%2"
        : "";
  });
  assert.equal(result.action, "resume-requested");
  const created = calls.find((args) => args[0] === "new-window");
  assert.equal(created.includes("codex-games:"), true);
  assert.equal(created[created.indexOf("-n") + 1], "game-coordinator");
  const before = calls.length;
  resumeSlot({ ...result, state: "live" }, "/socket", null, (args) =>
    calls.push(args),
  );
  assert.equal(calls.length, before);
});

function startupFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "session-startup-"));
  t.after(() => rmSync(dir, { recursive: true }));
  const root = join(dir, "repo");
  mkdirSync(join(root, "var"), { recursive: true });
  mkdirSync(join(dir, "game/.worktrees/art"), { recursive: true });
  writeFileSync(
    join(root, "roles.json"),
    readFileSync(new URL("../roles.json", import.meta.url)),
  );
  writeFileSync(
    join(root, "config.json"),
    JSON.stringify({
      schema: 1,
      timezone: "America/Toronto",
      wakeMinutes: [],
      games: { game: { name: "Game", path: "../game", roles: ["art"] } },
      kits: {},
      sharedRoles: ["game-coordinator"],
    }),
  );
  const value = {
    ...registry,
    schema: 1,
    updatedAt: "2026-11-12T00:00:00Z",
    operations: {},
    transfers: [],
    roles: Object.fromEntries(
      Object.entries(registry.roles).map(([role, record]) => [
        role,
        { ...record, ownership: role.replace("/", "-") },
      ]),
    ),
  };
  writeFileSync(join(root, "var/registry.json"), JSON.stringify(value));
  return { root, registry: value, catalog: loadCatalog(root) };
}

const availableTools = () => ({ launchIssues: [], capabilities: [] });

test("tool discovery separates required launch failures from optional native capabilities", (t) => {
  const { root } = startupFixture(t);
  const calls = [];
  const tools = roleTools(
    root,
    { ...slot(), cwd: root, worktree: root },
    {
      tools: {
        required: ["repository", "git", "role-messaging"],
        whenNeeded: [
          "browser",
          "image-generation",
          "image-inspection",
          "native-session",
          "isolated-checks",
        ],
      },
    },
    {
      messaging: () => ({ status: "available", version: "2.0.0" }),
      probe: (binary, args) => {
        calls.push([binary, args]);
        return binary === "docker"
          ? { status: "missing", reason: "absent" }
          : { status: "available" };
      },
    },
  );
  assert.deepEqual(tools.launchIssues, []);
  assert.equal(tools.nativeCapabilities, "unknown");
  for (const id of [
    "browser",
    "image-generation",
    "image-inspection",
    "native-session",
  ])
    assert.equal(
      tools.capabilities.find((tool) => tool.id === id).status,
      "unavailable",
    );
  assert.equal(
    tools.capabilities.find((tool) => tool.id === "isolated-checks").status,
    "missing",
  );
  assert.deepEqual(
    calls.map(([binary]) => binary),
    ["codex", "tmux", "flock", "git", "docker"],
  );
  const missing = roleTools(
    root,
    slot(),
    { tools: { required: [], whenNeeded: [] } },
    {
      messaging: () => ({ status: "missing", reason: "missing CLI" }),
      probe: () => ({ status: "missing", reason: "missing executable" }),
    },
  );
  assert.equal(missing.launchIssues.length, 4);
});

test("bounded probes report only executable metadata and sanitized version", (t) => {
  const { root } = startupFixture(t);
  const binary = join(root, "example-tool");
  writeFileSync(
    binary,
    '#!/bin/sh\nprintf "example-tool 1.2.3 private-output\\n"\n',
    { mode: 0o700 },
  );
  assert.deepEqual(probeBinary("example-tool", ["--version"], { PATH: root }), {
    status: "available",
    executable: binary,
    version: "1.2.3",
  });
  assert.equal(probeBinary("absent", [], { PATH: root }).status, "missing");
  writeFileSync(binary, "#!/bin/sh\nexit 1\n");
  assert.equal(
    probeBinary("example-tool", [], { PATH: root }).status,
    "unavailable",
  );
  assert.equal(installedMessaging(root).status, "missing");
});

test("brief artifacts bind exact identity, contacts and catalog without granting native clearance", (t) => {
  const { root, registry: value, catalog } = startupFixture(t);
  const current = plan(root, value, options, [], [])[0];
  const brief = startupBrief(
    root,
    value,
    config,
    catalog,
    current,
    availableTools(),
    true,
    true,
  );
  const text = readFileSync(brief.path, "utf8");
  for (const expected of [
    current.id,
    current.cwd,
    current.worktree,
    "game/art",
    "orientation",
    "HOLD",
  ])
    assert.ok(text.toLowerCase().includes(expected.toLowerCase()), expected);
  assert.equal(statSync(brief.path).mode & 0o777, 0o600);
  assert.deepEqual(
    startupBrief(
      root,
      value,
      config,
      catalog,
      current,
      availableTools(),
      true,
      true,
    ),
    brief,
  );
  assert.match(
    orientationId(current, brief),
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.notEqual(
    orientationId(current, brief),
    orientationId(current, { ...brief, hash: "changed" }),
  );
  writeFileSync(brief.path, "changed");
  assert.throws(
    () =>
      startupBrief(
        root,
        value,
        config,
        catalog,
        current,
        availableTools(),
        true,
        true,
      ),
    /exact owned match/,
  );
});

test("orientation is one root-qualified store send that wakes itself, with a stable ID", () => {
  const calls = [];
  const brief = {
    hash: "brief-hash",
    path: "/repo/var/session-briefs/brief.md",
  };
  const send = (args) => {
    calls.push(args);
    return {
      duplicate: calls.length > 1,
      message: { state: "sent" },
      wake: { status: "accepted" },
    };
  };
  const first = queueOrientation("/repo", slot(), brief, send);
  const second = queueOrientation("/repo", slot(), brief, send);
  assert.equal(first.id, second.id);
  assert.equal(first.state, "sent");
  assert.equal(first.wake, "accepted");
  assert.equal(first.handling, "unverified");
  assert.equal(calls.length, 2, "one send per orientation, no dispatch");
  assert.equal(
    calls[0][0],
    "/repo/node_modules/@andornaut/coordination-kit/dist/cli.js",
  );
  assert.deepEqual(calls[0].slice(1), [
    "--root",
    "/repo",
    "msg",
    "send",
    "--to",
    slot().role,
    "--id",
    first.id,
    "--body-file",
    brief.path,
  ]);
  for (const flag of ["dispatch", "message", "--from", "unblock"])
    assert.equal(calls.flat().includes(flag), false, flag);
  const failure = queueOrientation("/repo", slot(), brief, () => {
    throw new Error("private output");
  });
  assert.equal(failure.id, first.id);
  assert.equal(failure.state, "unavailable");
  assert.equal(
    failure.nextAction,
    `Check coordination-kit msg status ${first.id} with the canonical coordinator root before any retry`,
  );
  assert.equal(JSON.stringify(failure).includes("private output"), false);
});

test("brief CLI writes orientation only and never launches or messages", async (t) => {
  const { root } = startupFixture(t);
  let output;
  await main(
    {
      processes: () => [],
      panes: () => [],
      tools: availableTools,
      socketAvailable: async () => false,
      tmux: () => assert.fail("artifact command launched frontend"),
      message: () => assert.fail("artifact command sent message"),
      output: (text) => {
        output = JSON.parse(text);
      },
    },
    ["brief", "--root", root, "--role", "game-coordinator", "--held"],
  );
  assert.equal(output.slots[0].state, "missing");
  assert.match(readFileSync(output.slots[0].brief.path, "utf8"), /HOLD/);
});

for (const mode of [
  "normal",
  "delayed",
  "held",
  "live",
  "unverified",
  "wrong-pane",
  "changed-during-wait",
  "missing-core",
]) {
  test(`resume startup boundary: ${mode}`, async (t) => {
    const { root } = startupFixture(t);
    let launched = mode === "live";
    let output;
    let waits = 0;
    const calls = [];
    const currentFrontend = { ...frontend, cwd: root };
    const ports = {
      tools: () => ({
        capabilities: [],
        launchIssues: mode === "missing-core" ? ["missing core CLI"] : [],
      }),
      processes: () => (launched ? [currentFrontend] : []),
      panes: () =>
        launched
          ? [
              {
                ...pane,
                pane: mode === "wrong-pane" ? "%2" : pane.pane,
                frontends: [currentFrontend],
              },
            ]
          : [],
      socketAvailable: async () => true,
      startupWait: async (ms) => {
        assert.equal(ms, 250);
        waits++;
        if (mode === "delayed" && waits === 2) launched = true;
        if (mode === "changed-during-wait") {
          const path = join(root, "var/registry.json");
          const value = JSON.parse(readFileSync(path, "utf8"));
          writeFileSync(
            path,
            JSON.stringify({ ...value, revision: value.revision + 1 }),
          );
        }
      },
      tmux: (args) => {
        calls.push(args);
        if (args[0] === "new-window" || args[0] === "new-session") {
          if (!["unverified", "delayed", "changed-during-wait"].includes(mode))
            launched = true;
          return "%1";
        }
        return "";
      },
      message: (args) => {
        calls.push(args);
        return { message: { state: "sent" }, wake: { status: "accepted" } };
      },
      output: (text) => {
        output = JSON.parse(text);
      },
    };
    const args = [
      "resume",
      "--root",
      root,
      "--role",
      "game-coordinator",
      ...(mode === "held" ? ["--held"] : []),
    ];
    if (mode === "missing-core") {
      await assert.rejects(main(ports, args), /missing core CLI/);
      assert.deepEqual(calls, []);
      return;
    }
    await main(ports, args);
    const sent = calls.filter((args) => args.includes("msg"));
    const shouldSend = mode === "normal" || mode === "delayed";
    assert.equal(sent.length, shouldSend ? 1 : 0);
    assert.equal(
      output.slots[0].orientation.state,
      shouldSend ? "sent" : "not-sent",
    );
    assert.equal(
      waits,
      { delayed: 2, unverified: 8, "changed-during-wait": 1 }[mode] ?? 0,
    );
    if (mode === "live") assert.deepEqual(calls, []);
    const launch = calls.find((args) => args.includes("new-session"));
    if (launch) {
      assert.equal(launch.at(-1).includes("brief.md"), false);
      assert.equal(launch[launch.indexOf("-n") + 1], "game-coordinator");
    }
  });
}

test("unavailable unrelated registry contact is explicit without blocking a selected owner", (t) => {
  const { root, registry: value, catalog } = startupFixture(t);
  value.roles["art-kit"] = {
    worktree: ".",
    conversations: { codex: null, claude: null },
  };
  const current = plan(root, value, options, [], [])[0];
  const brief = startupBrief(
    root,
    value,
    config,
    catalog,
    current,
    availableTools(),
    false,
    true,
  );
  assert.match(
    readFileSync(brief.path, "utf8"),
    /Unavailable registry contacts: art-kit/,
  );
});

test("messaging preflight accepts the installed pinned Coordination Kit", () => {
  const messaging = installedMessaging(join(import.meta.dirname, ".."));
  assert.equal(messaging.status, "available", messaging.reason);
});

test("messaging availability requires compatible public message CLI metadata", (t) => {
  const { root } = startupFixture(t);
  const directory = join(root, "node_modules/@andornaut/coordination-kit");
  mkdirSync(join(directory, "dist"), { recursive: true });
  writeFileSync(join(directory, "dist/cli.js"), "");
  const metadata = {
    name: "@andornaut/coordination-kit",
    exports: {
      "./build/registry": "./dist/registry.js",
    },
  };
  for (const [version, status] of [
    ["2.1.2", "missing"],
    ["3.0.0", "available"],
    ["3.4.5", "available"],
    ["3.0.0-rc.1", "missing"],
    ["4.0.0", "available"],
    ["4.0.4", "available"],
    ["4.1.0-rc.1", "missing"],
    ["5.0.0", "available"],
    ["6.0.0", "available"],
    ["6.2.1", "available"],
    ["6.0.0-rc.1", "missing"],
    ["7.0.0", "available"],
    ["7.0.0-rc.1", "missing"],
    ["8.0.0", "available"],
    ["8.0.0-rc.1", "missing"],
    ["9.0.0", "missing"],
  ]) {
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ ...metadata, version }),
    );
    assert.equal(installedMessaging(root).status, status, version);
  }
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      ...metadata,
      name: "@andornaut/delivery-kit",
      version: "3.0.0",
    }),
  );
  assert.equal(
    installedMessaging(root).status,
    "missing",
    "Another package at the coordination-kit path is not the messaging CLI",
  );
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      ...metadata,
      version: "3.0.0",
      exports: {
        "./registry": "./dist/registry.js",
      },
    }),
  );
  assert.equal(
    installedMessaging(root).status,
    "missing",
    "Unprefixed aliases alone do not establish canonical SDK readiness",
  );
});

test("delayed frontend visibility requires explicit guarded orientation completion", async (t) => {
  const { root } = startupFixture(t);
  let visible = false;
  let output;
  const messages = [];
  const stored = new Map();
  const ports = {
    tools: availableTools,
    processes: () => (visible ? [{ ...frontend, cwd: root }] : []),
    panes: () =>
      visible ? [{ ...pane, frontends: [{ ...frontend, cwd: root }] }] : [],
    socketAvailable: async () => true,
    startupWait: async () => {},
    tmux: (args) => (args[0] === "new-session" ? "%1" : ""),
    message: (args) => {
      messages.push(args);
      // The store send seam: a repeated ID with identical content stores nothing new.
      const option = (name) => args[args.indexOf(name) + 1];
      const id = option("--id");
      const record = {
        id,
        to: option("--to"),
        body: readFileSync(option("--body-file"), "utf8"),
      };
      const duplicate = stored.has(id);
      if (duplicate) assert.deepEqual(stored.get(id), record, "id-conflict");
      stored.set(id, record);
      return {
        duplicate,
        message: { id, state: "sent" },
        wake: { status: "accepted" },
      };
    },
    output: (text) => {
      output = JSON.parse(text);
    },
  };
  const selection = ["--root", root, "--role", "game-coordinator"];
  await main(ports, ["resume", ...selection]);
  assert.equal(output.slots[0].orientation.state, "not-sent");
  assert.match(
    output.slots[0].orientation.nextAction,
    /brief --dispatch --role game-coordinator/,
  );
  assert.deepEqual(messages, []);
  visible = true;
  ports.tmux = () => assert.fail("live completion mutated tmux");
  await main(ports, ["resume", ...selection]);
  assert.deepEqual(messages, []);
  await main(ports, ["brief", "--dispatch", ...selection]);
  const first = output.slots[0].orientation;
  assert.equal(first.state, "sent");
  assert.equal(first.wake, "accepted");
  assert.equal(first.handling, "unverified");
  await main(ports, ["brief", "--dispatch", ...selection]);
  assert.equal(output.slots[0].orientation.id, first.id);
  assert.equal(messages.length, 2);
  assert.deepEqual([...stored.keys()], [first.id]);
  assert.equal(stored.get(first.id).to, "game-coordinator");
  assert.equal(
    messages.flat().includes("--intent"),
    false,
    "orientation uses the default queue intent",
  );
});

for (const mode of [
  "held",
  "blocked",
  "missing",
  "local-only",
  "socket",
  "changed-registry",
  "changed-catalog",
]) {
  test(`explicit brief dispatch preserves unavailable or protected owner: ${mode}`, async (t) => {
    const { root } = startupFixture(t);
    let snapshots = 0;
    const ports = {
      tools: availableTools,
      processes: () => {
        if (++snapshots === 2 && mode === "changed-registry") {
          const path = join(root, "var/registry.json");
          const value = JSON.parse(readFileSync(path, "utf8"));
          writeFileSync(
            path,
            JSON.stringify({ ...value, revision: value.revision + 1 }),
          );
        }
        if (snapshots === 2 && mode === "changed-catalog") {
          const path = join(root, "roles.json");
          const value = JSON.parse(readFileSync(path, "utf8"));
          value.protocol.push("Keep fixture identity unchanged.");
          writeFileSync(path, JSON.stringify(value));
        }
        return mode === "missing" ? [] : [{ ...frontend, cwd: root }];
      },
      panes: (all) =>
        mode === "missing"
          ? []
          : [
              {
                ...pane,
                frontends: [
                  {
                    ...all[0],
                    id: mode === "blocked" ? target : id,
                    remoteRequested: mode !== "local-only",
                  },
                ],
              },
            ],
      socketAvailable: async () => mode !== "socket",
      tmux: () => assert.fail("brief dispatch touched tmux"),
      message: () => assert.fail("ineligible owner messaged"),
      output: (text) => {
        const result = JSON.parse(text).slots[0].orientation;
        assert.equal(result.state, "not-sent");
        assert.match(result.id, /^[0-9a-f-]{36}$/);
      },
    };
    await main(ports, [
      "brief",
      "--dispatch",
      "--root",
      root,
      "--role",
      "game-coordinator",
      ...(mode === "held" ? ["--held"] : []),
    ]);
  });
}

test("Claude brief dispatch does not require the Codex control socket", async (t) => {
  const { root } = startupFixture(t);
  const path = join(root, "var/registry.json");
  writeFileSync(
    path,
    JSON.stringify({
      ...JSON.parse(readFileSync(path, "utf8")),
      harness: "claude",
    }),
  );
  const claude = { ...frontend, harness: "claude", id: target, cwd: root };
  const messages = [];
  let output;
  await main(
    {
      tools: availableTools,
      processes: () => [claude],
      panes: () => [
        {
          ...pane,
          session: "claude-games",
          harness: "claude",
          id: target,
          frontends: [claude],
        },
      ],
      socketAvailable: async () => false,
      tmux: () => assert.fail("brief dispatch touched tmux"),
      message: (args) => {
        messages.push(args);
        return {
          duplicate: false,
          message: { id: args[args.indexOf("--id") + 1], state: "sent" },
          wake: { status: "accepted" },
        };
      },
      output: (text) => {
        output = JSON.parse(text);
      },
    },
    ["brief", "--dispatch", "--root", root, "--role", "game-coordinator"],
  );
  assert.equal(output.slots[0].harness, "claude");
  assert.equal(output.slots[0].orientation.state, "sent");
  assert.equal(messages.length, 1);
});

test("dispatch flag cannot add messaging to other session verbs", async () => {
  for (const command of ["plan", "check", "resume"])
    await assert.rejects(main({}, [command, "--dispatch"]), /only with brief/);
});

test("a handoff marker is accepted only for resume", async () => {
  for (const command of ["plan", "check", "brief"])
    await assert.rejects(
      main({}, [command, "--handoff-marker", "fixture"]),
      /--handoff-marker is supported only with resume/,
    );
});

test("session help lists only applicable options without inspecting the workspace", async () => {
  let output;
  const ports = { output: (value) => (output = value) };
  await main(ports, ["--help", "--root", "/nonexistent-coordinator"]);
  assert.match(output, /Commands:\n  plan\b/);
  assert.match(output, /--role ROLE/);
  assert.doesNotMatch(output, /--dispatch|--new|--handoff-marker/);
  await main(ports, ["brief", "-h", "--root", "/nonexistent-coordinator"]);
  assert.match(output, /Usage: sessions\.mjs brief/);
  assert.match(output, /--dispatch/);
  assert.doesNotMatch(output, /--new|--handoff-marker/);
  await main(ports, ["resume", "--help", "--root", "/nonexistent-coordinator"]);
  assert.match(output, /Usage: sessions\.mjs resume/);
  assert.match(output, /--new/);
  assert.match(output, /--handoff-marker TEXT/);
  assert.doesNotMatch(output, /--dispatch/);
});
