import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ComponentPropsWithRef } from "react";

interface ToolbarButtonProps extends Omit<
  ComponentPropsWithRef<"button">,
  "children" | "className" | "type"
> {
  isActive?: boolean;
  icon: LucideIcon;
  label?: string;
}

/** An icon-only button in the editor toolbar. */
export function ToolbarButton({
  isActive,
  icon: Icon,
  label,
  ...props
}: ToolbarButtonProps) {
  return (
    <button
      aria-pressed={isActive}
      {...props}
      className={clsx(
        "fuwari-toolbar-button h-8 w-8 flex items-center justify-center group relative rounded-lg",
        isActive
          ? "bg-(--fuwari-btn-regular-bg) text-(--fuwari-primary)"
          : "fuwari-text-50 hover:text-(--fuwari-primary) hover:bg-(--fuwari-btn-regular-bg)",
      )}
      title={label}
      aria-label={label}
      type="button"
    >
      <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
    </button>
  );
}
