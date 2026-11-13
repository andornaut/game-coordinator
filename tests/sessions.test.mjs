import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
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
  managerChannel,
  processes,
  resumeLock,
  resumeSlot,
  runnerSocket,
  sortWindows,
} from "../scripts/sessions.mjs";

const id = "12345678-1234-1234-1234-123456789abc";
const target = "abcdefab-1234-1234-1234-123456789abc";
const config = { games: { game: { path: "../game" } } };
const registry = {
  revision: 14,
  harness: "codex",
  host: { root: ".", nativeProjectId: "fixture-project" },
  roles: {
    "dev-manager": {
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
const options = { roles: ["dev-manager"], config };
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
  session: "codex-game",
  name: "dev-manager",
  dead: false,
  role: "dev-manager",
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
    { roles: ["game/art", "dev-manager", "game/art"], config },
    [],
    [],
  );
  assert.deepEqual(
    slots.map((s) => [s.role, s.harness, s.session, s.cwd]),
    [
      ["dev-manager", "codex", "codex-game", "/repo"],
      ["game/art", "claude", "claude-game", "/game"],
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
          session: "claude-game",
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
  assert.deepEqual(launchArgs(game, "/socket").slice(-2), [
    "--add-dir",
    "/game/.worktrees/art",
  ]);
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
      sharedRoles: ["dev-manager"],
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
  let output;
  await main(
    {
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
  assert.match(
    controlSocket({}),
    /\.codex\/app-server-control\/app-server-control.sock$/,
  );
  for (const value of ["", "relative/socket"])
    assert.throws(
      () => controlSocket({ CODEX_CONTROL_SOCKET: value }),
      /absolute/,
    );
});

test("Claude manager channel is exact-target, owned, isolated from ordinary role launches", (t) => {
  const root = mkdtempSync(join(tmpdir(), "sessions-channel-"));
  t.after(() => rmSync(root, { recursive: true }));
  const current = { ...slot(), harness: "claude", id: target };
  assert.throws(() => managerChannel(root, current), /installed delivery-kit/);
  mkdirSync(join(root, "node_modules/@andornaut/delivery-kit/dist"), {
    recursive: true,
  });
  writeFileSync(
    join(root, "node_modules/@andornaut/delivery-kit/dist/cli.js"),
    "",
  );
  const configured = managerChannel(root, current, true);
  const args = launchArgs(configured, "/socket");
  assert.equal(args.includes("--mcp-config"), true);
  assert.equal(args.includes("--strict-mcp-config"), false);
  assert.equal(args.includes("--dangerously-load-development-channels"), true);
  assert.equal(
    managerChannel(root, current).channelConfig,
    configured.channelConfig,
  );
  writeFileSync(configured.channelConfig, "{}");
  assert.throws(() => managerChannel(root, current, true), /exact owned match/);
  assert.equal(
    managerChannel(root, { ...current, role: "game/art" }).channelConfig,
    undefined,
  );
});

test("resume lock excludes concurrent helpers and releases on descriptor close", (t) => {
  const root = mkdtempSync(join(tmpdir(), "sessions-lock-"));
  t.after(() => rmSync(root, { recursive: true }));
  const path = join(root, "lock");
  resumeLock(path, () =>
    assert.throws(
      () => resumeLock(path, () => assert.fail("duplicate lock")),
      /lock unavailable/,
    ),
  );
  assert.equal(
    resumeLock(path, () => "released"),
    "released",
  );
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
  sortWindows(value, slot(), (args) => {
    calls.push(args);
    return args[0] === "list-panes"
      ? "@1\t1\tdev-manager\tdev-manager\tcodex\n@2\t2\tscratch\t\t\n@3\t3\tart-kit\tart-kit\tcodex"
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
  delete missing.roles["dev-manager"].conversations.codex;
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
    "--add-dir",
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
    "dev-manager",
    "--remote-control",
    "dev-manager",
    "--dangerously-skip-permissions",
    "--add-dir",
    "/repo",
  ]);
  assert.equal(identity("/managed/socket", codex).id, id);
  assert.equal(identity("/managed/socket", codex).remoteRequested, true);
  assert.equal(identity("/managed/socket", claude).id, id);
  assert.equal(identity("/socket", ["codex", "app-server"]), null);
  assert.equal(identity("/socket", ["bash", "-c", codex.join(" ")]), null);
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
    return "%1\tcodex-game\tdev-manager\t0\t40\t\t\t";
  });
  assert.deepEqual(panes[0].frontends, [frontend]);
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
      ? "codex-game"
      : args[0] === "new-window"
        ? "%2"
        : "";
  });
  assert.equal(result.action, "resume-requested");
  assert.equal(
    calls.find((args) => args[0] === "new-window").includes("codex-game:"),
    true,
  );
  const before = calls.length;
  resumeSlot({ ...result, state: "live" }, "/socket", null, (args) =>
    calls.push(args),
  );
  assert.equal(calls.length, before);
});
