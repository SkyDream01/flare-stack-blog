import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it } from "vitest";
import packageJson from "../package.json";

const root = path.resolve(import.meta.dirname, "..");
const scratch = path.join(root, ".scratch");
const fixtures: Array<string> = [];
const workflow = readFileSync(
  path.join(root, ".github/workflows/deploy.yml"),
  "utf8",
);
const command = workflow.match(
  /- name: Deploy Worker and apply D1 migrations\s+run: ([^\r\n]+)/,
)?.[1];
if (!command) throw new Error("Deploy workflow step is missing");

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    const resolved = path.resolve(fixture);
    if (
      path.dirname(resolved) !== scratch ||
      !path.basename(resolved).startsWith("deploy-workflow-")
    ) {
      throw new Error(
        "Refusing to remove a directory outside the test fixtures",
      );
    }
    rmSync(resolved, { recursive: true, force: true });
  }
});

function runDeploy(preflightVersion = packageJson.version) {
  mkdirSync(scratch, { recursive: true });
  const fixture = mkdtempSync(
    path.join(scratch, "deploy-workflow-with spaces-"),
  );
  fixtures.push(fixture);
  mkdirSync(path.join(fixture, "scripts"));
  // Exercise the real package script and workflow command with Cloudflare
  // commands replaced by a recorder. The real setup guard still runs.
  writeFileSync(
    path.join(fixture, "package.json"),
    JSON.stringify({
      name: "deploy-workflow-fixture",
      version: packageJson.version,
      type: "module",
      scripts: {
        deploy: packageJson.scripts.deploy
          .replace(
            "cf d1 migrations apply",
            "bun cf-fixture.ts d1 migrations apply",
          )
          .replace("cf deploy", "bun cf-fixture.ts deploy"),
      },
    }),
  );
  const guard = pathToFileURL(
    path.join(root, "scripts/deploy-preflight-core.ts"),
  );
  writeFileSync(
    path.join(fixture, "scripts/deploy-preflight.ts"),
    `import { appendFileSync } from "node:fs";
import { checkSetup } from ${JSON.stringify(guard.href)};
const setup = checkSetup(${JSON.stringify(preflightVersion)}, process.env);
appendFileSync("steps.jsonl", JSON.stringify({ step: "preflight", ...setup }) + "\\n");
if (!setup.ok) { console.error(setup.text); process.exit(1); }
`,
  );
  writeFileSync(
    path.join(fixture, "cf-fixture.ts"),
    `import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync("steps.jsonl", JSON.stringify({ step: args[0] === "d1" ? "migrate" : "deploy", args }) + "\\n");
`,
  );
  appendFileSync(path.join(fixture, "steps.jsonl"), "");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    WORKER_NAME: "workflow-fixture",
    D1_DATABASE_ID: "fixture-db",
    RUNNER_TEMP: fixture,
  };
  // A GitHub Actions run step does not receive Bun's package script variables.
  delete env.npm_package_version;
  const result = spawnSync("bun", ["--no-env-file", "exec", command!], {
    cwd: fixture,
    env,
    encoding: "utf8",
    timeout: 10_000,
  });
  const steps = readFileSync(path.join(fixture, "steps.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { result, steps, fixture };
}

it("supplies the release version and forwards the secrets file through preflight, migration and deployment", () => {
  const { result, steps, fixture } = runDeploy();
  expect(result.stderr, result.error?.message).not.toContain(
    "部署前检查未通过",
  );
  expect(result.status, result.stderr).toBe(0);
  expect(steps.map((step) => step.step)).toEqual([
    "preflight",
    "migrate",
    "deploy",
  ]);
  expect(steps[0]).toMatchObject({ ok: true, version: packageJson.version });
  expect(steps[1].args).toEqual(["d1", "migrations", "apply", "fixture-db"]);
  expect(steps[2].args).toEqual([
    "deploy",
    "--prebuilt",
    "--force",
    "--tag",
    `v${packageJson.version}`,
    "--secrets-file",
    `${fixture}/flare-stack-blog-secrets.json`,
  ]);
});

it("stops before migration and deployment when the preflight refuses the version", () => {
  const { result, steps } = runDeploy("0.0.0");
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("部署前检查未通过");
  expect(steps).toEqual([
    expect.objectContaining({ step: "preflight", ok: false }),
  ]);
});
