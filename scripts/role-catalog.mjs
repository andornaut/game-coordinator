import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const types = [
  "art",
  "gameplay",
  "tech",
  "art-kit",
  "game-kit",
  "delivery-kit",
  "coordination-kit",
  "game-coordinator",
];
const text = (value) =>
  typeof value === "string" && value.trim().length > 0 && !/[\r\n]/.test(value);
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(text) &&
  new Set(value).size === value.length;

function validate(catalog) {
  if (
    !record(catalog) ||
    catalog.schema !== 1 ||
    !strings(catalog.protocol) ||
    !record(catalog.roles) ||
    !record(catalog.tools)
  ) {
    throw new Error("Invalid role catalog header");
  }
  if (Object.keys(catalog.roles).sort().join() !== [...types].sort().join())
    throw new Error("Catalog must define exactly the known role types");
  if (
    !Object.entries(catalog.tools).every(
      ([id, tool]) =>
        /^[a-z]+(?:-[a-z]+)*$/.test(id) &&
        record(tool) &&
        text(tool.description),
    )
  ) {
    throw new Error("Invalid tool capability");
  }
  for (const type of types) {
    const role = catalog.roles[type];
    if (
      !record(role) ||
      !text(role.name) ||
      !text(role.purpose) ||
      role.scope !== (type.includes("-") ? "shared" : "game") ||
      ![role.owns, role.boundaries, role.handoffs].every(strings) ||
      !record(role.tools)
    ) {
      throw new Error(`Invalid role contract: ${type}`);
    }
    if (
      !strings(role.tools.required) ||
      !Array.isArray(role.tools.whenNeeded) ||
      !role.tools.whenNeeded.every(text)
    )
      throw new Error(`Invalid tools: ${type}`);
    const tools = [...role.tools.required, ...role.tools.whenNeeded];
    if (
      new Set(tools).size !== tools.length ||
      tools.some((id) => !Object.hasOwn(catalog.tools, id))
    )
      throw new Error(`Unknown or repeated tool: ${type}`);
  }
  if (
    !Array.isArray(catalog.workflow) ||
    catalog.workflow.length === 0 ||
    !catalog.workflow.every(
      (step) =>
        record(step) && [step.stage, step.owner, step.evidence].every(text),
    )
  )
    throw new Error("Invalid workflow");
  if (
    !Array.isArray(catalog.references) ||
    catalog.references.length === 0 ||
    !catalog.references.every(
      (reference) =>
        record(reference) &&
        text(reference.label) &&
        /^docs\/[a-z-]+\.md(?:#[a-z-]+)?$/.test(reference.path),
    )
  )
    throw new Error("Invalid references");
  return catalog;
}

export function loadCatalog(root) {
  return validate(
    JSON.parse(readFileSync(resolve(root, "roles.json"), "utf8")),
  );
}

/** Resolve a type or a game-qualified role without consulting or inventing registry identity. */
export function roleContract(catalog, role) {
  validate(catalog);
  if (!text(role)) throw new Error("Role is required");
  const match = /^([^/\r\n]+)\/(art|gameplay|tech)$/.exec(role);
  const type = match?.[2] ?? role;
  if (
    !Object.hasOwn(catalog.roles, type) ||
    (role.includes("/") && match === null)
  )
    throw new Error(`Unknown role: ${role}`);
  return { ...catalog.roles[type], role, type };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export function catalogHash(catalog) {
  validate(catalog);
  return createHash("sha256")
    .update(JSON.stringify(canonical(catalog)))
    .digest("hex");
}

/** Context is supplied by the verified startup caller; this function performs no native work. */
export function renderBrief(catalog, context) {
  if (
    !record(context) ||
    !["root", "role", "harness", "id", "cwd", "worktree", "checkpoint"].every(
      (key) => text(context[key]),
    ) ||
    !["claude", "codex"].includes(context.harness) ||
    !Number.isSafeInteger(context.registryRevision) ||
    context.registryRevision < 0 ||
    typeof context.held !== "boolean"
  )
    throw new Error("Complete explicit startup context is required");
  const contract = roleContract(catalog, context.role);
  const contacts = context.contacts ?? [];
  const tools = context.tools ?? [];
  if (
    !Array.isArray(contacts) ||
    !contacts.every(
      (contact) =>
        record(contact) &&
        ["role", "harness", "id", "cwd", "worktree", "checkpoint"].every(
          (key) => text(contact[key]),
        ) &&
        ["claude", "codex"].includes(contact.harness),
    )
  )
    throw new Error("Invalid role contacts");
  for (const contact of contacts) roleContract(catalog, contact.role);
  if (
    !Array.isArray(tools) ||
    !tools.every(
      (tool) =>
        record(tool) &&
        Object.hasOwn(catalog.tools, tool.id) &&
        ["available", "missing", "unavailable"].includes(tool.status) &&
        typeof tool.required === "boolean" &&
        ["reason", "version"].every(
          (key) => tool[key] === undefined || text(tool[key]),
        ),
    )
  )
    throw new Error("Invalid tool observations");
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  const cli =
    "node " +
    quote(
      resolve(context.root, "node_modules/@andornaut/delivery-kit/dist/cli.js"),
    ) +
    " --root " +
    quote(context.root);
  const peers = [
    "game-coordinator",
    "art-kit",
    "game-kit",
    "delivery-kit",
    "coordination-kit",
  ];
  return [
    `Role: ${context.role} (${context.harness})`,
    `Registered conversation: ${context.id}; registry revision: ${context.registryRevision}.`,
    `Coordinator root: ${context.root}; native cwd: ${context.cwd}; role worktree: ${context.worktree}.`,
    `Checkpoint: ${context.checkpoint}. Handoff HOLD: ${context.held ? "preserve" : "none asserted"}; preserve independent holds and pending questions.`,
    `Purpose: ${contract.purpose}`,
    `Own: ${contract.owns.join("; ")}.`,
    `Boundaries: ${contract.boundaries.join("; ")}.`,
    `Handoffs: ${contract.handoffs.join("; ")}.`,
    "Shared owners:",
    ...peers.map((type) => `${type}: ${catalog.roles[type].purpose}`),
    `Protocol: ${catalog.protocol.join(" ")}`,
    `Workflow: ${catalog.workflow.map((step) => `${step.stage} (${step.owner})`).join(" -> ")}.`,
    `Desired tools, not installed proof: core ${contract.tools.required.join(", ")}; task-specific ${contract.tools.whenNeeded.join(", ") || "none"}. Verify task readiness before use.`,
    ...contacts.map(
      (contact) =>
        `Contact ${contact.role}: ${contact.harness}/${contact.id}; cwd ${contact.cwd}; worktree ${contact.worktree}; checkpoint ${contact.checkpoint}.`,
    ),
    ...tools.map(
      (tool) =>
        `Observed tool ${tool.id}: ${tool.status}${tool.version ? " (" + tool.version + ")" : ""}${tool.reason ? "; " + tool.reason : ""}; ${tool.required ? "required by startup check" : "task-specific"}.`,
    ),
    `Inbox: ${cli} message status --recipient ${quote(context.role)} --include-body`,
    `Record approved work locally: ${cli} message send --from ${quote(context.role)} --recipient ROLE --id UUID --body-file FILE`,
    `References: ${catalog.references.map((reference) => `${reference.label}: ${resolve(context.root, reference.path)}`).join("; ")}.`,
    `Catalog: ${catalogHash(catalog)}`,
    "",
  ].join("\n");
}

const cell = (value) => value.replaceAll("|", "\\|");
export function renderRoleDocs(catalog) {
  validate(catalog);
  return [
    "# Role contracts",
    "",
    "Generated from [roles.json](../roles.json). Run `node scripts/role-catalog.mjs` to regenerate or add `--check` to detect drift.",
    "",
    "These contracts describe duties and desired capabilities. They grant no authority and do not prove installed tools, native identity or activation.",
    "",
    "## Shared protocol",
    "",
    ...catalog.protocol.map((line) => `- ${line}`),
    "",
    "## Workflow",
    "",
    "| Stage | Owner | Evidence |",
    "| --- | --- | --- |",
    ...catalog.workflow.map(
      (step) =>
        `| ${cell(step.stage)} | ${cell(step.owner)} | ${cell(step.evidence)} |`,
    ),
    "",
    "## Roles",
    "",
    "Game roles are addressed as `<game>/art`, `<game>/gameplay` and `<game>/tech`. Shared roles use their names directly. Repository file ownership maps remain authoritative.",
    "",
    ...types.flatMap((type) => {
      const role = catalog.roles[type];
      return [
        `### ${role.name}`,
        "",
        role.purpose,
        "",
        `- Owns: ${role.owns.join("; ")}.`,
        `- Boundaries: ${role.boundaries.join("; ")}.`,
        `- Handoffs: ${role.handoffs.join("; ")}.`,
        `- Desired tools: core ${role.tools.required.join(", ")}; task-specific ${role.tools.whenNeeded.join(", ") || "none"}.`,
        "",
      ];
    }),
    "## Desired capabilities",
    "",
    "Capability IDs are shared by Claude and Codex. Startup checks must report actual availability separately; this list is not installation evidence.",
    "",
    "| ID | Capability |",
    "| --- | --- |",
    ...Object.entries(catalog.tools).map(
      ([id, tool]) => `| ${id} | ${cell(tool.description)} |`,
    ),
    "",
    "## References",
    "",
    ...catalog.references.map(
      (reference) => `- [${reference.label}](${reference.path.slice(5)})`,
    ),
    "",
  ].join("\n");
}

export function main(args = process.argv.slice(2)) {
  let root = process.cwd();
  let check = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--check") check = true;
    else if (
      args[index] === "--root" &&
      text(args[index + 1]) &&
      !args[index + 1].startsWith("--")
    )
      root = resolve(args[++index]);
    else
      throw new Error(
        "Usage: node scripts/role-catalog.mjs [--root PATH] [--check]",
      );
  }
  const path = resolve(root, "docs/roles.md");
  const expected = renderRoleDocs(loadCatalog(root));
  if (!check) writeFileSync(path, expected);
  else {
    let actual;
    try {
      actual = readFileSync(path, "utf8");
    } catch {
      /* Missing generated output is stale. */
    }
    if (actual !== expected)
      throw new Error(
        "docs/roles.md is stale; run node scripts/role-catalog.mjs",
      );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
