import { MomentPage as SharedMomentPage } from "@/features/moments/components/moment-page";
import { MomentsPage as SharedMomentsPage } from "@/features/moments/components/moments-page";
import type {
  MomentPageProps,
  MomentsPageProps,
} from "@/features/theme/contract/pages";
import { FuwariCommentSection } from "../../components/comments/view/comment-section";

import {
  MomentPageSkeleton as SharedMomentPageSkeleton,
  MomentsPageSkeleton as SharedMomentsPageSkeleton,
} from "@/features/moments/components/moments-page-skeleton";

export function MomentPage({ moment }: MomentPageProps) {
  return (
    <div className="theme-moments w-full min-w-0">
      <SharedMomentPage moment={moment} CommentSection={FuwariCommentSection} />
    </div>
  );
}

export function MomentsPage(props: MomentsPageProps) {
  return (
    <div className="theme-moments w-full min-w-0">
      <SharedMomentsPage {...props} />
    </div>
  );
}

export function MomentPageSkeleton() {
  return (
    <div className="theme-moments w-full min-w-0">
      <SharedMomentPageSkeleton />
    </div>
  );
}

export function MomentsPageSkeleton() {
  return (
    <div className="theme-moments w-full min-w-0">
      <SharedMomentsPageSkeleton />
    </div>
  );
}
