import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, posix, resolve } from "node:path";
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
const roleDocsPath = "docs/reference/roles.md";
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
        /^docs\/(?:[a-z-]+\/)*[a-z-]+\.md(?:#[a-z-]+)?$/.test(reference.path),
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
// Game roles collapse per game: `game/{art,gameplay,tech}`.
function roleNames(names) {
  const games = new Map();
  const out = [];
  for (const name of names) {
    const [game, type] = name.split("/");
    if (!type) out.push(name);
    else if (games.has(game)) games.get(game).push(type);
    else {
      games.set(game, [type]);
      out.push(game);
    }
  }
  return out
    .map((name) =>
      games.has(name)
        ? games.get(name).length > 1
          ? `${name}/{${games.get(name).join(",")}}`
          : `${name}/${games.get(name)[0]}`
        : name,
    )
    .join(", ");
}

export function renderBrief(catalog, context) {
  if (
    !record(context) ||
    ![
      "root",
      "role",
      "harness",
      "id",
      "cwd",
      "worktree",
      "checkpoint",
      "registryFile",
    ].every((key) => text(context[key])) ||
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
  const node =
    "node " +
    quote(
      resolve(
        context.root,
        "node_modules/@andornaut/coordination-kit/dist/cli.js",
      ),
    );
  const under = (base, path, name) => {
    const prefix = base.replace(/\/$/, "") + "/";
    if (!path.startsWith(prefix) || path === base) return path;
    return `${path.slice(prefix.length)}${name ? ` under ${name}` : ""}`;
  };
  const handoff =
    contract.type === "game-coordinator"
      ? "`CK handoff open|state|ready|active|show`"
      : "`CK handoff ready|active|show`; only game-coordinator opens handoffs and sets state";
  const peers = [
    "game-coordinator",
    "art-kit",
    "game-kit",
    "delivery-kit",
    "coordination-kit",
  ].filter((type) => type !== contract.type);
  return [
    `Role: ${context.role} (${context.harness}); conversation ${context.id}; registry revision: ${context.registryRevision}.`,
    // Every verb takes the coordinator from the environment; work verbs read --root as the repository.
    `CK is: COORDINATION_KIT_ROOT=${quote(context.root)} ${node}. Run work verbs from the repository checkout.`,
    `Native cwd: ${context.cwd}`,
    `Role worktree: ${under(context.cwd, context.worktree, "the native cwd")}`,
    `Checkpoint: ${under(context.root, context.checkpoint, "COORDINATION_KIT_ROOT")}`,
    `Handoff HOLD: ${context.held ? "preserve" : "none asserted"}.`,
    `Purpose: ${contract.purpose}`,
    `Own: ${contract.owns.join("; ")}.`,
    `Boundaries: ${contract.boundaries.join("; ")}.`,
    `Handoffs: ${contract.handoffs.join("; ")}.`,
    `Shared kit owners (purposes in ${roleDocsPath}): ${peers.join(", ")}.`,
    `Protocol: ${catalog.protocol.join(" ")}`,
    `Workflow: ${catalog.workflow.map((step) => `${step.stage} (${step.owner})`).join(" -> ")}.`,
    `Desired tools, not installed proof; verify: core ${contract.tools.required.join(", ")}; task-specific ${contract.tools.whenNeeded.join(", ") || "none"}.`,
    ...(contacts.length
      ? [
          `Roles (\`CK msg send --to NAME\`; harness, cwd and checkpoint in ${under(context.root, context.registryFile)}): ${roleNames(contacts.map((contact) => contact.role))}.`,
        ]
      : []),
    ...tools.map(
      (tool) =>
        `Observed tool ${tool.id}: ${tool.status}${tool.version ? " (" + tool.version + ")" : ""}${tool.reason ? "; " + tool.reason : ""}; ${tool.required ? "required by startup check" : "task-specific"}.`,
    ),
    "`CK session start` records this session and refuses a held role; `CK status --scope SCOPE` is read-only.",
    "`CK inbox --include-body`; `CK msg send --to ROLE --body-file FILE`; close with `CK msg done ID` or `CK msg retain ID --reason TEXT --next-boundary TEXT`.",
    "Only the item owner writes work, and ready is a handoff: `CK work start|block|ready|finish|show|history ID`; `CK work evidence ID --stage STAGE --sha SHA`.",
    "Record each pending user prompt; answer, cancel or release only your own: `CK question open|answer|cancel`; `CK hold set|release|list`.",
    `\`CK request close --id ID --reason TEXT\` closes an imported request you own; ${handoff}.`,
    `References under COORDINATION_KIT_ROOT: ${catalog.references
      .map((reference, index) => {
        const [file] = reference.path.split("#");
        const previous = catalog.references[index - 1]?.path.split("#")[0];
        return `${reference.label} ${file === previous ? reference.path.slice(file.length) : reference.path}`;
      })
      .join("; ")}.`,
    `Catalog: ${catalogHash(catalog).slice(0, 16)}`,
    "",
  ].join("\n");
}

const word = /^[a-z][a-z-]*$/;

/** Verbs ("group verb" or a bare command) in the command forms table of coordination-kit docs/commands.md. */
export function commandVerbs(markdown) {
  const section = markdown
    .split(/^## /m)
    .find((part) => part.startsWith("Command forms"));
  if (!section) throw new Error("commands.md has no Command forms section");
  const verbs = new Set();
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const first = line.split(/(?<!\\)\|/)[1] ?? "";
    for (const [, form] of first.matchAll(/`([^`]+)`/g)) {
      const [group, verb] = form.replaceAll("\\|", "|").trim().split(/\s+/);
      if (word.test(group))
        verbs.add(word.test(verb ?? "") ? `${group} ${verb}` : group);
    }
  }
  if (verbs.size === 0) throw new Error("commands.md lists no command forms");
  return verbs;
}

/** Verbs a rendered brief invokes as `CK ...`, expanding "group a|b". */
export function briefVerbs(brief) {
  const verbs = new Set();
  for (const [, group, alternatives] of brief.matchAll(
    /`CK ([a-z][a-z-]*)(?: ([a-z][a-z-]*(?:\|[a-z][a-z-]*)*))?(?=[\s`])/g,
  )) {
    if (alternatives === undefined) verbs.add(group);
    else
      for (const verb of alternatives.split("|")) verbs.add(`${group} ${verb}`);
  }
  return verbs;
}

const cell = (value) => value.replaceAll("|", "\\|");
export function renderRoleDocs(catalog) {
  validate(catalog);
  const docsDirectory = posix.dirname(roleDocsPath);
  return [
    "# Role contracts",
    "",
    `Generated from [roles.json](${posix.relative(docsDirectory, "roles.json")}). Run \`node scripts/role-catalog.mjs\` to regenerate or add \`--check\` to detect drift.`,
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
      (reference) =>
        `- [${reference.label}](${posix.relative(docsDirectory, reference.path)})`,
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
  const path = resolve(root, roleDocsPath);
  const expected = renderRoleDocs(loadCatalog(root));
  if (!check) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected);
  } else {
    let actual;
    try {
      actual = readFileSync(path, "utf8");
    } catch {
      /* Missing generated output is stale. */
    }
    if (actual !== expected)
      throw new Error(
        `${roleDocsPath} is stale; run node scripts/role-catalog.mjs`,
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
