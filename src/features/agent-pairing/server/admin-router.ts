import {
  PairingCodeSchema,
  PairingStatusSchema,
} from "@/features/agent-pairing/agent-pairing.schema";
import * as AgentPairingService from "@/features/agent-pairing/service/agent-pairing.service";
import { browserAdminProcedure } from "@/lib/orpc/procedure";
import { SuccessResponseSchema } from "@/lib/orpc/success-schema";

// The Agent Skill tab of the admin UI. An API Key cannot call these, so the
// API document leaves them out.

const generate = browserAdminProcedure
  .route({
    method: "POST",
    path: "/admin/pairing-code",
    summary: "Generate a Pairing Code",
    description:
      "Replaces the Admin's current Pairing Code, which stops working. The code is shown only in this answer.",
    tags: ["Admin Agent Pairing"],
  })
  .output(PairingCodeSchema)
  .handler(({ context }) => AgentPairingService.generatePairingCode(context));

const status = browserAdminProcedure
  .route({
    method: "GET",
    path: "/admin/pairing-code",
    summary: "Read the state of the current Pairing Code",
    tags: ["Admin Agent Pairing"],
  })
  .output(PairingStatusSchema)
  .handler(({ context }) => AgentPairingService.getPairingStatus(context));

const cancel = browserAdminProcedure
  .route({
    method: "DELETE",
    path: "/admin/pairing-code",
    summary: "Cancel the current Pairing Code",
    description:
      "A code already exchanged or expired stays so; cancelling then changes nothing.",
    tags: ["Admin Agent Pairing"],
  })
  .output(SuccessResponseSchema)
  .handler(({ context }) => AgentPairingService.cancelPairingCode(context));

export default {
  generate,
  status,
  cancel,
};
