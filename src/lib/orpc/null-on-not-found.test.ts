import { ORPCError } from "@orpc/client";
import { expect, it } from "vitest";
import { emptyListOnNotFound, nullOnNotFound } from "./null-on-not-found";

const context = {} as never;

function failing(code: string, status: number) {
  return async () => {
    throw new ORPCError(code, { status, defined: true });
  };
}

it("keeps what the query resolves to", async () => {
  const options = nullOnNotFound({ queryFn: async () => ({ id: 1 }) }, "GONE");

  await expect(options.queryFn(context)).resolves.toEqual({ id: 1 });
});

it("reads the stated 404 as null, so a missing post shows the not-found page", async () => {
  const options = nullOnNotFound({ queryFn: failing("GONE", 404) }, "GONE");

  await expect(options.queryFn(context)).resolves.toBeNull();
});

it("still fails the query for any other error", async () => {
  const otherCode = nullOnNotFound({ queryFn: failing("OTHER", 404) }, "GONE");
  const plain = nullOnNotFound(
    {
      queryFn: async () => {
        throw new Error("network");
      },
    },
    "GONE",
  );

  await expect(otherCode.queryFn(context)).rejects.toThrow();
  await expect(plain.queryFn(context)).rejects.toThrow("network");
});

it("reads the stated 404 of a list as an empty list", async () => {
  const options = emptyListOnNotFound(
    { queryFn: failing("GONE", 404) as () => Promise<Array<number>> },
    "GONE",
  );

  await expect(options.queryFn(context)).resolves.toEqual([]);
});

it("keeps the items a list query resolves to, and fails for any other error", async () => {
  const kept = emptyListOnNotFound({ queryFn: async () => [1, 2] }, "GONE");
  const other = emptyListOnNotFound(
    { queryFn: failing("OTHER", 404) as () => Promise<Array<number>> },
    "GONE",
  );

  await expect(kept.queryFn(context)).resolves.toEqual([1, 2]);
  await expect(other.queryFn(context)).rejects.toThrow();
});
