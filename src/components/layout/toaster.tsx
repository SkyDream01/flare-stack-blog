import { useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { buttonClass } from "@/components/ui/button";
import { provideToast } from "@/lib/toast";

const MOTION =
  "transition-all duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-10 data-[state=open]:slide-in-from-bottom-4";

/**
 * The public site's toast: a float with the Theme's fill, corners and shadow
 * (`.fuwari-toast`, styles.css).
 */
const SITE = {
  toast: `fuwari-toast group w-full max-w-[350px] flex items-center justify-between gap-4 ${MOTION}`,
  icon: "relative flex size-4 shrink-0 items-center justify-center",
  title: "text-sm font-medium fuwari-text-90 tracking-tight",
  description: "text-xs fuwari-text-50 mt-1",
  content: "flex flex-col gap-0.5 flex-1 min-w-0 pr-2",
  actionButton: buttonClass({ variant: "primary", size: "sm" }),
  cancelButton: buttonClass({ size: "sm" }),
};

/**
 * The Admin's toast: a compact dark slip in either colour scheme, as the
 * overview's hero card is, with its action as a light button on it.
 */
const ADMIN = {
  toast: `admin-toast group w-full max-w-[360px] flex items-center justify-between gap-3 py-2.5 pr-2.5 pl-3.5 rounded-[12px] bg-[#131316] text-white shadow-(--admin-shadow-raised) dark:bg-[#232328] dark:ring-1 dark:ring-white/10 ${MOTION}`,
  icon: "relative flex size-4 shrink-0 items-center justify-center",
  title: "text-[13.5px] leading-5 font-medium",
  description: "text-[12.5px] leading-[18px] opacity-70",
  content: "flex flex-col flex-1 min-w-0 py-0.5",
  actionButton: buttonClass({ variant: "inverse", size: "xs" }),
  cancelButton: buttonClass({ variant: "glass", size: "xs" }),
};

const DEFAULT = {
  toast:
    "group relative w-full max-w-[350px] flex items-start justify-between gap-4 p-5 bg-background border border-border/40 shadow-sm transition-all duration-500 hover:border-border/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-10 data-[state=open]:slide-in-from-bottom-4 [&:has([data-button])]:pr-10",
  title: "text-sm font-medium text-foreground tracking-tight",
  description: "text-xs text-muted-foreground mt-1",
  content: "flex flex-col gap-0.5 flex-1 min-w-0 pr-2",
  actionButton:
    "shrink-0 bg-foreground text-background text-xs font-medium px-4 py-2 hover:opacity-90 transition-opacity rounded-none",
  cancelButton:
    "shrink-0 border border-border bg-transparent text-muted-foreground text-xs font-medium px-4 py-2 hover:bg-muted transition-colors rounded-none",
};

const CUCKOO = {
  toast:
    "group w-full max-w-[350px] flex items-center justify-between gap-4 p-5 bg-(--cuckoo-card-bg) rounded-(--cuckoo-radius) shadow-lg transition-all duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-10 data-[state=open]:slide-in-from-bottom-4",
  title: "text-sm font-medium cuckoo-text-90 tracking-tight",
  description: "text-xs cuckoo-text-50 mt-1",
  content: "flex flex-col gap-0.5 flex-1 min-w-0 pr-2",
  actionButton:
    "shrink-0 cuckoo-btn-primary text-xs font-medium px-4 py-2 rounded-(--cuckoo-radius)",
  cancelButton:
    "shrink-0 cuckoo-btn-regular text-xs font-medium px-4 py-2 rounded-(--cuckoo-radius)",
};

export function Toaster({
  variant = "site",
}: {
  variant?: "site" | "admin" | "default" | "cuckoo";
}) {
  // Runs after sonner's own Toaster has subscribed, so what the facade held
  // back is shown rather than dropped.
  useEffect(() => provideToast(toast), []);
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      visibleToasts={3}
      duration={4000}
      toastOptions={{
        unstyled: true,
        classNames: {
          site: SITE,
          admin: ADMIN,
          default: DEFAULT,
          cuckoo: CUCKOO,
        }[variant],
      }}
    />
  );
}
