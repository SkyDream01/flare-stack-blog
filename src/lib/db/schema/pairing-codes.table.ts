import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.table";
import { createdAt } from "./helper";

/**
 * Each Admin's current Pairing Code, one row per Admin: generating a code
 * replaces the row, so an older code stops working. Only the code's hash is
 * stored. Once exchanged, the row records the agent and the API Key it got.
 */
export const PairingCodesTable = sqliteTable("pairing_codes", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
  pairedAt: integer("paired_at", { mode: "timestamp" }),
  agentName: text("agent_name"),
  apiKeyId: text("api_key_id"),
  createdAt,
});
