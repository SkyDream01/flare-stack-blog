import { asc, eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";

export async function findAdminEmail(db: DB) {
  const [admin] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.role, "admin"))
    .orderBy(asc(user.createdAt))
    .limit(1);
  return admin?.email ?? null;
}
