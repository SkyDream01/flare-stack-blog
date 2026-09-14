import { useLocation } from "@tanstack/react-router";
import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { useMediaQuery } from "@/hooks/use-motion";
import { LOW_WORKSPACE_HEIGHT } from "./content-workspace";

export function useTaxonomyScroll(
  ref: RefObject<HTMLDivElement | null>,
  queryKey: string,
  ready: boolean,
) {
  const lowHeight = useMediaQuery(LOW_WORKSPACE_HEIGHT);
  const initialScroll = useLocation({
    select: (location) => location.state.taxonomyScrollTop ?? 0,
  });
  const appliedQuery = useRef<string | null>(null);
  const getScroller = useCallback(
    () =>
      lowHeight
        ? ref.current?.closest<HTMLElement>(".admin-list-region")
        : ref.current,
    [ref, lowHeight],
  );

  useLayoutEffect(() => {
    if (!ready || !ref.current || appliedQuery.current === queryKey) return;
    const scroller = getScroller();
    if (scroller) {
      scroller.scrollTop =
        appliedQuery.current === null ? Math.max(0, initialScroll) : 0;
    }
    appliedQuery.current = queryKey;
  }, [ready, queryKey, initialScroll, getScroller, ref]);

  return () => getScroller()?.scrollTop ?? 0;
}
