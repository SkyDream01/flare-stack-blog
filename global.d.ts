import type {
  Auth as AuthType,
  Session as SessionType,
} from "@/lib/auth/auth.server";
import type { DB as DBType } from "@/lib/db";
import type { QueueMessage } from "@/lib/queue/queue.schema";

declare global {
  interface Env extends Cloudflare.Env {
    QUEUE: Queue<QueueMessage>;
  }

  type DB = DBType;
  type Auth = AuthType;
  type Session = SessionType;

  type BaseContext = {
    env: Env;
  };

  type DbContext = BaseContext & {
    db: DB;
  };

  type SessionContext = DbContext & {
    auth: Auth;
    session: Session | null;
  };

  type AuthContext = Omit<SessionContext, "session"> & {
    session: Session;
  };

  const __APP_VERSION__: string;
  const __THEME_NAME__: import("@/features/theme/registry").ThemeName;
  const __THEME_CONFIG__: import("@/features/theme/registry").ThemeRouterConfig;
}
