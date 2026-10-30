import { apiKeyClient } from "@better-auth/api-key/client";
import { createClientOnlyFn, createIsomorphicFn } from "@tanstack/react-start";
import { adminClient, emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

function createBrowserAuthClient() {
  return createAuthClient({
    plugins: [adminClient(), apiKeyClient(), emailOTPClient()],
  });
}

type AuthClient = ReturnType<typeof createBrowserAuthClient>;
type SessionState = ReturnType<AuthClient["useSession"]>;

let authClient: AuthClient | undefined;

// The Start compiler drops the client implementations from the Worker build,
// and with them Better Auth's browser client, which SSR has no use for.

/** Better Auth's browser client, for event handlers and client-side queries. */
export const getAuthClient = createClientOnlyFn((): AuthClient => {
  authClient ??= createBrowserAuthClient();
  return authClient;
});

// What authClient.useSession renders on the server: no session yet, still
// pending. Hydration starts from the same state, then the browser fetches it.
const SSR_SESSION_STATE: SessionState = {
  data: null,
  error: null,
  isPending: true,
  isRefetching: false,
  refetch: async () => {},
};

export const useSession = createIsomorphicFn()
  .server((): SessionState => SSR_SESSION_STATE)
  .client((): SessionState => getAuthClient().useSession());

export type BetterAuthErrorCode = keyof AuthClient["$ERROR_CODES"];
