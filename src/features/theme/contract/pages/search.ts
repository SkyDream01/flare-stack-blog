export interface SearchResultItem {
  post: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    tags: Array<string>;
  };
  score: number;
  matches: {
    title: string | null;
    summary: string | null;
    contentSnippet: string | null;
  };
}

export interface SearchPageProps {
  query: string;
  searchedQuery?: string;
  results: Array<SearchResultItem>;
  isSearching: boolean;
  hasError?: boolean;
  onQueryChange: (query: string) => void;
  onCompositionChange?: (composing: boolean) => void;
  onRetry?: () => void;
  onSelectPost: (slug: string) => void;
  onBack: () => void;
}
