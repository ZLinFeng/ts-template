#!/usr/bin/env node
/**
 * Rename this template into a concrete project.
 *
 * The repository intentionally keeps working, concrete names so it can be
 * installed, tested and built as-is. This script is the one-time bridge from
 * those template names to a new project identity.
 */
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const TEMPLATE_NAME = "best-ts-template";
const TEMPLATE_SCOPE = "@best-ts";
const TEMPLATE_DISPLAY_NAME = "Best TS Template";
const TEMPLATE_MARKERS = [
  ["<!-- template:start -->", "<!-- template:end -->"],
  ["# template:start", "# template:end"]
];
const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SCOPE_PATTERN = /^@[a-z0-9][a-z0-9._-]*$/;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const SKIP_DIRECTORIES = new Set([
  ".git",
  ".data",
  ".turbo",
  ".next",
  "blob-report",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "skills",
  "test-results"
]);
const SKIP_FILES = new Set([".DS_Store", "pnpm-lock.yaml"]);

function usage() {
  return `Usage: node scripts/init-template.mjs [options]

Options:
  --name <value>          Project name in kebab-case (required), e.g. acme-app
  --scope <value>         npm scope for internal packages (required), e.g. @acme
  --display-name <value>  Human-readable name used in README and HTML title
  --dry-run               Show what would change without writing files
  --force                 Continue even when the root package name is not the template
  --help, -h              Show this help

The script must run from the template repository root. Run \`pnpm install\`
afterwards to regenerate pnpm-lock.yaml.`;
}

function parseArgs(argv) {
  const options = {
    name: undefined,
    scope: undefined,
    displayName: undefined,
    dryRun: false,
    force: false,
    help: false
  };
  const valueOptions = new Map([
    ["--name", "name"],
    ["--scope", "scope"],
    ["--display-name", "displayName"],
    ["--display", "displayName"]
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--force") {
      options.force = true;
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
      (character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127
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

async function promptMissingOptions(options) {
  const missing = [];

  if (options.name === undefined) {
    missing.push("name");
  }
  if (options.scope === undefined) {
    missing.push("scope");
  }

  if (missing.length === 0) {
    return options;
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      `Missing required option(s): ${missing.join(", ")}. Pass --name and --scope for non-interactive use.`
    );
  }

  const terminal = createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (options.name === undefined) {
      options.name = await terminal.question("Project name (kebab-case, e.g. acme-app): ");
    }
    if (options.scope === undefined) {
      options.scope = await terminal.question("npm scope (e.g. @acme): ");
    }
    if (options.displayName === undefined) {
      const fallback = titleCase(validateName(options.name));
      const answer = await terminal.question(`Display name (default: ${fallback}): `);
      options.displayName = answer.trim() || fallback;
    }
  } finally {
    terminal.close();
  }

  return options;
}

async function readTextFile(file) {
  const contents = await readFile(file);

  // Skip binaries without relying on an extension allow-list: Dockerfiles,
  // Makefiles and dotfiles do not have useful extensions either.
  if (contents.includes(0)) {
    return undefined;
  }

  return contents.toString("utf8");
}

async function collectFiles() {
  const files = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          await walk(fullPath);
        }
        continue;
      }
      if (!entry.isFile() || fullPath === SELF || SKIP_FILES.has(entry.name)) {
        continue;
      }

      const metadata = await stat(fullPath);
      if (metadata.size <= MAX_FILE_SIZE) {
        files.push(fullPath);
      }
    }
  }

  await walk(ROOT);
  return files;
}

function applyReplacements(contents, replacements) {
  let result = contents;

  for (const [from, to] of replacements) {
    result = result.split(from).join(to);
  }

  return result;
}

function stripTemplateBlock(contents) {
  for (const [startMarker, endMarker] of TEMPLATE_MARKERS) {
    const start = contents.indexOf(startMarker);
    const end = contents.indexOf(endMarker);

    if (start === -1 || end === -1 || end < start) {
      continue;
    }

    const before = contents.slice(0, start);
    const after = contents.slice(end + endMarker.length);
    return `${before.trimEnd()}\n\n${after.trimStart()}`.trimEnd() + "\n";
  }

  return contents;
}

async function findLeftovers() {
  const files = await collectFiles();
  const leftovers = [];

  for (const file of files) {
    const contents = await readTextFile(file);

    if (contents === undefined) {
      continue;
    }
    if (contents.includes("best-ts") || contents.includes(TEMPLATE_DISPLAY_NAME)) {
      leftovers.push(relative(ROOT, file));
    }
  }

  return leftovers;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function validateRenamedProject(name, scope) {
  const rootPackage = await readJson(join(ROOT, "package.json"));

  if (rootPackage.name !== name) {
    throw new Error(`Root package.json has name "${rootPackage.name}", expected "${name}".`);
  }

  for (const packagePath of ["apps/api", "apps/web", "apps/admin", "packages/shared"]) {
    const manifest = await readJson(join(ROOT, packagePath, "package.json"));

    if (!manifest.name.startsWith(`${scope}/`)) {
      throw new Error(
        `${packagePath}/package.json has name "${manifest.name}", expected "${scope}/...".`
      );
    }
  }

  const adminPackage = await readJson(join(ROOT, "apps/admin/package.json"));
  const expectedBin = `${name}-admin`;

  if (adminPackage.bin?.[expectedBin] !== "./dist/index.js") {
    throw new Error(`apps/admin/package.json is missing the "${expectedBin}" bin entry.`);
  }
  if (!adminPackage.scripts?.["build:bin"]?.includes(`dist/${expectedBin}`)) {
    throw new Error(`apps/admin/package.json build:bin does not output dist/${expectedBin}.`);
  }

  const leftovers = await findLeftovers();
  if (leftovers.length > 0) {
    throw new Error(
      `Template identifiers remain in:\n${leftovers.map((file) => `  - ${file}`).join("\n")}`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  await promptMissingOptions(options);

  const name = validateName(options.name);
  const scope = validateScope(options.scope);
  const displayName = validateDisplayName(options.displayName ?? titleCase(name));
  const rootPackage = await readJson(join(ROOT, "package.json"));

  if (rootPackage.name !== TEMPLATE_NAME && !options.force) {
    const leftovers = await findLeftovers();

    if (leftovers.length === 0) {
      console.log(`Already initialized as "${rootPackage.name}"; nothing to do.`);
      return;
    }

    throw new Error(
      `This directory is not the "${TEMPLATE_NAME}" template (package name is "${rootPackage.name}").\n` +
        `Use --force only if you intentionally want to replace the remaining template identifiers.`
    );
  }

  const replacements = [
    [TEMPLATE_NAME, name],
    [TEMPLATE_SCOPE, scope],
    ["best-ts", name],
    [TEMPLATE_DISPLAY_NAME, displayName]
  ];
  const files = await collectFiles();
  const changed = [];

  for (const file of files) {
    const original = await readTextFile(file);

    if (original === undefined) {
      continue;
    }

    const renamed = applyReplacements(original, replacements);
    const contents = stripTemplateBlock(renamed);

    if (contents !== original) {
      changed.push({ file, contents });
    }
  }

  if (options.dryRun) {
    console.log(`Would update ${changed.length} file(s) for ${name} (${scope}):`);
    for (const { file } of changed) {
      console.log(`  - ${relative(ROOT, file)}`);
    }
    console.log("Dry run: no files were written.");
    return;
  }

  for (const { file, contents } of changed) {
    await writeFile(file, contents);
  }

  await validateRenamedProject(name, scope);

  console.log("Template initialized:");
  console.log(`  name: ${name}`);
  console.log(`  scope: ${scope}`);
  console.log(`  displayName: ${displayName}`);
  console.log(`  files changed: ${changed.length}`);
  console.log("");
  console.log("Next steps:");
  console.log("  pnpm install --no-frozen-lockfile   # regenerates pnpm-lock.yaml");
  console.log("  pnpm check                           # format, lint, typecheck and unit tests");
  console.log("  pnpm build");
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Template initialization failed:\n${message}`);
  process.exitCode = 1;
}
