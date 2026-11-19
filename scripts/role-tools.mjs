import { execFileSync } from "node:child_process";
import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

export function probeBinary(command, args, env = process.env) {
  let executable;
  for (const directory of (env.PATH ?? "").split(delimiter).filter(Boolean)) {
    const candidate = resolve(directory, command);
    try {
      accessSync(candidate, constants.X_OK);
      if (statSync(candidate).isFile()) {
        executable = candidate;
        break;
      }
    } catch {
      // An absent or inaccessible PATH entry supplies no capability.
    }
  }
  if (!executable)
    return {
      status: "missing",
      reason: `${command} is not executable on PATH`,
    };
  try {
    const output = execFileSync(executable, args, {
      encoding: "utf8",
      timeout: 1500,
      maxBuffer: 4096,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const version = output.match(/\b\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?\b/)?.[0];
    return { status: "available", executable, ...(version ? { version } : {}) };
  } catch {
    return {
      status: "unavailable",
      reason: `${command} version probe failed or timed out`,
    };
  }
}

export function installedMessaging(root) {
  const directory = resolve(root, "node_modules/@andornaut/coordination-kit");
  const cli = join(directory, "dist/cli.js");
  try {
    const pkg = JSON.parse(
      readFileSync(join(directory, "package.json"), "utf8"),
    );
    if (
      pkg.name !== "@andornaut/coordination-kit" ||
      typeof pkg.version !== "string" ||
      !/^3\.\d+\.\d+$/.test(pkg.version) ||
      !pkg.exports?.["./build/registry"] ||
      !statSync(cli).isFile()
    )
      throw new Error("Unsupported installed CLI metadata");
    return { status: "available", cli, version: pkg.version };
  } catch {
    return {
      status: "missing",
      cli,
      reason:
        "Coordinator coordination-kit 2.x CLI/canonical build exports missing or incompatible",
    };
  }
}

export function roleTools(root, slot, contract, ports = {}) {
  const probe = ports.probe ?? probeBinary;
  const messaging = (ports.messaging ?? installedMessaging)(root);
  const launch = {
    frontend: probe(slot.harness, ["--version"]),
    tmux: probe("tmux", ["-V"]),
    flock: probe("flock", ["--version"]),
    messaging,
  };
  const launchIssues = Object.entries(launch)
    .filter(([, result]) => result.status !== "available")
    .map(([name, result]) => `${slot.role}: ${name}: ${result.reason}`);
  const required = contract.tools.required;
  const desired = [...new Set([...required, ...contract.tools.whenNeeded])];
  const capabilities = desired.map((id) => {
    let result;
    if (id === "repository") {
      try {
        if (
          !statSync(slot.cwd).isDirectory() ||
          !statSync(slot.worktree).isDirectory()
        )
          throw new Error("Missing path");
        result = {
          status: "available",
          reason: "Registered root and edit worktree exist",
        };
      } catch {
        result = {
          status: "missing",
          reason: "Registered root or edit worktree missing",
        };
      }
    } else if (id === "git") {
      result = probe("git", ["--version"]);
    } else if (
      ["role-messaging", "registry", "delivery-observation"].includes(id)
    ) {
      result = {
        ...messaging,
        reason:
          messaging.reason ??
          "Installed public CLI/API metadata verified; native and resident state unverified",
      };
    } else if (id === "isolated-checks") {
      result = {
        ...probe("docker", ["--version"]),
        reason:
          "Docker CLI probe only; engine, isolation and task admission remain unverified",
      };
    } else {
      result = {
        status: "unavailable",
        reason:
          "Requires supported tools advertised by this conversation; native capabilities unknown",
      };
    }
    return { id, required: required.includes(id), ...result };
  });
  return {
    launch,
    launchIssues,
    capabilities,
    gaps: capabilities.filter((tool) => tool.status !== "available"),
    nativeCapabilities: "unknown",
  };
}
