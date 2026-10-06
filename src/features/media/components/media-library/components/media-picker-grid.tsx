import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { useMediaPicker } from "../hooks";
import type { MediaAsset } from "../types";
import { MediaGrid } from "./media-grid";

/**
 * The media library as a grid to pick from: skeleton tiles while loading, an
 * empty note, then tiles that load more as they scroll into view.
 */
export function MediaPickerGrid({
  picker,
  onSelect,
  columnsClassName,
}: {
  picker: ReturnType<typeof useMediaPicker>;
  onSelect: (asset: MediaAsset) => void;
  /** Grid columns, for pickers narrower than the viewport. */
  columnsClassName?: string;
}) {
  const { mediaItems, loadMore, hasMore, isLoadingMore, isPending } = picker;

  if (isPending) {
    return (
      <div
        className={cn(
          "grid gap-3",
          columnsClassName ?? "grid-cols-3 sm:grid-cols-4",
        )}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl bg-(--fuwari-btn-regular-bg) animate-pulse"
          />
        ))}
      </div>
    );
  }
  if (mediaItems.length === 0) {
    return (
      <div className="py-16 text-center text-sm fuwari-text-50">
        {m.media_empty()}
      </div>
    );
  }
  return (
    <MediaGrid
      media={mediaItems}
      onSelect={onSelect}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      showMeta={false}
      columnsClassName={columnsClassName}
    />
  );
}
