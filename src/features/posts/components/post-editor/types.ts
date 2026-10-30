import type { JSONContent } from "@tiptap/react";

export interface PostEditorCover {
  id: number;
  key: string;
  url: string;
  fileName: string;
  width: number | null;
  height: number | null;
}

export interface PostEditorData {
  title: string;
  summary: string;
  slug: string;
  contentJson: JSONContent | null;
  publishedAt: Date | null;
  tagIds: Array<number>;
  categoryId: number | null;
  hasPublicSnapshot: boolean;
  serverToday: string;
  coverMediaId: number | null;
  cover: PostEditorCover | null;
}

/** The current `saveToken` a save was refused over, from the 409. */
export interface EditConflict {
  saveToken: string;
}

/** What a save that went through reports. */
export interface PostEditorSaveResult {
  /** Another post uses the slug, so it was left out and the rest was saved. */
  slugTaken: boolean;
}

/**
 * Saves the post stating `saveToken`. Every write replaces the token, so each
 * response's token goes to `acceptSaveToken` as soon as it is known.
 */
export type PostEditorSave = (
  data: PostEditorData,
  saveToken: string,
  acceptSaveToken: (saveToken: string) => void,
) => Promise<PostEditorSaveResult | void>;

export interface PostEditorProps {
  initialData: PostEditorData & {
    id: number;
    saveToken: string;
    publicSnapshotContentJson?: JSONContent | null;
  };
  /** The live page's slug, read fresh from the server; null while unpublished. */
  publicSlug: string | null;
  /**
   * Whether the saved draft differs from the published version, read fresh
   * from the server so it follows saves, publishing and discarding.
   */
  hasUnpublishedChanges: boolean;
  onSave: PostEditorSave;
  /** Reads the post again and mounts the editor afresh with what is stored. */
  onReload: () => Promise<void>;
}

export type SaveStatus = "SYNCED" | "SAVING" | "PENDING" | "ERROR";
