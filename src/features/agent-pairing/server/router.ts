import { lazy } from "@orpc/server";
import {
  ExchangePairingCodeInputSchema,
  ExchangePairingCodeResultSchema,
} from "@/features/agent-pairing/agent-pairing.schema";
import * as AgentPairingService from "@/features/agent-pairing/service/agent-pairing.service";
import {
  publicProcedure,
  rateLimitErrors,
  withRateLimit,
} from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";

const exchange = publicProcedure
  .errors(rateLimitErrors)
  .use(withRateLimit({ capacity: 10, interval: "1m", key: "pairing:exchange" }))
  .errors({
    PAIRING_CODE_NOT_FOUND: {
      status: 404,
      message: "No Pairing Code can be exchanged with this code.",
    },
  })
  .route({
    method: "POST",
    path: "/pairing",
    summary: "Exchange a Pairing Code for an API Key",
    description:
      "Pairing: an Admin generates a Pairing Code in the admin UI and gives it to the agent, which exchanges it here, without a key, for a new API Key owned by that Admin and named after the agent. A code lives ten minutes and works once. A wrong, expired, cancelled or already used code answers 404 PAIRING_CODE_NOT_FOUND, alike; ask the Admin for a new code. Exchanges are limited to 10 a minute per IP address.",
    tags: ["Agent Pairing"],
  })
  .input(ExchangePairingCodeInputSchema)
  .output(ExchangePairingCodeResultSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(AgentPairingService.exchangePairingCode(context, input), {
      PAIRING_CODE_NOT_FOUND: () => {
        throw errors.PAIRING_CODE_NOT_FOUND();
      },
    }),
  );

export default {
  exchange,
  // Loaded on the first request under the prefix; the exchange never loads it.
  admin: lazy(() => import("./admin-router"), {
    prefix: "/admin/pairing-code",
  }),
};
