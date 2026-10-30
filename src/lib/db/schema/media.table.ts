import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { createdAt, id } from "./helper";
import { PostRevisionsTable } from "./post-revisions.table";
import { PostsTable } from "./posts.table";

export const MediaTable = sqliteTable(
  "media",
  {
    id,
    key: text().notNull().unique(),
    url: text().notNull(),
    fileName: text("file_name").notNull(),
    width: integer("width"),
    height: integer("height"),
    mimeType: text("mime_type").notNull(),
    sizeInBytes: integer("size_in_bytes").notNull(),
    createdAt,
  },
  (table) => [index("created_at_idx_media").on(table.createdAt)],
);

export const PostMediaTable = sqliteTable(
  "post_media",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => PostsTable.id, { onDelete: "cascade" }),
    mediaId: integer("media_id")
      .notNull()
      .references(() => MediaTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.mediaId] })],
);

/**
 * The Media each Post Revision uses, body images and Post Cover alike. A
 * database trigger fills it whenever a revision is inserted (migration 0028),
 * so no write path has to remember to; deleting the revision drops its rows.
 */
export const PostRevisionMediaTable = sqliteTable(
  "post_revision_media",
  {
    revisionId: integer("revision_id")
      .notNull()
      .references(() => PostRevisionsTable.id, { onDelete: "cascade" }),
    mediaId: integer("media_id")
      .notNull()
      .references(() => MediaTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.revisionId, table.mediaId] }),
    index("post_revision_media_media_idx").on(table.mediaId),
  ],
);
