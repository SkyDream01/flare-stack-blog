import { MomentPage as SharedMomentPage } from "@/features/moments/components/moment-page";
import { MomentsPage as SharedMomentsPage } from "@/features/moments/components/moments-page";
import type {
  MomentPageProps,
  MomentsPageProps,
} from "@/features/theme/contract/pages";
import { CommentSection } from "../../components/comments/view/comment-section";

import {
  MomentPageSkeleton as SharedMomentPageSkeleton,
  MomentsPageSkeleton as SharedMomentsPageSkeleton,
} from "@/features/moments/components/moments-page-skeleton";

export function MomentPage({ moment }: MomentPageProps) {
  return (
    <div className="theme-moments mx-auto w-full max-w-3xl px-6 py-12">
      <SharedMomentPage moment={moment} CommentSection={CommentSection} />
    </div>
  );
}

export function MomentsPage(props: MomentsPageProps) {
  return (
    <div className="theme-moments mx-auto w-full max-w-3xl px-6 py-12">
      <SharedMomentsPage {...props} />
    </div>
  );
}

export function MomentPageSkeleton() {
  return (
    <div className="theme-moments mx-auto w-full max-w-3xl px-6 py-12">
      <SharedMomentPageSkeleton />
    </div>
  );
}

export function MomentsPageSkeleton() {
  return (
    <div className="theme-moments mx-auto w-full max-w-3xl px-6 py-12">
      <SharedMomentsPageSkeleton />
    </div>
  );
}
