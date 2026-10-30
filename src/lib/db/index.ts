import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type DB = DrizzleD1Database<typeof schema>;

// Building the instance walks the whole schema (`extractTablesRelationalConfig`,
// about 1 ms), and requests ask for it several times. The drizzle D1 session
// only holds the binding, the dialect and the schema map and prepares each
// statement per query, so one instance per binding is safe to share.
const instances = new WeakMap<D1Database, DB>();

export function getDb(env: Env): DB {
  let db = instances.get(env.DB);
  if (!db) {
    db = drizzle(env.DB, { schema });
    instances.set(env.DB, db);
  }
  return db;
}
