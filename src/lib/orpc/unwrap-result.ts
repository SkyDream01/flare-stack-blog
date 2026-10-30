type AnyResult = {
  data: unknown;
  error: { reason: string } | null;
};

/** Each thrower receives its error, so it can pass the error's details on. */
type Throwers<TError extends { reason: string }> = {
  [TReason in TError["reason"]]?: (
    error: Extract<TError, { reason: TReason }>,
  ) => never;
} & Record<string, (error: never) => never>;

export async function unwrapResult<TResult extends AnyResult>(
  resultPromise: Promise<TResult> | TResult,
  throwers: NoInfer<Throwers<NonNullable<TResult["error"]>>>,
): Promise<Exclude<TResult["data"], null>> {
  const result = await resultPromise;
  if (result.error) {
    const thrower = throwers[result.error.reason] as
      | ((error: TResult["error"]) => never)
      | undefined;
    if (thrower) {
      thrower(result.error);
    }
    throw new Error(result.error.reason);
  }
  if (result.data === null) {
    throw new Error("Expected ok result");
  }
  return result.data as Exclude<TResult["data"], null>;
}
