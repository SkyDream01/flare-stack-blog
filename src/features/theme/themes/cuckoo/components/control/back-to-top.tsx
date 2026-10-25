import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-motion";
import { m } from "@/paraglide/messages";

/**
 * 返回顶部 FAB(对应原主题 .mdui-fab-fixed,强调色圆形按钮)。
 */
export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() =>
        window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" })
      }
      aria-label={m.post_back_to_top()}
      aria-hidden={!isVisible}
      inert={!isVisible}
      className={cn(
        "cuckoo-back-to-top fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg motion-safe:active:scale-90",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
      style={{ backgroundColor: "var(--cuckoo-primary)" }}
    >
      <ArrowUp size={22} strokeWidth={2.5} />
    </button>
  );
}
