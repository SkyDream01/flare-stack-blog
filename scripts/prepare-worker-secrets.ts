import { writeFileSync } from "node:fs";
import { z } from "zod";

type EnvMap = Record<string, string | undefined>;

const bindingSchema = z.object({
  name: z.string(),
  type: z.string(),
  text: z.string().optional(),
});

type WorkerBinding = z.infer<typeof bindingSchema>;

const runtimeNames = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "DOMAIN",
  "ENVIRONMENT",
  "LOCALE",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "UMAMI_WEBSITE_ID",
  "UMAMI_SRC",
  "UMAMI_API_URL",
  "UMAMI_API_KEY",
  "UMAMI_USERNAME",
  "UMAMI_PASSWORD",
  "TURNSTILE_SECRET_KEY",
  "GITHUB_TOKEN",
] as const;

const requiredRuntimeNames = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "DOMAIN",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
] as const;

function requireEnv(env: EnvMap, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function prepareWorkerSecrets(
  bindings: WorkerBinding[],
  env: EnvMap,
): Record<string, string> {
  const values: Record<string, string> = Object.fromEntries(
    bindings
      .filter((binding) => binding.type === "plain_text")
      .map((binding) => {
        if (binding.text === undefined) {
          throw new Error(`Worker variable has no text: ${binding.name}`);
        }
        return [binding.name, binding.text];
      }),
  );

  for (const name of runtimeNames) {
    const value = env[name];
    if (value) values[name] = value;
  }

  // cf deploy keeps existing secret bindings without exposing their values.
  const existingSecrets = new Set(
    bindings
      .filter((binding) => binding.type === "secret_text")
      .map((binding) => binding.name),
  );
  const missing = requiredRuntimeNames.filter(
    (name) => !values[name] && !existingSecrets.has(name),
  );
  if (missing.length) {
    throw new Error(`Missing required Worker secrets: ${missing.join(", ")}`);
  }

  return values;
}

export async function readWorkerBindings(
  env: EnvMap,
): Promise<WorkerBinding[]> {
  const account = requireEnv(env, "CLOUDFLARE_ACCOUNT_ID");
  const worker = requireEnv(env, "WORKER_NAME");
  const token = requireEnv(env, "CLOUDFLARE_API_TOKEN");

  // cf beta.5 has no command for reading script settings. This read-only API
  // supplies legacy text bindings; cf deploy performs the actual secret upload.
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/scripts/${encodeURIComponent(worker)}/settings`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    },
  );
  const body = await response.json();
  const result = z
    .object({
      success: z.boolean(),
      errors: z.array(z.object({ code: z.number() })).optional(),
      result: z.object({ bindings: z.array(bindingSchema) }).nullish(),
    })
    .parse(body);

  // Cloudflare's 10007 means the Worker does not exist yet. Other errors must
  // stop deployment, otherwise unread legacy variables could be discarded.
  if (response.status === 404 && result.errors?.some((e) => e.code === 10007)) {
    return [];
  }
  if (!response.ok || !result.success || !result.result) {
    throw new Error(`Unable to read Worker settings (HTTP ${response.status})`);
  }
  return result.result.bindings;
}

if (import.meta.main) {
  for (const name of [
    "WORKER_NAME",
    "QUEUE_NAME",
    "DOMAIN",
    "D1_DATABASE_ID",
    "KV_NAMESPACE_ID",
    "BUCKET_NAME",
  ]) {
    requireEnv(process.env, name);
  }
  const output = process.argv[2];
  if (!output) throw new Error("Provide a temporary secrets JSON file path");

  const bindings = await readWorkerBindings(process.env);
  const values = prepareWorkerSecrets(bindings, process.env);
  if (process.env.GITHUB_ACTIONS === "true") {
    for (const value of Object.values(values)) {
      if (!value) continue;
      const escaped = value
        .replaceAll("%", "%25")
        .replaceAll("\r", "%0D")
        .replaceAll("\n", "%0A");
      console.log(`::add-mask::${escaped}`);
    }
  }
  writeFileSync(output, JSON.stringify(values), { mode: 0o600 });
  console.log(
    `Prepared ${Object.keys(values).length} runtime secrets; existing Worker secrets will be retained.`,
  );
}
