import { Badge } from "@/components/ui/badge";
import { postStateLabel, type PostState } from "./post-state";

const TONES = {
  draft: "neutral",
  published: "success",
  "published-changed": "warning",
} as const;

export function PostStatusBadge({ state }: { state: PostState }) {
  return <Badge tone={TONES[state]}>{postStateLabel(state)}</Badge>;
}
