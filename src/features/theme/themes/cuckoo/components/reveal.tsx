import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** SSR stays visible; only enhanced, offscreen content waits for the viewport. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;

    const rect = element.getBoundingClientRect();
    // A restored scroll position must not hide content the reader passed.
    if (rect.height > 0 && rect.bottom <= 0) return;
    // Suspense may still be hiding the tree during hydration. Let the observer
    // wait for its real layout rather than consuming the entrance invisibly.
    const initiallyVisible = rect.height > 0 && rect.top < window.innerHeight;
    element.style.setProperty(
      "--cuckoo-reveal-delay",
      `${initiallyVisible ? Math.min(Math.max(delay, 0), 180) : 0}ms`,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reveal();
      },
      { rootMargin: "0px 0px 48px 0px", threshold: 0 },
    );
    const reveal = () => {
      element.dataset.reveal = "visible";
      observer.disconnect();
    };
    const handlePreference = () => {
      if (preference.matches) {
        delete element.dataset.reveal;
        observer.disconnect();
      }
    };

    if (initiallyVisible) reveal();
    else {
      element.dataset.reveal = "pending";
      observer.observe(element);
    }
    // Keyboard navigation must reveal a target before the observer catches up.
    element.addEventListener("focusin", reveal);
    preference.addEventListener("change", handlePreference);
    return () => {
      observer.disconnect();
      element.removeEventListener("focusin", reveal);
      preference.removeEventListener("change", handlePreference);
      delete element.dataset.reveal;
    };
  }, [delay]);

  return (
    <div ref={ref} className={cn("cuckoo-reveal", className)}>
      {children}
    </div>
  );
}
