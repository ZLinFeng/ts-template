import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspace = fileURLToPath(new URL("../", import.meta.url));
const target = relative(workspace, process.cwd()) || ".";

for (const [tool, ...args] of [
  ["oxlint", "--fix", "--deny-warnings"],
  ["prettier", "--write", "--log-level", "warn"]
]) {
  const manifest = require.resolve(`${tool}/package.json`);
  const { bin } = require(manifest);
  const cli = resolve(dirname(manifest), typeof bin === "string" ? bin : bin[tool]);
  const result = spawnSync(process.execPath, [cli, ...args, target], {
    cwd: workspace,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`${tool}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exitCode = 1;
  }
}
