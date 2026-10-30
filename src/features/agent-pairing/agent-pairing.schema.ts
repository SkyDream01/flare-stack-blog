import { z } from "zod";
import { coercedDate } from "@/lib/orpc/dates";
import { hasControlCharacter } from "@/lib/unicode-text";

/**
 * The metadata of an API Key that Pairing created; the admin UI lists those
 * keys as the connected agents.
 */
export type PairedApiKeyMetadata = { source: "pairing"; agentName: string };

export function isPairedApiKey(metadata: unknown) {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    (metadata as { source?: unknown }).source === "pairing"
  );
}

// Admin UI

export const PairingCodeSchema = z.object({
  code: z.string().describe("The code as shown, `ABCD-EFGH`."),
  expiresAt: coercedDate,
});

export const PairingStateSchema = z.enum([
  "none",
  "waiting",
  "connected",
  "expired",
  "cancelled",
]);

/**
 * The Admin's current Pairing Code. The code itself is shown once, when it is
 * generated: only its hash is stored.
 */
export const PairingStatusSchema = z.object({
  state: PairingStateSchema,
  expiresAt: coercedDate.optional(),
  agent: z
    .object({
      name: z.string(),
      apiKeyId: z.string(),
      connectedAt: coercedDate,
    })
    .optional(),
});

// Exchange

export const ExchangePairingCodeInputSchema = z.strictObject({
  code: z
    .string()
    .max(32)
    .describe(
      "The Pairing Code the Admin gave, such as `ABCD-EFGH`. Case, hyphens and spaces are ignored.",
    ),
  agentName: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .refine((name) => !hasControlCharacter(name, { emoji: true }), {
      message:
        "A name cannot contain control or format characters (Unicode Cc or Cf).",
    })
    .describe(
      "The agent's name, such as Claude Code, shown to the Admin and used to name the API Key. Trimmed: not empty, at most 50 characters, no control or format characters (Unicode Cc or Cf).",
    ),
});

export const ExchangePairingCodeResultSchema = z.object({
  apiKey: z
    .string()
    .describe(
      "The new API Key, sent in the `x-api-key` header. It is returned only here, once.",
    ),
  url: z
    .string()
    .describe(
      "The blog's site URL, such as `https://blog.example.com`; the API is under `/api` on it.",
    ),
});

export type ExchangePairingCodeInput = z.infer<
  typeof ExchangePairingCodeInputSchema
>;
export type PairingStatus = z.infer<typeof PairingStatusSchema>;
