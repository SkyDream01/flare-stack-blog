import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The look of a small square icon button, for links that look like one.
 * `active` marks a toggle that is on.
 */
export function iconButtonClass(active = false, className?: string) {
  return cn(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg disabled:opacity-50",
    active
      ? "bg-(--fuwari-btn-regular-bg) text-(--fuwari-primary)"
      : "fuwari-text-50 hover:bg-(--fuwari-btn-regular-bg) hover:text-(--fuwari-primary)",
    className,
  );
}

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "aria-label" | "title" | "aria-pressed"
> {
  /** Names the button for screen readers and as its tooltip. */
  label: string;
  /** Set for toggles: whether it is on. Leave unset for actions. */
  active?: boolean;
  /** The icon. */
  children: ReactNode;
}

/** A small square button showing only an icon, named by `label`. */
export function IconButton({
  label,
  active,
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={iconButtonClass(active, className)}
    >
      {children}
    </button>
  );
}
