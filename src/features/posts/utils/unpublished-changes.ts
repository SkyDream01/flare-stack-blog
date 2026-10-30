type FingerprintedPost = {
  status: "draft" | "published";
  draftFingerprint: string | null;
  publishedFingerprint: string | null;
};

/** A Published Post whose draft differs from what was published. */
export function hasUnpublishedChanges(post: FingerprintedPost) {
  return (
    post.status === "published" &&
    post.draftFingerprint !== post.publishedFingerprint
  );
}

/** A Published Post with a fingerprint not computed yet (null). */
export function needsFingerprints(post: FingerprintedPost) {
  return (
    post.status === "published" &&
    (post.draftFingerprint === null || post.publishedFingerprint === null)
  );
}
