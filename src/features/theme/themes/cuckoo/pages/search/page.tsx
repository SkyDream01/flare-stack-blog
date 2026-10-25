import { ArrowLeft, Keyboard, Loader2, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SearchPageProps } from "@/features/theme/contract/pages";
import { Highlighted } from "@/features/search/components/search-page";
import { m } from "@/paraglide/messages";
import { Reveal } from "../../components/reveal";

export function SearchPage({
  query,
  searchedQuery = query,
  results,
  isSearching,
  hasError = false,
  onQueryChange,
  onCompositionChange,
  onRetry,
  onSelectPost,
  onBack,
}: SearchPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-12">
      {/* Header Area */}
      <div
        className="cuckoo-card-base p-6 md:p-8 flex items-center gap-4 cuckoo-onload-animation"
        style={{ animationDelay: "100ms" }}
      >
        <button
          onClick={onBack}
          className="group flex items-center justify-center w-10 h-10 rounded-xl bg-(--cuckoo-btn-regular-bg) text-(--cuckoo-btn-content) hover:bg-(--cuckoo-btn-regular-bg-hover) transition-colors shrink-0"
          title={m.search_back()}
        >
          <ArrowLeft
            size={18}
            className="group-hover:-translate-x-0.5 transition-transform"
          />
        </button>

        <div className="relative flex-1 flex items-center">
          <Search className="absolute left-4 w-5 h-5 cuckoo-text-30 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onCompositionStart={() => onCompositionChange?.(true)}
            onCompositionEnd={() => onCompositionChange?.(false)}
            placeholder={m.search_placeholder()}
            aria-label={m.search_placeholder()}
            className="w-full pl-12 pr-12 py-3 rounded-xl border border-(--cuckoo-input-border) bg-(--cuckoo-input-bg) focus:outline-none focus:border-(--cuckoo-primary)/50 focus:bg-(--cuckoo-primary)/5 transition-all cuckoo-text-90 text-lg md:text-xl placeholder:text-black/30 dark:placeholder:text-white/30"
          />
          {isSearching && (
            <div className="absolute right-4 w-5 h-5 cuckoo-text-50 pointer-events-none flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Results Area */}
      <div className="flex flex-col gap-4" aria-busy={isSearching}>
        {query.trim() === "" && (
          <div
            className="cuckoo-card-base p-16 flex flex-col items-center justify-center text-center cuckoo-onload-animation"
            style={{ animationDelay: "200ms" }}
          >
            <div className="w-20 h-20 rounded-full bg-(--cuckoo-btn-regular-bg) flex items-center justify-center mb-6 text-(--cuckoo-btn-content)">
              <Keyboard size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold cuckoo-text-75 mb-3">
              {m.search_cuckoo_intro_title()}
            </h3>
            <p className="text-sm cuckoo-text-50 max-w-sm">
              {m.search_cuckoo_intro_desc()}
            </p>
          </div>
        )}

        {query.trim() !== "" && hasError && (
          <div className="cuckoo-card-base cuckoo-onload-animation p-12 text-center">
            <p className="cuckoo-text-75" role="status">
              {m.search_failed()}
            </p>
            <p className="cuckoo-text-50 mt-2 text-sm">
              {m.search_retry_hint()}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="cuckoo-btn-primary mt-5 px-5 py-2 text-sm"
            >
              {m.search_retry()}
            </button>
          </div>
        )}

        {query.trim() !== "" &&
          !hasError &&
          !isSearching &&
          results.length === 0 && (
            <div
              className="cuckoo-card-base p-12 flex flex-col items-center justify-center text-center cuckoo-onload-animation"
              style={{ animationDelay: "200ms" }}
            >
              <div className="w-16 h-16 rounded-full bg-(--cuckoo-btn-regular-bg) flex items-center justify-center mb-4 text-(--cuckoo-btn-content)">
                <Search size={24} strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold cuckoo-text-75 mb-2">
                {m.search_no_results()}
              </h3>
              <p className="text-sm cuckoo-text-50">
                {m.search_no_results_with_query({ query: searchedQuery })}
              </p>
            </div>
          )}

        {!hasError &&
          results.map((result, index) => (
            <Reveal key={result.post.id} delay={index * 45}>
              <button
                onClick={() => onSelectPost(result.post.slug)}
                className="cuckoo-search-result cuckoo-card-base cuckoo-card-hoverable p-6 text-left w-full group flex flex-col gap-3 outline-none focus-visible:ring-2 focus-visible:ring-(--cuckoo-primary)/50"
              >
                {/* Title with highlighting */}
                <h2
                  className="text-xl font-bold cuckoo-text-90 group-hover:text-(--cuckoo-primary) transition-colors"
                  style={{
                    viewTransitionName: `post-title-${result.post.slug}`,
                  }}
                >
                  <Highlighted
                    html={result.matches.title}
                    fallback={result.post.title}
                  />
                </h2>

                {/* Summary with highlighting */}
                <p className="text-sm cuckoo-text-75 line-clamp-3 leading-relaxed">
                  <Highlighted
                    html={
                      result.matches.summary ||
                      (!result.post.summary
                        ? result.matches.contentSnippet
                        : null)
                    }
                    fallback={result.post.summary || ""}
                  />
                </p>

                {/* Tags */}
                {result.post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 mt-auto">
                    {result.post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-mono text-(--cuckoo-btn-content) bg-(--cuckoo-btn-regular-bg) px-2 py-1 rounded-md"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </Reveal>
          ))}
      </div>
    </div>
  );
}
