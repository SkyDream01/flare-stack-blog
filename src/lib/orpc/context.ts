export type ApiContext = {
  headers: Headers;
  env: Env;
  executionCtx: ExecutionContext<unknown>;
  db: DB;
  /**
   * Loads and builds Better Auth on first use, so public procedures never pay
   * for either.
   */
  getAuth: () => Promise<Auth>;
};

export type AuthedApiContext = ApiContext & {
  session: Session;
};
