import { lazy } from "@orpc/server";
import * as ConfigService from "@/features/config/service/config.service";
import { serverEnv } from "@/lib/env/server.env";
import { publicProcedure } from "@/lib/orpc/procedure";

const siteConfig = publicProcedure
  .route({
    method: "GET",
    path: "/site/config",
    summary: "Get public site config",
    tags: ["Site"],
  })
  .handler(({ context }) => ConfigService.getSiteConfig(context));

const siteDomain = publicProcedure
  .route({
    method: "GET",
    path: "/site/domain",
    summary: "Get the public site domain",
    tags: ["Site"],
  })
  .handler(({ context }) => serverEnv(context.env).DOMAIN);

export default {
  siteConfig,
  siteDomain,
  // Loaded on the first request under the prefix; public calls never load it.
  admin: lazy(() => import("./admin-router"), { prefix: "/admin/config" }),
};
