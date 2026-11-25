#!/usr/bin/env node
/**
 * Scaffold a new project from the best-ts-template repository.
 *
 * This script is intentionally dependency-free so it can run from a DSH skill
 * directory. It clones the template, runs the template's one-time rename
 * script, removes generator-only files, then installs and validates the new
 * project.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONFIG_FILE = join(SKILL_ROOT, "config.json");
const DEFAULT_BRANCH = "main";
const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SCOPE_PATTERN = /^@[a-z0-9][a-z0-9._-]*$/;
const EXCLUDED_SEGMENTS = new Set([
  ".git",
  ".data",
  ".turbo",
  ".next",
  "blob-report",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results"
]);
const EXCLUDED_FILES = new Set([".DS_Store"]);

function usage() {
  return `Usage: node scripts/scaffold.mjs --name <name> --scope <scope> [options]

Required:
  --name <value>          Project name in kebab-case, e.g. acme-app
  --scope <value>         npm scope for internal packages, e.g. @acme

Options:
  --display-name <value>  Human-readable name (default: title-cased name)
  --dir <path>            Destination directory (default: ./<name>)
  --template <value>      GitHub URL, owner/repo, or local template path
  --branch <value>        Git branch or tag (default: ${DEFAULT_BRANCH})
  --no-install            Do not run pnpm install (also skips check/build)
  --no-check              Skip pnpm check
  --no-build              Skip pnpm build
  --e2e                   Run pnpm test:e2e after the build
  --no-git                Do not initialize a git repository
  --keep-generator        Keep skills/ and scripts/init-template.mjs in the project
  --dry-run               Print the plan without touching the filesystem
  --help, -h              Show this help

Template resolution:
  1. --template
  2. TS_TEMPLATE_REPO environment variable
  3. templateRepo in ${CONFIG_FILE}

A local directory path is copied; a git URL is cloned with depth 1.
The destination must not exist, or must be an empty directory.`;
}

function expandHome(value) {
  if (value === "~") {
    return homedir();
  }
  if (value.startsWith(`~${sep}`)) {
    return join(homedir(), value.slice(2));
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    name: undefined,
    scope: undefined,
    displayName: undefined,
    dir: undefined,
    template: undefined,
    branch: undefined,
    install: true,
    check: true,
    build: true,
    e2e: false,
    git: true,
    keepGenerator: false,
    dryRun: false,
    help: false
  };
  const valueOptions = new Map([
    ["--name", "name"],
    ["--scope", "scope"],
    ["--display-name", "displayName"],
    ["--display", "displayName"],
    ["--dir", "dir"],
    ["--template", "template"],
    ["--branch", "branch"]
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--no-install") {
      options.install = false;
      continue;
    }
    if (argument === "--no-check") {
      options.check = false;
      continue;
    }
    if (argument === "--no-build") {
      options.build = false;
      continue;
    }
    if (argument === "--e2e") {
      options.e2e = true;
      continue;
    }
    if (argument === "--no-git") {
      options.git = false;
      continue;
    }
    if (argument === "--keep-generator") {
      options.keepGenerator = true;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const separator = argument.indexOf("=");
    const key = separator === -1 ? argument : argument.slice(0, separator);
    const inlineValue = separator === -1 ? undefined : argument.slice(separator + 1);
    const field = valueOptions.get(key);

    if (field === undefined) {
      throw new Error(`Unknown option: ${key}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (value === undefined || value === "") {
      throw new Error(`Missing value for ${key}`);
    }
    if (inlineValue === undefined) {
      index += 1;
    }
    options[field] = value;
  }

  return options;
}

function validateName(raw) {
  const name = raw.trim();

  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid project name "${raw}". Use lowercase kebab-case, for example "acme-app".`
    );
  }
  if (name.length > 214) {
    throw new Error("Project name must be at most 214 characters.");
  }
  if (name === "node_modules") {
    throw new Error('Project name "node_modules" is reserved.');
  }

  return name;
}

function validateScope(raw) {
  const scope = raw.trim();

  if (!SCOPE_PATTERN.test(scope)) {
    throw new Error(
      `Invalid npm scope "${raw}". Use a lowercase scope, for example "@acme" or "@acme-team".`
    );
  }
  if (scope.length > 214) {
    throw new Error("npm scope must be at most 214 characters.");
  }

  return scope;
}

function validateDisplayName(raw) {
  const displayName = raw.trim();

  if (!displayName) {
    throw new Error("Display name must not be empty.");
  }
  if (displayName.length > 80) {
    throw new Error("Display name must be at most 80 characters.");
  }
  if (
    [...displayName].some(
      (character) => (character.codePointAt(0) ?? 0) < 32 || character.codePointAt(0) === 127
    )
  ) {
    throw new Error("Display name must not contain control characters or newlines.");
  }
  if (/[<>]/.test(displayName)) {
    throw new Error('Display name must not contain "<" or ">" because it is used in HTML.');
  }

  return displayName;
}

function titleCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function readSkillConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const parsed = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    throw new Error(`Unable to parse ${CONFIG_FILE}: ${messageOf(error)}`);
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

async function isDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

function looksLikeGitUrl(value) {
  return (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("ssh://") ||
    value.startsWith("git://") ||
    value.startsWith("git@") ||
    value.startsWith("file://") ||
    value.endsWith(".git")
  );
}

function looksLikeGitHubShorthand(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) && !value.startsWith(".");
}

async function resolveTemplateSource(raw, config) {
  const candidate = raw ?? process.env.TS_TEMPLATE_REPO ?? config.templateRepo;

  if (candidate === undefined || String(candidate).trim() === "") {
    throw new Error(
      `No template repository configured.\n` +
        `Pass --template <github-url|local-path> or set TS_TEMPLATE_REPO.\n` +
        `You can also set "templateRepo" in ${CONFIG_FILE}.`
    );
  }

  const value = expandHome(String(candidate).trim());
  const localPath = resolve(value);

  if (await isDirectory(localPath)) {
    return { kind: "directory", value: localPath };
  }
  if (looksLikeGitHubShorthand(value)) {
    return { kind: "git", value: `https://github.com/${value}.git` };
  }
  if (looksLikeGitUrl(value)) {
    return { kind: "git", value };
  }

  throw new Error(
    `Template "${value}" is neither an existing directory nor a supported git URL.\n` +
      `Use a local path, owner/repo, or an https/ssh/file git URL.`
  );
}

async function prepareDestination(destination) {
  const root = parse(destination).root;

  if (destination === root || destination === homedir()) {
    throw new Error(`Refusing to use ${destination} as the project directory.`);
  }

  if (!existsSync(destination)) {
    await mkdir(dirname(destination), { recursive: true });
    return;
  }
  if (!(await isDirectory(destination))) {
    throw new Error(`Destination exists and is not a directory: ${destination}`);
  }

  const entries = await readdir(destination);
  if (entries.length > 0) {
    throw new Error(
      `Destination is not empty: ${destination}\n` +
        `Choose a new directory or remove the existing contents first.`
    );
  }

  // cp/git clone behave differently when the destination already exists.
  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
}

function shouldCopy(sourceRoot, candidate) {
  const relativePath = relative(sourceRoot, candidate);

  if (relativePath === "") {
    return true;
  }

  const parts = relativePath.split(sep);
  return !parts.some((part) => EXCLUDED_SEGMENTS.has(part) || EXCLUDED_FILES.has(part));
}

function run(command, args, options = {}) {
  console.log(`$ ${[command, ...args].join(" ")}`);

  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
    shell: options.shell ?? (process.platform === "win32" && command === "pnpm")
  });

  if (result.error) {
    throw new Error(`Unable to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status ?? "unknown"}.`);
  }
}

function initializeGit(destination) {
  if (existsSync(join(destination, ".git"))) {
    console.log("Git repository already exists; skipping git init.");
    return;
  }

  const initialized = spawnSync("git", ["init", "-b", "main"], {
    cwd: destination,
    stdio: "inherit"
  });

  if (initialized.error || initialized.status !== 0) {
    const fallback = spawnSync("git", ["init"], { cwd: destination, stdio: "inherit" });

    if (fallback.error || fallback.status !== 0) {
      throw new Error("Unable to initialize git repository. Pass --no-git to skip this step.");
    }

    spawnSync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], {
      cwd: destination,
      stdio: "inherit"
    });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const name = validateName(options.name);
  const scope = validateScope(options.scope);
  const displayName = validateDisplayName(options.displayName ?? titleCase(name));
  const config = await readSkillConfig();
  const template = await resolveTemplateSource(options.template, config);
  const branch =
    options.branch ?? process.env.TS_TEMPLATE_BRANCH ?? config.branch ?? DEFAULT_BRANCH;
  const destination = resolve(expandHome(options.dir ?? join(process.cwd(), name)));

  if (template.kind === "directory") {
    const source = template.value;
    if (
      destination === source ||
      destination.startsWith(`${source}${sep}`) ||
      source.startsWith(`${destination}${sep}`)
    ) {
      throw new Error("Destination and local template source must not contain each other.");
    }
  }

  const steps = [
    template.kind === "directory"
      ? `Copy template from ${template.value}`
      : `Clone ${template.value} (${branch})`,
    `Rename to ${name} (${scope})`,
    options.keepGenerator ? "Keep generator files" : "Remove generator files",
    options.install ? "Install dependencies" : "Skip dependency installation",
    options.install && options.check ? "Run pnpm check" : "Skip pnpm check",
    options.install && options.build ? "Run pnpm build" : "Skip pnpm build",
    options.install && options.e2e ? "Run pnpm test:e2e" : undefined,
    options.git ? "Initialize git repository" : "Skip git initialization"
  ].filter(Boolean);

  console.log(`Project: ${name}`);
  console.log(`Scope: ${scope}`);
  console.log(`Display name: ${displayName}`);
  console.log(`Destination: ${destination}`);
  console.log(`Template: ${template.value}${template.kind === "git" ? ` (${branch})` : ""}`);
  console.log("");
  console.log("Plan:");
  for (const [index, step] of steps.entries()) {
    console.log(`  ${index + 1}. ${step}`);
  }

  if (options.dryRun) {
    console.log("\nDry run: no files were written.");
    return;
  }

  await prepareDestination(destination);

  console.log(`\n[1/${steps.length}] Preparing template`);
  if (template.kind === "directory") {
    await cp(template.value, destination, {
      recursive: true,
      filter: (source) => shouldCopy(template.value, source)
    });
  } else {
    run("git", [
      "clone",
      "--depth",
      "1",
      "--single-branch",
      "--branch",
      branch,
      template.value,
      destination
    ]);
    await rm(join(destination, ".git"), { recursive: true, force: true });
  }

  const initScript = join(destination, "scripts", "init-template.mjs");
  if (!existsSync(initScript)) {
    throw new Error(
      `The template does not contain scripts/init-template.mjs. ` +
        `Check that ${template.value} is the intended template.`
    );
  }

  console.log(`\n[2/${steps.length}] Renaming project`);
  run("node", [initScript, "--name", name, "--scope", scope, "--display-name", displayName]);

  if (!options.keepGenerator) {
    console.log(`\n[3/${steps.length}] Removing generator files`);
    await rm(join(destination, "skills"), { recursive: true, force: true });
    await rm(initScript, { force: true });
  }

  if (options.install) {
    console.log(`\n[4/${steps.length}] Installing dependencies`);
    run("pnpm", ["install"], { cwd: destination });

    if (options.check) {
      console.log(`\n[5/${steps.length}] Running checks`);
      run("pnpm", ["check"], { cwd: destination });
    }
    if (options.build) {
      console.log(`\n[6/${steps.length}] Building`);
      run("pnpm", ["build"], { cwd: destination });
    }
    if (options.e2e) {
      console.log(`\n[7/${steps.length}] Running E2E`);
      run("pnpm", ["test:e2e"], { cwd: destination });
    }
  } else {
    console.log("\nSkipping pnpm install and all checks (--no-install).");
  }

  if (options.git) {
    console.log(`\n[${steps.length}/${steps.length}] Initializing git`);
    initializeGit(destination);
  }

  console.log("");
  console.log("Project created successfully.");
  console.log(`  path: ${destination}`);
  console.log(`  name: ${name}`);
  console.log(`  scope: ${scope}`);
  console.log(`  displayName: ${displayName}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${destination}`);
  console.log("  git status");
  console.log("  pnpm dev");
  if (!options.install) {
    console.log("  pnpm install");
  }
}

try {
  await main();
} catch (error) {
  console.error(`\nScaffold failed:\n${messageOf(error)}`);
  process.exitCode = 1;
}
