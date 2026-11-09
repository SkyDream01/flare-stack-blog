import { Suspense } from "react";
import { LatestMoments } from "@/features/moments/components/latest-moments";
import { cn } from "@/lib/utils";
import { Profile } from "./profile";
import { Tags, TagsSkeleton } from "./tags";

export function Sidebar({
  className,
  showLatestMoments = false,
}: {
  className?: string;
  showLatestMoments?: boolean;
}) {
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      <div
        className="fuwari-onload-animation"
        style={{ animationDelay: "100ms" }}
      >
        <Profile />
      </div>
      {showLatestMoments ? (
        <Suspense fallback={null}>
          <LatestMoments />
        </Suspense>
      ) : null}
      <div
        className="sticky top-4 fuwari-onload-animation"
        style={{ animationDelay: "150ms" }}
      >
        <Suspense fallback={<TagsSkeleton />}>
          <Tags />
        </Suspense>
      </div>
    </aside>
  );
}
