import { minifyContractRouter } from "@orpc/contract";
import { unlazyRouter } from "@orpc/server";
import fs from "node:fs";
import path from "node:path";
import { router } from "../src/lib/orpc/router";

const outFile = path.resolve(
  import.meta.dirname,
  "../src/lib/orpc/contract.generated.json",
);

// The server router loads Admin procedures lazily; the contract lists them all.
fs.writeFileSync(
  outFile,
  `${JSON.stringify(minifyContractRouter(await unlazyRouter(router)), null, 2)}\n`,
);
