import { ORPCError } from "@orpc/client";
import { beforeEach, expect, it, vi } from "vitest";
import { editConflictOf } from "./post-editor.model";
import { savePostEdits } from "./post-editor.save";
import type { PostEditorData } from "./types";

/** Every write replaces the token; a write stating a stale one is refused. */
const server = vi.hoisted(() => ({
  token: "token-1",
  counter: 1,
  tagWrites: 0,
  statedOnTags: [] as Array<string | undefined>,
  failTags: false,
  /** The data of the last update. */
  updated: {} as Record<string, unknown>,
  /** Tags that exist; null when every id does. */
  knownTags: null as Array<number> | null,
  /** The tag ids of the last tags write that went through. */
  savedTags: [] as Array<number>,
  /** Slugs another post uses; an update stating one is refused. */
  takenSlugs: [] as Array<string>,
  /** How many updates were refused over a taken slug. */
  slugRefusals: 0,
  /** Refuses a write stating a token that is no longer current. */
  refuse(saveToken: string | undefined) {
    if (saveToken !== undefined && saveToken !== server.token) {
      throw new ORPCError("EDIT_CONFLICT", {
        status: 409,
        defined: true,
        data: { saveToken: server.token },
      });
    }
  },
  rotate() {
    server.counter += 1;
    server.token = `token-${server.counter}`;
    return server.token;
  },
}));

vi.mock("@/lib/orpc", () => ({
  orpcClient: {
    posts: {
      admin: {
        update: async ({
          saveToken,
          data,
        }: {
          saveToken?: string;
          data: Record<string, unknown>;
        }) => {
          server.refuse(saveToken);
          if (
            typeof data.slug === "string" &&
            server.takenSlugs.includes(data.slug)
          ) {
            server.slugRefusals += 1;
            throw new ORPCError("SLUG_TAKEN", { status: 409, defined: true });
          }
          server.updated = data;
          return { saveToken: server.rotate() };
        },
      },
    },
    tags: {
      admin: {
        list: async () =>
          (server.knownTags ?? []).map((id) => ({ id, name: `Tag ${id}` })),
        setPostTags: async ({
          saveToken,
          tagIds,
        }: {
          saveToken?: string;
          tagIds: Array<number>;
        }) => {
          if (server.failTags) throw new Error("network");
          server.statedOnTags.push(saveToken);
          server.refuse(saveToken);
          const known = server.knownTags;
          if (known && tagIds.some((id) => !known.includes(id))) {
            throw new ORPCError("TAG_NOT_FOUND", {
              status: 404,
              defined: true,
            });
          }
          server.tagWrites += 1;
          server.savedTags = tagIds;
          return { saveToken: server.rotate() };
        },
      },
    },
  },
}));

const POST: PostEditorData = {
  title: "Post",
  summary: "",
  slug: "post",
  contentJson: null,
  publishedAt: null,
  tagIds: [],
  categoryId: null,
  hasPublicSnapshot: false,
  serverToday: "2026-10-05",
  coverMediaId: null,
  cover: null,
};

beforeEach(() => {
  server.token = "token-1";
  server.counter = 1;
  server.tagWrites = 0;
  server.statedOnTags = [];
  server.failTags = false;
  server.updated = {};
  server.knownTags = null;
  server.savedTags = [];
  server.takenSlugs = [];
  server.slugRefusals = 0;
});

/** The editor's loop: save, take the token handed back, save again. */
function editorSession() {
  const save = savePostEdits(1);
  let token = server.token;
  return {
    token: () => token,
    save: (data: PostEditorData) =>
      save(data, token, (next) => {
        token = next;
      }),
  };
}

it("saves tag, category and cover changes one after another without a conflict", async () => {
  const session = editorSession();

  await session.save({ ...POST, tagIds: [3, 4] });
  await session.save({ ...POST, tagIds: [3, 4], categoryId: 2 });
  await session.save({
    ...POST,
    tagIds: [3],
    categoryId: 2,
    coverMediaId: 9,
  });

  expect(server.tagWrites).toBe(3);
  expect(session.token()).toBe(server.token);
});

it("keeps the update's token when the tags write fails, so the retry is not refused", async () => {
  const session = editorSession();
  server.failTags = true;
  await expect(session.save({ ...POST, tagIds: [3] })).rejects.toThrow(
    "network",
  );

  server.failTags = false;
  await session.save({ ...POST, tagIds: [3] });

  expect(session.token()).toBe(server.token);
});

it("is refused with the current token after another client saved", async () => {
  const session = editorSession();
  server.rotate();

  const error = await session.save(POST).catch((caught: unknown) => caught);

  expect(editConflictOf(error)).toEqual({ saveToken: server.token });
  expect(server.tagWrites).toBe(0);
});

it("states the token the update returned when it saves the tags", async () => {
  const session = editorSession();

  await session.save({ ...POST, tagIds: [3] });

  // The update rotated token-1 to token-2, and the tags were saved against it.
  expect(server.statedOnTags).toEqual(["token-2"]);
  expect(session.token()).toBe("token-3");
});

it("is refused on the tags with the current token when another client saved after the update", async () => {
  const session = editorSession();
  const original = server.refuse;
  // Another client saves right after the editor's update.
  server.refuse = (saveToken) => {
    if (saveToken === "token-2") server.rotate();
    original(saveToken);
  };

  const error = await session
    .save({ ...POST, tagIds: [3] })
    .catch((caught: unknown) => caught);
  server.refuse = original;

  expect(editConflictOf(error)).toEqual({ saveToken: "token-3" });
  expect(server.tagWrites).toBe(0);
  // The update's token is kept, so the Admin resolves the conflict from there.
  expect(session.token()).toBe("token-2");
});

it("leaves out a title or slug the API would refuse, saving the rest", async () => {
  const session = editorSession();

  await session.save({ ...POST, title: "  ", slug: "two words", summary: "s" });

  expect(server.updated).not.toHaveProperty("title");
  expect(server.updated).not.toHaveProperty("slug");
  expect(server.updated).toMatchObject({ summary: "s" });

  await session.save({ ...POST, title: "Back", slug: "back" });

  expect(server.updated).toMatchObject({ title: "Back", slug: "back" });
});

it("leaves out a summary the API would refuse, saving the rest", async () => {
  const session = editorSession();

  await session.save({ ...POST, title: "Kept", summary: "colour \u001B[31m" });

  expect(server.updated).not.toHaveProperty("summary");
  expect(server.updated).toMatchObject({ title: "Kept" });

  await session.save({ ...POST, summary: "two\nlines" });

  expect(server.updated).toMatchObject({ summary: "two\nlines" });
});

it("keeps the tags that still exist when one was deleted since it was read", async () => {
  const session = editorSession();
  server.knownTags = [3];

  await session.save({ ...POST, tagIds: [3, 4] });

  expect(server.savedTags).toEqual([3]);
  expect(session.token()).toBe(server.token);
});

it("saves everything but a slug another post uses, and says so", async () => {
  const session = editorSession();
  server.takenSlugs = ["taken"];
  const content = { type: "doc", content: [] };

  const result = await session.save({
    ...POST,
    slug: "taken",
    summary: "kept",
    contentJson: content,
    tagIds: [3],
  });

  expect(result).toEqual({ slugTaken: true });
  expect(server.slugRefusals).toBe(1);
  expect(server.updated).not.toHaveProperty("slug");
  expect(server.updated).toMatchObject({
    summary: "kept",
    contentJson: content,
  });
  expect(server.savedTags).toEqual([3]);
  expect(session.token()).toBe(server.token);
});

it("sends the slug again once it is changed", async () => {
  const session = editorSession();
  server.takenSlugs = ["taken"];
  await session.save({ ...POST, slug: "taken" });

  const result = await session.save({ ...POST, slug: "free" });

  expect(result).toEqual({ slugTaken: false });
  expect(server.updated).toMatchObject({ slug: "free" });
});
