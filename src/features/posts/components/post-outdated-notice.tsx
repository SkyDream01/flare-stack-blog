import { History } from "lucide-react";
import { formatPublicPostDate } from "@/features/posts/utils/format-public-post-date";
import { m } from "@/paraglide/messages";

const OUTDATED_AFTER_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

interface PostOutdatedNoticeProps {
  publishedAt: Date | null;
  updatedAt: Date;
}

/** Warns readers that a post has gone a long time without an update. */
export function PostOutdatedNotice({
  publishedAt,
  updatedAt,
}: PostOutdatedNoticeProps) {
  const lastChanged =
    publishedAt && publishedAt > updatedAt ? publishedAt : updatedAt;
  const days = Math.floor((Date.now() - lastChanged.getTime()) / DAY_MS);
  if (days < OUTDATED_AFTER_DAYS) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-100">
      <History className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2} />
      {/* A cached page can be a day behind the client's clock. */}
      <p
        className="text-sm leading-relaxed font-medium"
        suppressHydrationWarning
      >
        {m.post_outdated_notice({
          date: formatPublicPostDate(lastChanged),
          days,
        })}
      </p>
    </div>
  );
}
