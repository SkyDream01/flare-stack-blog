import {
  AdminFriendLinkListResponseSchema,
  ApproveFriendLinkInputSchema,
  CreateFriendLinkInputSchema,
  DeleteFriendLinkInputSchema,
  FriendLinkSchema,
  GetAllFriendLinksInputSchema,
  RejectFriendLinkInputSchema,
  UpdateFriendLinkInputSchema,
} from "@/features/friend-links/friend-links.schema";
import * as FriendLinkService from "@/features/friend-links/friend-links.service";
import { adminProcedure } from "@/lib/orpc/procedure";
import { SuccessResponseSchema } from "@/lib/orpc/success-schema";
import { unwrapResult } from "@/lib/orpc/unwrap-result";
import { friendLinkErrors } from "./errors";

const adminList = adminProcedure
  .route({
    method: "GET",
    path: "/admin/friend-links",
    summary: "List friend links for admin",
    tags: ["Admin Friend Links"],
  })
  .input(GetAllFriendLinksInputSchema)
  .output(AdminFriendLinkListResponseSchema)
  .handler(({ context, input }) =>
    FriendLinkService.getAllFriendLinks(context, input),
  );

const create = adminProcedure
  .errors(friendLinkErrors)
  .route({
    method: "POST",
    path: "/admin/friend-links",
    summary: "Create a friend link",
    tags: ["Admin Friend Links"],
  })
  .input(CreateFriendLinkInputSchema)
  .output(FriendLinkSchema)
  .handler(({ context, input }) =>
    FriendLinkService.createFriendLink(context, input),
  );

const update = adminProcedure
  .errors(friendLinkErrors)
  .route({
    method: "PATCH",
    path: "/admin/friend-links/{id}",
    summary: "Update a friend link",
    tags: ["Admin Friend Links"],
  })
  .input(UpdateFriendLinkInputSchema)
  .output(FriendLinkSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(FriendLinkService.updateFriendLink(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

const approve = adminProcedure
  .errors(friendLinkErrors)
  .route({
    method: "POST",
    path: "/admin/friend-links/{id}/approve",
    summary: "Approve a friend link",
    tags: ["Admin Friend Links"],
  })
  .input(ApproveFriendLinkInputSchema)
  .output(FriendLinkSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(FriendLinkService.approveFriendLink(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

const reject = adminProcedure
  .errors(friendLinkErrors)
  .route({
    method: "POST",
    path: "/admin/friend-links/{id}/reject",
    summary: "Reject a friend link",
    tags: ["Admin Friend Links"],
  })
  .input(RejectFriendLinkInputSchema)
  .output(FriendLinkSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(FriendLinkService.rejectFriendLink(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

const remove = adminProcedure
  .errors(friendLinkErrors)
  .route({
    method: "DELETE",
    path: "/admin/friend-links/{id}",
    summary: "Delete a friend link",
    tags: ["Admin Friend Links"],
  })
  .input(DeleteFriendLinkInputSchema)
  .output(SuccessResponseSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(FriendLinkService.deleteFriendLink(context, input), {
      NOT_FOUND: () => {
        throw errors.NOT_FOUND();
      },
    }),
  );

export default {
  list: adminList,
  create,
  update,
  approve,
  reject,
  remove,
};
