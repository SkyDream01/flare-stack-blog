import type { PublicMoment } from "@/features/moments/schema/moments.schema";

export interface MomentPageProps {
  moment: PublicMoment;
}

export interface MomentsPageProps {
  moments: PublicMoment[];
  page: number;
  totalPages: number;
}
