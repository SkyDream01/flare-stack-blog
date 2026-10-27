import { useCallback, useEffect, useState } from "react";
import { getSecondsLeft } from "../utils/sign-in-code";

/** A countdown in whole seconds that a caller can start, extend or clear. */
export function useCooldown() {
  const [state, setState] = useState({ until: 0, now: 0 });

  useEffect(() => {
    if (state.until <= state.now) return;
    const timer = window.setTimeout(
      () => setState((current) => ({ ...current, now: Date.now() })),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  const start = useCallback((durationMs: number) => {
    const now = Date.now();
    setState({ until: now + durationMs, now });
  }, []);
  const clear = useCallback(() => setState({ until: 0, now: 0 }), []);

  return {
    secondsLeft: getSecondsLeft(state.until, state.now),
    start,
    clear,
  };
}
