import { lazy } from "@orpc/server";
import { SubmitFriendLinkInputSchema } from "@/features/friend-links/friend-links.schema";
import * as FriendLinkService from "@/features/friend-links/friend-links.service";
import {
  authProcedure,
  publicProcedure,
  rateLimitErrors,
  turnstileErrors,
  turnstileMiddleware,
  withRateLimit,
} from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";
import { friendLinkErrors } from "./errors";

const listApproved = publicProcedure
  .route({
    method: "GET",
    path: "/friend-links",
    summary: "List approved friend links",
    tags: ["Friend Links"],
  })
  .handler(({ context }) => FriendLinkService.getApprovedFriendLinks(context));

const submit = authProcedure
  .errors({ ...rateLimitErrors, ...turnstileErrors })
  .use(
    withRateLimit({
      capacity: 3,
      interval: "1h",
      key: "friend-links:submit",
    }),
  )
  .use(turnstileMiddleware)
  .errors(friendLinkErrors)
  .route({
    method: "POST",
    path: "/friend-links",
    summary: "Submit or resubmit a friend link",
    description:
      "Notifications use the applicant’s current account email. No contact email is stored or accepted. An optional id revises an owned rejected application in place; pending and approved applications cannot be resubmitted.",
    tags: ["Friend Links"],
  })
  .input(SubmitFriendLinkInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(FriendLinkService.submitFriendLink(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
      INVALID_STATE: () => {
        throw errors.INVALID_STATE();
      },
      DUPLICATE_URL: () => {
        throw errors.DUPLICATE_URL();
      },
      NAME_REQUIRED: () => {
        throw errors.NAME_REQUIRED();
      },
    }),
  );

const mine = authProcedure
  .route({
    method: "GET",
    path: "/me/friend-links",
    summary: "List the current user's friend links",
    tags: ["Friend Links"],
  })
  .handler(({ context }) => FriendLinkService.getMyFriendLinks(context));

export default {
  listApproved,
  submit,
  mine,
  // Loaded on the first request under the prefix; public calls never load it.
  admin: lazy(() => import("./admin-router"), {
    prefix: "/admin/friend-links",
  }),
};
