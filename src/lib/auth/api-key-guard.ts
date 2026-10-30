const API_KEY_HEADER = "x-api-key";

const MANAGEMENT_SKIP = new Set([
  "/api-key/verify",
  "/api-key/delete-all-expired-api-keys",
]);

/**
 * Whether a request authenticates with an API Key. Managing API Keys and
 * Pairing Codes takes an Admin's browser session: a key cannot mint keys.
 */
export function sendsApiKey(headers?: Headers | null) {
  return Boolean(headers?.get(API_KEY_HEADER));
}

export function isApiKeyManagementPath(path: string) {
  return path.startsWith("/api-key/") && !MANAGEMENT_SKIP.has(path);
}

export type ApiKeyManagementDenial =
  | { denied: false }
  | {
      denied: true;
      code: "API_KEY_CANNOT_MANAGE_API_KEYS" | "ADMIN_REQUIRED";
    };

export function inspectApiKeyManagementAccess(options: {
  path: string;
  headers?: Headers | null;
  isHttpRequest: boolean;
  role?: string | null;
}): ApiKeyManagementDenial {
  if (!isApiKeyManagementPath(options.path)) {
    return { denied: false };
  }

  if (sendsApiKey(options.headers)) {
    return { denied: true, code: "API_KEY_CANNOT_MANAGE_API_KEYS" };
  }

  if (!options.isHttpRequest) {
    return { denied: false };
  }

  if (options.role !== "admin") {
    return { denied: true, code: "ADMIN_REQUIRED" };
  }

  return { denied: false };
}
