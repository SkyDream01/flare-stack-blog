import { useCallback, useEffect, useRef, useState } from "react";
import type { TaxonomyState } from "./taxonomy-state";

export function useTaxonomySearch(
  search: string,
  onChange: (patch: Partial<TaxonomyState>, replace?: boolean) => void,
) {
  const [value, setValue] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPending = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    clearPending();
    setValue(search);
  }, [search, clearPending]);
  useEffect(() => clearPending, [clearPending]);

  const update = (next: string) => {
    setValue(next);
    clearPending();
    timer.current = setTimeout(() => onChange({ search: next, page: 1 }), 300);
  };
  const changeContext = (patch: Partial<TaxonomyState>) => {
    clearPending();
    setValue("");
    onChange({ ...patch, page: 1, search: "" });
  };

  return { value, update, changeContext };
}
