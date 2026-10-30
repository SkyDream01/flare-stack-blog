import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
  PairingCodeSchema,
  type PairingStatus,
  PairingStatusSchema,
} from "@/features/agent-pairing/agent-pairing.schema";
import { orpcClient } from "@/lib/orpc";

const pairingAdmin = orpcClient.pairing.admin;

// Over the wire a date is an ISO string, and only queries are revived after
// the call. The schema is the one the server answers with; parsing here makes
// every date from the pairing operations a Date, mutation results included.
const readPairingStatus = async () =>
  PairingStatusSchema.parse(await pairingAdmin.status());

export type { PairingStatus };
export type PairingState = PairingStatus["state"];
export type GeneratedPairingCode = z.infer<typeof PairingCodeSchema>;

export const PAIRING_POLL_MS = 2000;

export const pairingStatusQuery = queryOptions({
  queryKey: ["agent-skill", "pairing"],
  queryFn: readPairingStatus,
  // Background tabs are skipped by TanStack Query itself
  // (`refetchIntervalInBackground` is off).
  refetchInterval: (query) =>
    query.state.data?.state === "waiting" ? PAIRING_POLL_MS : false,
});

export const generatePairingCode = async () =>
  PairingCodeSchema.parse(await pairingAdmin.generate());

export const cancelPairingCode = () => pairingAdmin.cancel();
