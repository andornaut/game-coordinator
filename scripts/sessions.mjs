#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { createConnection } from "node:net";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { loadLayout, readRegistry } from "@andornaut/delivery-kit/registry";
import {
  identity,
  launchArgs,
  plan,
  quote,
  verification,
} from "./session-plan.mjs";

export function controlSocket(env = process.env) {
  if (Object.hasOwn(env, "CODEX_CONTROL_SOCKET")) {
    if (!isAbsolute(env.CODEX_CONTROL_SOCKET))
      throw new Error("CODEX_CONTROL_SOCKET must be an absolute path");
    return env.CODEX_CONTROL_SOCKET;
  }
  return resolve(
    homedir(),
    ".codex/app-server-control/app-server-control.sock",
  );
}
const run = (args) =>
  execFileSync("tmux", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

export function resumeLock(path, action) {
  const fd = openSync(path, "a", 0o600);
  try {
    // flock's duplicated descriptor shares this open-file description until close/exit.
    try {
      execFileSync("flock", ["--nonblock", "3"], {
        stdio: ["ignore", "pipe", "pipe", fd],
      });
    } catch {
      throw new Error(
        "Resume lock unavailable: another helper is active, or flock is unavailable",
      );
    }
    return action();
  } finally {
    closeSync(fd);
  }
}

export function managerChannel(root, slot, write = false) {
  if (slot.harness !== "claude" || slot.role !== "dev-manager") return slot;
  const cli = resolve(root, "node_modules/@andornaut/delivery-kit/dist/cli.js");
  if (!existsSync(cli))
    throw new Error(
      "Claude dev-manager requires the installed delivery-kit channel CLI",
    );
  const path = resolve(root, `var/session-frontends/${slot.id}.mcp.json`);
  const content = `${JSON.stringify(
    {
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
            slot.id,
          ],
        },
      },
    },
    null,
    2,
  )}\n`;
  if (existsSync(path)) {
    const stat = lstatSync(path);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid() ||
      readFileSync(path, "utf8") !== content
    ) {
      throw new Error(
        "Claude dev-manager channel configuration is not an exact owned match",
      );
    }
  } else if (write) {
    mkdirSync(resolve(root, "var/session-frontends"), { recursive: true });
    writeFileSync(path, content, { flag: "wx", mode: 0o600 });
  }
  return { ...slot, channelConfig: path };
}

export function markPane(slot, handoffMarker, tmux = run) {
  for (const [key, value] of Object.entries({
    "game-session-role": slot.role,
    "game-session-harness": slot.harness,
    "agent-thread-id": slot.id,
    "game-session-marker": slot.marker,
    ...(handoffMarker ? { "game-handoff-marker": handoffMarker } : {}),
  })) {
    tmux(["set-option", "-p", "-t", slot.pane, `@${key}`, value]);
  }
}

export function sortWindows(registry, slot, tmux = run) {
  const rows = tmux([
    "list-panes",
    "-s",
    "-t",
    slot.session,
    "-F",
    "#{window_id}\t#{window_index}\t#{window_name}\t#{@game-session-role}\t#{@game-session-harness}",
  ]);
  const groups = new Map();
  for (const line of rows.split("\n").filter(Boolean)) {
    const [id, index, name, role, harness] = line.split("\t");
    const known =
      Object.hasOwn(registry.roles, role ?? "") &&
      role.split("/").at(-1) === name &&
      harness === slot.harness;
    const item = groups.get(id) ?? {
      id,
      index: Number(index),
      name,
      known: true,
    };
    item.known &&= known;
    groups.set(id, item);
  }
  const current = [...groups.values()]
    .filter((w) => w.known)
    .sort((a, b) => a.index - b.index);
  if (new Set(current.map((w) => w.name)).size !== current.length) return;
  const desired = [...current].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (let i = 0; i < current.length; i++) {
    const other = current.findIndex((w) => w.id === desired[i].id);
    if (i !== other) {
      tmux(["swap-window", "-s", desired[i].id, "-t", current[i].id]);
      [current[i], current[other]] = [current[other], current[i]];
    }
  }
}

export function processes(proc = "/proc", socket = controlSocket()) {
  const all = [];
  for (const pid of readdirSync(proc).filter((p) => /^\d+$/.test(p))) {
    try {
      const stat = readFileSync(`${proc}/${pid}/stat`, "utf8");
      const ppid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
      const comm = stat.slice(stat.indexOf("(") + 1, stat.lastIndexOf(")"));
      if (!["codex", "claude"].includes(comm)) {
        all.push({ pid: Number(pid), ppid });
        continue;
      }
      const argv = readFileSync(`${proc}/${pid}/cmdline`)
        .toString()
        .split("\0")
        .filter(Boolean);
      all.push({
        pid: Number(pid),
        ppid,
        ...identity(socket, argv),
        cwd: readlinkSync(`${proc}/${pid}/cwd`),
      });
    } catch {
      /* Processes may exit during a snapshot. */
    }
  }
  return all;
}

export function inspectPanes(all, tmux = run) {
  let output;
  try {
    output = tmux([
      "list-panes",
      "-a",
      "-F",
      "#{pane_id}\t#{session_name}\t#{window_name}\t#{pane_dead}\t#{pane_pid}\t#{@game-session-role}\t#{@game-session-harness}\t#{@agent-thread-id}",
    ]);
  } catch (error) {
    if (/no server running|no sessions/.test(String(error.stderr))) return [];
    throw new Error("tmux inspection unavailable");
  }
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [pane, session, name, dead, pid, role, harness, id] =
        line.split("\t");
      const descendants = new Set([Number(pid)]);
      for (let size = -1; size !== descendants.size;) {
        size = descendants.size;
        all
          .filter((p) => descendants.has(p.ppid))
          .forEach((p) => descendants.add(p.pid));
      }
      return {
        pane,
        session,
        name,
        dead: dead === "1",
        role,
        harness,
        id,
        frontends: all.filter((p) => descendants.has(p.pid) && p.harness),
      };
    });
}

export async function socketAvailable(path) {
  return new Promise((resolveResult) => {
    const client = createConnection(path);
    const finish = (available) => {
      client.destroy();
      resolveResult(available);
    };
    client.setTimeout(1000, () => finish(false));
    client.once("connect", () => finish(true));
    client.once("error", () => finish(false));
  });
}

export function runnerSocket(pid, expected = controlSocket(), proc = "/proc") {
  if (!/^[1-9]\d*$/.test(String(pid))) throw new Error("Invalid --runner-pid");
  try {
    // No other environment fields leave this function.
    const entry = readFileSync(`${proc}/${pid}/environ`)
      .toString()
      .split("\0")
      .find((value) => value.startsWith("CODEX_CONTROL_SOCKET="));
    return {
      pid: Number(pid),
      readable: true,
      present: entry !== undefined,
      matching: entry === `CODEX_CONTROL_SOCKET=${expected}`,
    };
  } catch {
    return {
      pid: Number(pid),
      readable: false,
      present: false,
      matching: false,
    };
  }
}

export function resumeSlot(slot, socket, handoffMarker, tmux = run) {
  if (slot.state === "live") {
    if (slot.missingMarkers) markPane(slot, handoffMarker, tmux);
    return {
      ...slot,
      action: slot.missingMarkers ? "markers-repaired" : "preserved",
    };
  }
  if (!["missing", "dead"].includes(slot.state))
    throw new Error(`${slot.role}: ${slot.reason}`);
  // Quote every token, including the working directory and exact native ID.
  const launch = [
    "env",
    `CODEX_CONTROL_SOCKET=${socket}`,
    ...launchArgs(slot, socket),
  ]
    .map(quote)
    .join(" ");
  // Preserve early trust/authentication exits for inspection without answering dialogs.
  const command = `tmux set-option -p -t "$TMUX_PANE" remain-on-exit on && exec ${launch}`;
  let pane = slot.pane;
  if (slot.state === "dead") {
    tmux(["respawn-pane", "-t", pane, "-c", slot.cwd, command]);
  } else {
    let sessions;
    try {
      sessions = tmux(["list-sessions", "-F", "#{session_name}"]).split("\n");
    } catch (error) {
      if (!/no server running|no sessions/.test(String(error.stderr)))
        throw error;
      sessions = [];
    }
    pane = tmux(
      sessions.includes(slot.session)
        ? [
            "new-window",
            "-d",
            "-P",
            "-F",
            "#{pane_id}",
            "-t",
            `${slot.session}:`,
            "-n",
            slot.name,
            "-c",
            slot.cwd,
            command,
          ]
        : [
            "new-session",
            "-d",
            "-P",
            "-F",
            "#{pane_id}",
            "-s",
            slot.session,
            "-n",
            slot.name,
            "-c",
            slot.cwd,
            command,
          ],
    );
  }
  markPane({ ...slot, pane }, handoffMarker, tmux);
  tmux(["set-option", "-w", "-t", pane, "automatic-rename", "off"]);
  tmux(["set-option", "-w", "-t", pane, "allow-rename", "off"]);
  return { ...slot, pane, action: "resume-requested" };
}

export async function main(ports = {}, argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      role: { type: "string", multiple: true },
      root: { type: "string", default: process.cwd() },
      harness: { type: "string" },
      held: { type: "boolean", default: false },
      "runner-pid": { type: "string", multiple: true },
      "handoff-marker": { type: "string" },
    },
  });
  const [command] = positionals;
  if (
    positionals.length !== 1 ||
    !["plan", "check", "resume"].includes(command)
  )
    throw new Error(
      "Usage: sessions.mjs plan|check|resume --role ROLE [--role ROLE] [--root PATH] [--harness codex|claude --held] [--runner-pid PID] [--handoff-marker TEXT]",
    );
  const root = realpathSync(values.root);
  const socketPath = controlSocket();
  const layout = loadLayout(root);
  const registry = readRegistry(layout);
  const options = {
    roles: values.role,
    harness: values.harness,
    held: values.held,
    config: layout.config,
  };
  const snapshot = () => {
    const all = (ports.processes ?? (() => processes("/proc", socketPath)))();
    return plan(
      root,
      readRegistry(layout),
      options,
      (ports.panes ?? inspectPanes)(all),
      all,
    );
  };
  let slots = snapshot();
  const available = await (ports.socketAvailable ?? socketAvailable)(
    socketPath,
  );
  const runners = (values["runner-pid"] ?? []).map((pid) => runnerSocket(pid));
  const issues = slots
    .filter((s) => s.state === "blocked")
    .map((s) => `${s.role}: ${s.reason}`);
  for (const slot of slots)
    if (slot.state === "live" && !slot.remoteRequested)
      issues.push(
        `${slot.role}: live frontend lacks matching remote configuration; preserved`,
      );
  for (const slot of slots)
    if (!existsSync(slot.cwd) || !existsSync(slot.worktree))
      issues.push(`${slot.role}: registered root or worktree missing`);
  for (const slot of slots.filter((s) => s.state !== "live")) {
    try {
      managerChannel(root, slot);
    } catch (error) {
      issues.push(error.message);
    }
  }
  if (
    (slots.some((s) => s.harness === "codex") || runners.length) &&
    !available
  )
    issues.push("Managed Codex control socket unavailable");
  if (runners.some((r) => !r.matching))
    issues.push(
      "Resident runner socket configuration unavailable or mismatched",
    );
  if (command === "resume") {
    if (issues.length) throw new Error(issues.join("; "));
    resumeLock(resolve(root, "var/session-resume.lock"), () => {
      for (const slot of slots) {
        if (readRegistry(layout).revision !== registry.revision)
          throw new Error("Registry changed; re-plan");
        let fresh = snapshot().find((s) => s.role === slot.role);
        if (fresh.state !== "live") fresh = managerChannel(root, fresh, true);
        const result = resumeSlot(
          fresh,
          socketPath,
          values["handoff-marker"],
          ports.tmux ?? run,
        );
        if (fresh.state === "missing")
          sortWindows(registry, fresh, ports.tmux ?? run);
        const observed = snapshot().find((s) => s.role === slot.role);
        slots = slots.map((s) =>
          s.role === slot.role
            ? { ...result, observedState: observed.state }
            : s,
        );
      }
    });
  }
  (ports.output ?? console.log)(
    JSON.stringify(
      {
        revision: registry.revision,
        verification,
        socket: { path: socketPath, available },
        runners,
        slots,
        issues,
      },
      null,
      2,
    ),
  );
  if (command === "check" && issues.length) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
