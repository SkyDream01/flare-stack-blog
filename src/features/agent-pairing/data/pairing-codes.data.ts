import { and, eq, gt, isNull } from "drizzle-orm";
import { PairingCodesTable } from "@/lib/db/schema";

/** The Admin's current Pairing Code, if one was ever generated. */
export async function findPairingCode(db: DB, userId: string) {
  const row = await db.query.PairingCodesTable.findFirst({
    where: eq(PairingCodesTable.userId, userId),
  });
  return row ?? null;
}

/** Makes `codeHash` the Admin's Pairing Code, replacing the one before. */
export async function replacePairingCode(
  db: DB,
  values: { userId: string; codeHash: string; expiresAt: Date; now: Date },
) {
  const fresh = {
    codeHash: values.codeHash,
    expiresAt: values.expiresAt,
    cancelledAt: null,
    pairedAt: null,
    agentName: null,
    apiKeyId: null,
    createdAt: values.now,
  };
  await db
    .insert(PairingCodesTable)
    .values({ userId: values.userId, ...fresh })
    .onConflictDoUpdate({ target: PairingCodesTable.userId, set: fresh });
}

/** Conditions under which a code can still be exchanged or cancelled. */
function isLive(now: Date) {
  return and(
    isNull(PairingCodesTable.cancelledAt),
    isNull(PairingCodesTable.pairedAt),
    gt(PairingCodesTable.expiresAt, now),
  );
}

/** Cancels the Admin's code unless it was exchanged or has expired. */
export async function cancelPairingCode(db: DB, userId: string, now: Date) {
  await db
    .update(PairingCodesTable)
    .set({ cancelledAt: now })
    .where(and(eq(PairingCodesTable.userId, userId), isLive(now)));
}

/**
 * Marks a live code as exchanged by `agentName`, in one statement, so of two
 * exchanges of one code only one gets the row. The Admin it belongs to, or
 * null when no live code has this hash.
 */
export async function claimPairingCode(
  db: DB,
  values: { codeHash: string; agentName: string; now: Date },
) {
  const [claimed] = await db
    .update(PairingCodesTable)
    .set({ pairedAt: values.now, agentName: values.agentName })
    .where(
      and(eq(PairingCodesTable.codeHash, values.codeHash), isLive(values.now)),
    )
    .returning({ userId: PairingCodesTable.userId });
  return claimed?.userId ?? null;
}

/** Records the API Key a claimed code produced. */
export async function recordPairedApiKey(
  db: DB,
  values: { userId: string; codeHash: string; apiKeyId: string },
) {
  await db
    .update(PairingCodesTable)
    .set({ apiKeyId: values.apiKeyId })
    .where(
      and(
        eq(PairingCodesTable.userId, values.userId),
        eq(PairingCodesTable.codeHash, values.codeHash),
      ),
    );
}

/** Makes a claimed code live again when no API Key could be created for it. */
export async function releasePairingCode(
  db: DB,
  values: { userId: string; codeHash: string },
) {
  await db
    .update(PairingCodesTable)
    .set({ pairedAt: null, agentName: null })
    .where(
      and(
        eq(PairingCodesTable.userId, values.userId),
        eq(PairingCodesTable.codeHash, values.codeHash),
        isNull(PairingCodesTable.apiKeyId),
      ),
    );
}
