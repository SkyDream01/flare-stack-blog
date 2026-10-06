# Worker configuration lives in `cloudflare.config.ts`, not `wrangler.jsonc`

The Worker is configured by `cloudflare.config.ts` and driven by the `cf` CLI. There is no `wrangler.jsonc`, no `wrangler` dependency, and no generated `worker-configuration.d.ts`. Deployment values (Worker name, D1/KV ids, domain, queue and bucket names) are read from real environment variables, so forks edit no tracked file. The file is loaded by Node >= 22.18 only; Bun cannot load it.

Three consequences are easy to miss and worth keeping in mind:

- **Durable Objects have no binding.** `RateLimiter` and `PostPublisher` are declared in `exports` and reached with `exports.X.getByName()` from `cloudflare:workers`, through the lazy helpers in `src/lib/do/`. A same-worker `bindings.durableObject()` is always emitted with a `script_name`, which `@cloudflare/vitest-plugin` cannot test. Once a Worker is deployed with `exports` declarations it cannot be redeployed from a `migrations`-based Wrangler config.
- **Runtime variables are secrets, validated by zod.** `src/lib/env/server.env.ts` is the single source of truth for required and optional runtime variables. `cf deploy` keeps secrets but drops plain-text variables that are not in the config, and the new config has no `keep_vars`. Declaring secrets in the config would make local dev load only the declared keys, so none are declared.
- **Types come from the config.** `cf workers types` writes `.cloudflare/types/index.d.ts` (gitignored); `entrypoint` must be imported with `with { type: "cf-worker" }` so `ctx.exports` and the DO classes are typed.

`cf` is in open beta; dependency versions are pinned to what the deploy was rehearsed with.

`cf` is patched (`patches/cf@1.0.0-beta.5.patch`) to turn off the strict mode that `cf deploy` hard-codes. Without the patch, a CI deploy aborts whenever the Worker was last deployed from the dashboard, which is what saving a runtime secret there does, and every later deploy keeps failing. The drift it reports is a difference in how the same config is written, not a real change. With the patch the deploy prints the warning and proceeds with the local config, as Wrangler did in CI. Drop the patch once `cf` offers a way to disable strict mode; upgrading `cf` makes the patch fail to apply, which is the cue to re-check.
