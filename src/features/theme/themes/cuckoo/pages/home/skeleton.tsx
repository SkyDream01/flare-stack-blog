export function HomePageSkeleton() {
  return (
    <div className="animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="cuckoo-card-base my-4 h-72 sm:my-5 sm:h-87.5" />
      ))}
    </div>
  );
}
