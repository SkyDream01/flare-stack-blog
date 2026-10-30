import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { uniqueKeyOf } from "@/lib/unicode-text";

/*
 * Tag and Category names, Post slugs and public slugs are unique by their key
 * (uniqueKeyOf): a column beside each, under a unique index, so the database
 * refuses a duplicate however many requests race (migration 0029). Every write
 * of a value writes its key; a refused write is a UNIQUE constraint failure on
 * the key, which the services answer as their 409.
 *
 * A null key has not been computed yet: SQL has no NFKC, so the migration
 * left it null for values it could not compute. `settleUniqueKeys` computes
 * them, and runs before every uniqueness check. A value whose key another row
 * already holds was a duplicate before keys existed: it gets a parked key, the
 * key plus U+0001 and its id, which no computed key can equal (they hold no
 * control characters). The row keeps its value and can be saved with it
 * unchanged, but no other row can take the value, since the first row holds
 * the real key.
 */

export type UniquelyKeyed = {
  table: string;
  value: string;
  key: string;
};

export const TAG_NAME: UniquelyKeyed = {
  table: "tags",
  value: "name",
  key: "name_key",
};
export const CATEGORY_NAME: UniquelyKeyed = {
  table: "categories",
  value: "name",
  key: "name_key",
};
export const POST_SLUG: UniquelyKeyed = {
  table: "posts",
  value: "slug",
  key: "slug_key",
};
export const POST_PUBLIC_SLUG: UniquelyKeyed = {
  table: "posts",
  value: "public_slug",
  key: "public_slug_key",
};

const SETTLE_CHUNK_SIZE = 50;
// A chunk settles every row it read unless a write changed the value at the
// same time, and that write sets the key itself, so this is never reached.
const SETTLE_MAX_CHUNKS = 1000;

export function parkedKey(key: string, id: number) {
  return `${key}\u0001${id}`;
}

/**
 * The key to write with `value` into `valueColumn`: the row's own key when
 * the value is not changing, so a row with a parked (or not yet computed) key
 * can be saved with its value, and the value's key otherwise.
 */
export function keyForWrite(
  valueColumn: SQLiteColumn,
  keyColumn: SQLiteColumn,
  value: string,
): SQL<string | null> {
  return sql`CASE WHEN ${valueColumn} = ${value} THEN ${keyColumn} ELSE ${uniqueKeyOf(value)} END`;
}

/** Computes the keys still null in `target`'s table; see above. */
export async function settleUniqueKeys(db: DB, target: UniquelyKeyed) {
  const table = sql.identifier(target.table);
  const value = sql.identifier(target.value);
  const key = sql.identifier(target.key);
  for (let chunk = 0; chunk < SETTLE_MAX_CHUNKS; chunk += 1) {
    const rows = await db.all<{ id: number; value: string }>(
      sql`SELECT id, ${value} AS value FROM ${table} WHERE ${key} IS NULL AND ${value} IS NOT NULL ORDER BY id LIMIT ${SETTLE_CHUNK_SIZE}`,
    );
    // In id order, so of values that turn out equal the oldest keeps the key.
    // Each is one statement, so no other write lands between its check and
    // its set; raw SQL, so a Post's saveToken and updatedAt stay.
    for (const row of rows) {
      const computed = uniqueKeyOf(row.value);
      await db.run(
        sql`UPDATE ${table} SET ${key} = CASE WHEN EXISTS (SELECT 1 FROM ${table} WHERE ${key} = ${computed}) THEN ${parkedKey(computed, row.id)} ELSE ${computed} END WHERE id = ${row.id} AND ${key} IS NULL AND ${value} = ${row.value}`,
      );
    }
    if (rows.length < SETTLE_CHUNK_SIZE) return;
  }
}

/** Whether `error`, or an error it was caused by, is a duplicate `target`. */
export function isUniqueViolation(error: unknown, target: UniquelyKeyed) {
  const pattern = new RegExp(
    `UNIQUE constraint failed:.*\\b${target.table}\\.${target.value}(?:_key)?\\b`,
    "i",
  );
  for (let current = error; current instanceof Error; current = current.cause) {
    if (pattern.test(current.message)) return true;
  }
  return false;
}
