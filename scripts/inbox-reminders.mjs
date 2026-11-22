#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
  loadLayout,
  readRegistry,
  resolveHarness,
} from "@andornaut/coordination-kit/build/registry";

import { plan, quote } from "./session-plan.mjs";
import { controlSocket, inspectPanes, processes } from "./sessions.mjs";

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ROLE = /^[a-z0-9][a-z0-9-]{0,63}(\/[a-z0-9][a-z0-9-]{0,63})?$/;
const ORIGINAL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const PANE = /^%\d+$/;
const EMPTY = "Ask Codex to do anything";
const SHORTCUTS =
  /^ {2}← for agents · \? for shortcuts(?: +\u26a0 \d+ warnings? · f2 to view)?$/;
const MODEL = /^ {2}\S.* · GPT-[\w.-]+(?: [\w-]+)? · /;
const BLOCKER =
  /esc to (?:interrupt|cancel|back)|\b(?:waiting for (?:input|approval)|decision required|select model and effort|approve this)\b/i;
const CLIPPED = /(?:^|\s)\[Paste #\d+|\u2026$/;
const SNAPSHOT_LINES = 12;
const QUIET_MS = 120;
const PASTE_MS = 220;
const SUBMIT_MS = 220;

class Refusal extends Error {}

function requireState(condition, reason) {
  if (!condition) throw new Refusal(reason);
}

function tmux(args) {
  return execFileSync("tmux", args, {
    encoding: "utf8",
    maxBuffer: 65536,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 900,
  });
}

export function kitCommand(root, args) {
  let output;
  try {
    output = execFileSync(
      process.execPath,
      [
        resolve(root, "node_modules/@andornaut/coordination-kit/dist/cli.js"),
        "--root",
        root,
        ...args,
      ],
      {
        encoding: "utf8",
        maxBuffer: 1048576,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 12000,
      },
    );
  } catch (error) {
    const reason = /^coordination-kit: (reminder-[a-z0-9-]{1,80})\n?$/.exec(
      error.stderr,
    )?.[1];
    if (reason) throw new Refusal(reason);
    throw error;
  }
  return JSON.parse(output);
}

function slotFor(context, role) {
  const registry = context.registry(context.layout);
  const record = registry.roles[role];
  requireState(record?.ownership === "active", "recipient-inactive");
  requireState(
    record.phase !== "held" && record.phase !== "source-held",
    "recipient-held",
  );
  requireState(
    resolveHarness(registry, role) === "codex",
    "frontend-unverified",
  );
  const all = context.processes();
  const panes = inspectPanes(all, context.tmux);
  const [slot] = plan(
    context.layout.root,
    registry,
    { config: context.layout.config, roles: [role] },
    panes,
    all,
  );
  const pane = panes.find((item) => item.pane === slot.pane);
  requireState(
    slot.state === "live" &&
      PANE.test(slot.pane) &&
      pane?.id === slot.id &&
      pane.role === role &&
      pane.harness === "codex" &&
      pane.session === slot.session &&
      pane.name === slot.name,
    "pane-identity-unverified",
  );
  return { ...slot, revision: registry.revision };
}

function currentSlot(context, previous) {
  const slot = slotFor(context, previous.role);
  requireState(
    slot.id === previous.id &&
      slot.pane === previous.pane &&
      slot.revision === previous.revision,
    "pane-binding-changed",
  );
  return slot;
}

function paneInfo(context, pane) {
  const format = [
    "#{pane_id}",
    "#{pane_pid}",
    "#{pane_current_command}",
    "#{pane_dead}",
    "#{pane_in_mode}",
    "#{pane_input_off}",
    "#{alternate_on}",
    "#{synchronize-panes}",
    "#{pane_width}",
    "#{pane_height}",
    "#{cursor_x}",
    "#{cursor_y}",
  ].join("\t");
  const value = context.tmux(["display-message", "-p", "-t", pane, format]);
  const [
    id,
    pid,
    command,
    dead,
    mode,
    inputOff,
    alternate,
    sync,
    width,
    height,
    x,
    y,
  ] = value.trimEnd().split("\t");
  requireState(
    id === pane &&
      /^[1-9]\d*$/.test(pid) &&
      command === "codex" &&
      [dead, mode, inputOff].every((flag) => flag === "0") &&
      (alternate === "0" || alternate === "1") &&
      (sync === "off" || sync === "0") &&
      [width, height, x, y].every((coordinate) => /^\d+$/.test(coordinate)) &&
      Number(width) >= 80 &&
      Number(width) <= 512 &&
      Number(height) >= SNAPSHOT_LINES &&
      Number(x) < Number(width) &&
      Number(y) < Number(height),
    "pane-input-unverified",
  );
  return {
    alternate,
    pid,
    width: Number(width),
    height: Number(height),
    x: Number(x),
    y: Number(y),
  };
}

function capture(context, pane, info) {
  const output = context.tmux([
    "capture-pane",
    "-p",
    "-t",
    pane,
    "-S",
    String(info.height - SNAPSHOT_LINES),
    "-E",
    String(info.height - 1),
  ]);
  return output
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.trimEnd());
}

function composer(lines) {
  const footer = lines.findLastIndex((line) => line !== "");
  if (footer < 0 || !SHORTCUTS.test(lines[footer])) return null;
  const model = lines.findLastIndex(
    (line, index) => index < footer && MODEL.test(line),
  );
  if (model < 2 || footer - model > 2) return null;
  if (footer === model + 2 && !/^ {2}\S/.test(lines[model + 1])) return null;
  if (lines[model - 1] !== "") return null;
  const row = lines[model - 2] === "" ? model - 3 : model - 2;
  const prompt = row < 0 ? null : /^› (.+)$/.exec(lines[row]);
  if (!prompt || CLIPPED.test(prompt[1])) return null;
  return { input: prompt[1], preceding: lines.slice(0, row), row };
}

function observe(context, slot, text) {
  const info = paneInfo(context, slot.pane);
  requireState(text.length + 4 < info.width, "composer-width-unverified");
  const lines = capture(context, slot.pane, info);
  requireState(lines.length === SNAPSHOT_LINES, "composer-layout-unverified");
  const frame = composer(lines);
  requireState(frame, "composer-layout-unverified");
  return { ...frame, info, lines };
}

function quiet(frame, input) {
  requireState(
    frame.input === input &&
      frame.info.x === (input === EMPTY ? 2 : input.length + 2) &&
      frame.info.y === frame.info.height - SNAPSHOT_LINES + frame.row,
    "composer-not-clear",
  );
  requireState(
    !frame.preceding.slice(-3).some((line) => BLOCKER.test(line)),
    "composer-blocker-visible",
  );
}

function samePane(previous, next) {
  return (
    previous.info.pid === next.info.pid &&
    previous.info.alternate === next.info.alternate &&
    previous.info.width === next.info.width &&
    previous.info.height === next.info.height
  );
}

function unchanged(previous, next) {
  return (
    samePane(previous, next) &&
    previous.info.x === next.info.x &&
    previous.info.y === next.info.y &&
    previous.lines.every((value, index) => value === next.lines[index])
  );
}

function reminderPlan(context) {
  const plan = context.kit(["reminder", "list"]);
  requireState(plan?.schema === 2, "store-plan-schema-unverified");
  const { candidates, inFlight } = plan;
  requireState(Array.isArray(candidates), "store-candidates-unavailable");
  requireState(Array.isArray(inFlight), "store-reconciliation-unavailable");
  const roles = new Set();
  const messages = new Set();
  const receipts = new Set();
  const registerRole = (role, reason) => {
    requireState(
      typeof role === "string" && ROLE.test(role) && !roles.has(role),
      reason,
    );
    roles.add(role);
  };
  const registerMessages = (ids, reason, allowEmpty = false) => {
    requireState(Array.isArray(ids) && (allowEmpty || ids.length > 0), reason);
    for (const id of ids) {
      requireState(
        typeof id === "string" && ORIGINAL.test(id) && !messages.has(id),
        reason,
      );
      messages.add(id);
    }
  };
  const previous = inFlight.map((receipt) => {
    requireState(
      typeof receipt?.id === "string" &&
        UUID.test(receipt.id) &&
        !receipts.has(receipt.id),
      "store-reconciliation-unavailable",
    );
    const { id, originals, role } = receipt;
    receipts.add(id);
    registerRole(role, "store-reconciliation-unavailable");
    registerMessages(originals, "store-reconciliation-unavailable");
    return { originals, receipt: id, role };
  });
  for (const candidate of candidates) {
    registerRole(candidate?.role, "store-candidate-invalid");
    registerMessages(candidate.originals, "store-original-invalid");
    registerMessages(
      candidate.deferredOriginals,
      "store-original-invalid",
      true,
    );
  }
  return { candidates, previous };
}

function confirmReceipt(receipt, slot, originals) {
  requireState(
    typeof receipt?.id === "string" &&
      UUID.test(receipt.id) &&
      receipt.role === slot.role &&
      receipt.harness === "codex" &&
      receipt.nativeId === slot.id &&
      UUID.test(receipt.nativeId) &&
      receipt.revision === slot.revision &&
      Array.isArray(receipt.originals) &&
      receipt.originals.length === originals.length &&
      originals.every((id, index) => receipt.originals[index] === id),
    "store-receipt-mismatch",
  );
}

function checkReceipt(context, original, slot) {
  const checked = context.kit(["reminder", "check", "--id", original.id]);
  requireState(checked?.schema === 1, "store-recheck-unavailable");
  confirmReceipt(checked.receipt, slot, original.originals);
  requireState(
    checked.receipt.id === original.id && checked.nativeIdle === true,
    "native-idle-unverified",
  );
}

function guardedKey(context, slot, info, literal) {
  const fields = [
    ["pane_pid", info.pid],
    ["pane_current_command", "codex"],
    ["pane_dead", "0"],
    ["pane_in_mode", "0"],
    ["pane_input_off", "0"],
    ["alternate_on", info.alternate],
    ["pane_width", info.width],
    ["pane_height", info.height],
    ["cursor_x", info.x],
    ["cursor_y", info.y],
    ["@agent-thread-id", slot.id],
    ["@game-session-role", slot.role],
    ["@game-session-harness", "codex"],
  ];
  const actual = fields.map(([name]) => `#{${name}}`).join("|");
  const expected = fields.map(([, value]) => value).join("|");
  const unsynchronized =
    "#{||:#{==:#{synchronize-panes},off},#{==:#{synchronize-panes},0}}";
  const condition = `#{&&:#{==:${actual},${expected}},${unsynchronized}}`;
  const command =
    literal === undefined
      ? `send-keys -t ${slot.pane} Enter`
      : `send-keys -t ${slot.pane} -l ${quote(literal)}`;
  const result = context
    .tmux([
      "if-shell",
      "-F",
      "-t",
      slot.pane,
      condition,
      command,
      "display-message -p reminder-refused",
    ])
    .trim();
  requireState(
    result === "" || result === "reminder-refused",
    "pane-key-outcome-unverified",
  );
  return result === "";
}

function submitted(context, slot, text, draft) {
  const frame = observe(context, currentSlot(context, slot), text);
  const transcriptCount = (view) =>
    view.preceding.filter((line) => line === `› ${text}`).length;
  return (
    samePane(draft, frame) &&
    frame.input === EMPTY &&
    frame.info.x === 2 &&
    frame.info.y === frame.info.height - SNAPSHOT_LINES + frame.row &&
    transcriptCount(frame) > transcriptCount(draft)
  );
}

async function attempt(context, candidate) {
  const { deferredOriginals, originals, role } = candidate;
  let wake = `${originals.length} new messages for ${role}: run coordination-kit inbox`;
  let receipt;
  let slot;
  let outcome = "refused";
  let reason = "guard-unavailable";
  let inserted = false;
  let claimAttempted = false;
  let stage = "pane";
  try {
    slot = slotFor(context, role);
    const initial = observe(context, slot, wake);
    quiet(initial, EMPTY);
    await context.wait(QUIET_MS);
    const stable = observe(context, currentSlot(context, slot), wake);
    quiet(stable, EMPTY);
    requireState(unchanged(initial, stable), "composer-changed");

    stage = "claim";
    claimAttempted = true;
    const claimed = context.kit([
      "reminder",
      "claim",
      "--role",
      role,
      ...originals.flatMap((id) => ["--original", id]),
    ]);
    requireState(claimed?.schema === 1, "store-claim-unavailable");
    confirmReceipt(claimed.receipt, slot, originals);
    receipt = claimed.receipt;
    requireState(
      claimed.notice === `${wake} [${receipt.id}]`,
      "store-notice-mismatch",
    );
    wake = claimed.notice;

    stage = "check";
    checkReceipt(context, receipt, slot);
    const before = observe(context, currentSlot(context, slot), wake);
    quiet(before, EMPTY);
    requireState(unchanged(stable, before), "composer-changed");

    stage = "literal";
    inserted = true;
    if (!guardedKey(context, slot, before.info, wake)) {
      inserted = false;
      throw new Refusal("pane-input-unverified");
    }
    await context.wait(PASTE_MS);
    const draft = observe(context, currentSlot(context, slot), wake);
    quiet(draft, wake);
    requireState(samePane(before, draft), "pane-binding-changed");
    stage = "check";
    checkReceipt(context, receipt, slot);
    const latest = observe(context, currentSlot(context, slot), wake);
    quiet(latest, wake);
    requireState(unchanged(draft, latest), "composer-changed");

    stage = "submit";
    requireState(
      guardedKey(context, slot, latest.info),
      "pane-input-unverified",
    );
    await context.wait(SUBMIT_MS);
    requireState(
      submitted(context, slot, wake, latest),
      "submission-unverified",
    );
    outcome = "submitted";
    reason = "exact-wake-observed";
  } catch (error) {
    if (inserted) outcome = "uncertain";
    reason =
      error instanceof Refusal
        ? error.message
        : stage === "claim"
          ? "store-claim-unavailable"
          : stage === "check"
            ? "store-recheck-unavailable"
            : "pane-observation-unavailable";
  }
  let settlement = receipt
    ? "unavailable"
    : claimAttempted
      ? "claim-unverified"
      : "not-claimed";
  if (receipt) {
    try {
      const settled = context.kit([
        "reminder",
        "settle",
        "--id",
        receipt.id,
        "--outcome",
        outcome,
        "--reason",
        reason,
      ]);
      if (
        settled?.schema === 1 &&
        settled.settlement?.id === receipt.id &&
        settled.settlement.outcome === outcome &&
        settled.settlement.reason === reason
      ) {
        settlement = "recorded";
      }
    } catch {
      settlement = "unavailable";
    }
  }
  return {
    ...(deferredOriginals.length > 0 ? { deferredOriginals } : {}),
    originals,
    outcome,
    pane: slot?.pane ?? null,
    reason,
    receipt: receipt?.id ?? null,
    role,
    settlement,
  };
}

export async function runInboxReminders(context) {
  const { candidates, previous } = reminderPlan(context);
  const outcomes = [];
  for (const candidate of candidates) {
    // Each pane's claim, input and settlement form one bounded attempt.
    outcomes.push(await attempt(context, candidate));
  }
  return {
    schema: 1,
    ...(previous.length > 0 ? { inFlight: previous } : {}),
    outcomes,
  };
}

function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: { root: { type: "string" } },
  });
  requireState(values.root, "explicit-coordinator-root-required");
  const root = realpathSync(values.root);
  const layout = loadLayout(root);
  const socket = controlSocket();
  return runInboxReminders({
    kit: (args) => kitCommand(root, args),
    layout,
    processes: () => processes("/proc", socket),
    registry: readRegistry,
    tmux,
    wait: delay,
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(JSON.stringify(await main()));
  } catch (error) {
    console.error(
      JSON.stringify({
        schema: 1,
        error:
          error instanceof Refusal ? error.message : "reminder-unavailable",
      }),
    );
    process.exitCode = 1;
  }
}
