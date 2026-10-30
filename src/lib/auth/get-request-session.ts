import { getGlobalStartContext } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getRequestAuth } from "@/lib/auth/auth.server";
import { getDb } from "@/lib/db";

export async function getRequestSession() {
  const context = getGlobalStartContext();
  if (!context) {
    throw new Error("No global start context found");
  }

  const auth = getRequestAuth({
    db: getDb(context.env),
    env: context.env,
    executionCtx: context.executionCtx,
  });
  return auth.api.getSession({
    headers: getRequestHeaders(),
  });
}
