import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  resolveHarness,
  resolveRole,
} from "@andornaut/coordination-kit/build/registry";

export const verification =
  "Native project, pending questions, quota, HOLD and Remote Control connection require supported native verification by the caller.";

// Session `<harness>-games`; a game window is the first word of the game's name plus the role (`ada-tech`), any other window is the role.
export function windowName(games, role) {
  const [game, type] = role.split("/");
  if (!type) return role;
  const short = games?.[game]?.name?.split(" ")[0]?.toLowerCase();
  if (!short) throw new Error(`Game ${game} has no configured name`);
  return `${short}-${type}`;
}

export function marker(revision, role, harness, id) {
  return `sessions-r${revision}-${createHash("sha256")
    .update(JSON.stringify([role, harness, id]))
    .digest("hex")
    .slice(0, 20)}`;
}

export function quote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

// Both harnesses start in the native root without --add-dir: a role worktree in another repository
// raises a Claude directory-trust prompt, and Codex resume rejects the flag.
export function launchArgs(slot, socket) {
  return slot.harness === "codex"
    ? [
        "codex",
        "resume",
        "--remote",
        `unix://${socket}`,
        "--dangerously-bypass-approvals-and-sandbox",
        "-C",
        slot.cwd,
        slot.id,
      ]
    : [
        "claude",
        // A new conversation takes its registered ID with --session-id; later launches resume it.
        slot.create ? "--session-id" : "--resume",
        slot.id,
        "--name",
        slot.role,
        "--remote-control",
        slot.role,
        "--model",
        "claude-opus-5-5",
        "--dangerously-skip-permissions",
        ...(slot.channelConfig
          ? [
              "--mcp-config",
              slot.channelConfig,
              "--dangerously-load-development-channels",
              "server:delivery-kit-monitor",
            ]
          : []),
      ];
}

// Only exact resume arguments establish frontend identity; names and markers are hints.
export function identity(socket, argv) {
  const binary = argv[0]?.split("/").at(-1);
  if (binary === "claude") {
    const index =
      argv.indexOf("--resume") >= 0
        ? argv.indexOf("--resume")
        : argv.indexOf("--session-id");
    return index >= 0
      ? {
          harness: "claude",
          id: argv[index + 1],
          remoteRequested: argv.includes("--remote-control"),
        }
      : null;
  }
  if (binary === "codex" && argv[1] === "resume") {
    const ids = argv
      .slice(2)
      .filter((value) =>
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value),
      );
    const index = argv.indexOf("--remote");
    const endpoint =
      index >= 0
        ? argv[index + 1]
        : argv.find((value) => value.startsWith("--remote="))?.slice(9);
    return ids.length === 1
      ? {
          harness: "codex",
          id: ids[0],
          remoteRequested: endpoint === `unix://${socket}`,
        }
      : null;
  }
  return null;
}

export function plan(root, registry, options, panes, processes) {
  if (!options.roles?.length) throw new Error("Select at least one --role");
  if (options.harness && !["codex", "claude"].includes(options.harness))
    throw new Error("Invalid harness");
  return [...new Set(options.roles)].sort().map((role) => {
    resolveRole(registry, role);
    const effective = resolveHarness(registry, role);
    const harness = options.harness ?? effective;
    if (harness !== effective && !options.held)
      throw new Error(
        `${role}: --held required for a different target harness`,
      );
    const record = registry.roles[role];
    const id = record.conversations[harness];
    if (!id) throw new Error(`${role}: no registered ${harness} conversation`);
    const hostRoot = resolve(root, registry.host.root);
    const worktree = resolve(root, record.worktree);
    const game = options.config.games[role.split("/")[0]];
    const cwd = game ? resolve(root, game.path) : hostRoot;
    const session = `${harness}-games`;
    const name = windowName(options.config.games, role);
    const relevant = panes.filter(
      (p) =>
        (p.role === role && p.harness === harness) ||
        p.id === id ||
        (p.session === session && p.name === name) ||
        p.frontends.some((f) => f.harness === harness && f.id === id),
    );
    const owners = processes.filter(
      (p) => p.harness === harness && p.id === id,
    );
    let state = "missing";
    let reason;
    const live = relevant.filter((p) => !p.dead);
    if (relevant.length > 1 || owners.length > 1) {
      state = "blocked";
      reason = "Multiple candidate panes or frontend processes";
    } else if (
      live.length &&
      live[0].shell &&
      !live[0].frontends.length &&
      live[0].role === role &&
      live[0].harness === harness &&
      live[0].id === id
    ) {
      // An exact slot whose frontend exited back to its shell is relaunchable.
      state = "dead";
    } else if (live.length) {
      const p = live[0];
      const matching = p.frontends.filter(
        (f) => f.harness === harness && f.id === id && f.cwd === cwd,
      );
      const conflicting = p.frontends.some(
        (f) => f.harness !== harness || f.id !== id || f.cwd !== cwd,
      );
      state =
        matching.length === 1 &&
        !conflicting &&
        (!p.id || p.id === id) &&
        (!p.role || p.role === role) &&
        (!p.harness || p.harness === harness)
          ? "live"
          : "blocked";
      if (state === "blocked")
        reason = "Live pane identity is ambiguous; preserve it";
    } else if (owners.length) {
      state = "blocked";
      reason = "Frontend exists outside a verified live pane";
    } else if (relevant.length) {
      const p = relevant[0];
      state =
        p.role === role && p.harness === harness && p.id === id
          ? "dead"
          : "blocked";
      if (state === "blocked")
        reason = "Dead slot lacks exact role, harness and conversation markers";
    }
    return {
      role,
      effectiveHarness: effective,
      harness,
      id,
      cwd,
      worktree,
      session,
      name,
      state,
      ...(state === "live"
        ? { remoteRequested: live[0].frontends[0].remoteRequested === true }
        : {}),
      ...(reason ? { reason } : {}),
      ...(state === "live"
        ? { missingMarkers: !live[0].role || !live[0].harness || !live[0].id }
        : {}),
      ...(relevant[0] ? { pane: relevant[0].pane } : {}),
      ...(state === "dead" && !relevant[0].dead ? { shell: true } : {}),
      marker: marker(registry.revision, role, harness, id),
    };
  });
}
