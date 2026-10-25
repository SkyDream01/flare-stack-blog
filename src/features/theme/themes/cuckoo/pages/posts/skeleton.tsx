export function PostsPageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="cuckoo-card-base mb-2 h-14" />
      {[1, 2].map((i) => (
        <div key={i} className="cuckoo-card-base my-4 h-72 sm:my-5 sm:h-87.5" />
      ))}
    </div>
  );
}
