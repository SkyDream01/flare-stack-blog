import { apiKey } from "@better-auth/api-key";
import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";

export function createAuthConfig() {
  return {
    session: {
      // Readers visit rarely; a month-long session that slides on use spares
      // them a new Sign-in Code on most visits.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    user: {
      additionalFields: {
        mutedAt: {
          type: "date",
          required: false,
          input: false,
        },
      },
    },
    plugins: [
      admin(),
      apiKey({
        enableSessionForAPIKeys: true,
        requireName: true,
        defaultPrefix: "fsb_",
        rateLimit: { enabled: false },
        keyExpiration: {
          defaultExpiresIn: null,
          disableCustomExpiresTime: true,
        },
      }),
    ],
  } satisfies BetterAuthOptions;
}
