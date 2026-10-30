import { getDb } from "@/lib/db";
import type { ApiContext } from "./context";

export function createApiContext(
  headers: Headers,
  env: Env,
  executionCtx: ExecutionContext<unknown>,
): ApiContext {
  const db = getDb(env);
  return {
    headers,
    env,
    executionCtx,
    db,
    // Better Auth's server code is a large module graph; a cold isolate only
    // evaluates it once a procedure actually reads the session.
    getAuth: async () => {
      const { getRequestAuth } = await import("@/lib/auth/auth.server");
      return getRequestAuth({ db, env, executionCtx });
    },
  };
}
