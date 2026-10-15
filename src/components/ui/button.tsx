import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import "./button.css";

type LegacyButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
type LegacyButtonSize = "default" | "sm" | "lg" | "icon";

export type ButtonVariant =
  | "primary"
  | "regular"
  | "plain"
  | "danger"
  | "text"
  | "overlay"
  | LegacyButtonVariant;
export type ButtonSize = "sm" | "md" | "lg" | "default" | "icon";

export interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** On `plain`, a muted button that turns red on hover; on `text`, red text. */
  tone?: "danger";
  className?: string;
}

const legacyButtonBase =
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

const legacyVariants: Record<LegacyButtonVariant, string> = {
  default: "bg-foreground text-background hover:opacity-80",
  destructive:
    "bg-destructive text-destructive-foreground hover:opacity-80",
  outline:
    "border border-border/40 bg-transparent hover:border-foreground",
  secondary: "bg-muted text-muted-foreground hover:bg-muted/80",
  ghost: "hover:bg-accent/50",
  link: "text-foreground underline-offset-4 hover:underline",
};

const legacySizes: Record<LegacyButtonSize, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 px-3 text-xs",
  lg: "h-10 px-8",
  icon: "h-9 w-9",
};

/** Compatibility classes for the retained themes' original button variants. */
export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: LegacyButtonVariant;
  size?: LegacyButtonSize;
  className?: string;
} = {}) {
  return cn(
    legacyButtonBase,
    legacyVariants[variant],
    legacySizes[size],
    className,
  );
}

/** The look of a `Button`, for links that are themselves buttons. */
export function buttonClass({
  variant = "regular",
  size = "md",
  tone,
  className,
}: ButtonStyle = {}) {
  const isLegacyVariant = variant in legacyVariants;
  const isLegacySize = size === "default" || size === "icon";

  if (isLegacyVariant || isLegacySize) {
    const legacyVariant = isLegacyVariant
      ? (variant as LegacyButtonVariant)
      : "default";
    const legacySize = isLegacySize
      ? (size as LegacyButtonSize)
      : size === "sm" || size === "lg"
        ? size
        : "default";
    return buttonVariants({
      variant: legacyVariant,
      size: legacySize,
      className,
    });
  }

  return cn(
    "fuwari-button",
    `fuwari-button-${variant}`,
    `fuwari-button-${size}`,
    tone === "danger" && "fuwari-button-tone-danger",
    className,
  );
}

/**
 * The Fuwari button. `loading` swaps the leading `icon` for a spinner and
 * disables the button until the work is done. Legacy variants remain available
 * to the retained themes while upstream UI uses the Fuwari variants.
 */
export function Button({
  variant,
  size = "md",
  tone,
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> &
  ButtonStyle & {
    loading?: boolean;
    /** A leading icon, replaced by the spinner while `loading`. */
    icon?: ReactNode;
  }) {
  return (
    <button
      type={type}
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, tone, className })}
    >
      {loading ? <Spinner size={size === "sm" ? 14 : 16} /> : icon}
      {children}
    </button>
  );
}
