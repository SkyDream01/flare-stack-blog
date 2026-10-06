import { ChevronDown } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  POPOVER_PANEL_CLASS,
  POPOVER_TRIGGER_CLASS,
  useAnchoredPopover,
} from "./use-anchored-popover";

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownMenuProps {
  value: string;
  options: Array<DropdownOption>;
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  value,
  options,
  onChange,
  className = "",
  triggerClassName,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    triggerRef,
    popoverRef: menuRef,
    style: menuStyle,
  } = useAnchoredPopover({
    open: isOpen,
    onDismiss: () => setIsOpen(false),
    width: 11 * 16,
    maxHeight: 256,
  });

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    if (
      isOpen &&
      menuStyle &&
      !menuRef.current?.contains(document.activeElement)
    ) {
      const selected = menuRef.current?.querySelector<HTMLButtonElement>(
        '[aria-checked="true"]',
      );
      (selected ?? menuRef.current?.querySelector("button"))?.focus();
    }
  }, [isOpen, menuStyle]);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(POPOVER_TRIGGER_CLASS, triggerClassName)}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          size={12}
          className={cn(
            "transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-state={isOpen ? "open" : "closing"}
              inert={!isOpen}
              aria-hidden={!isOpen}
              aria-label={ariaLabel}
              className={cn(
                POPOVER_PANEL_CLASS,
                "max-h-64 overflow-y-auto p-1 custom-scrollbar",
              )}
              style={menuStyle}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const buttons = Array.from(
                    menuRef.current?.querySelectorAll("button") ?? [],
                  );
                  const index = buttons.indexOf(
                    document.activeElement as HTMLButtonElement,
                  );
                  const direction = event.key === "ArrowDown" ? 1 : -1;
                  buttons[
                    (index + direction + buttons.length) % buttons.length
                  ]?.focus();
                }
              }}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={value === option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={cn(
                    "flex w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    value === option.value
                      ? "bg-(--fuwari-btn-regular-bg) text-(--fuwari-primary)"
                      : "fuwari-text-75 hover:bg-(--fuwari-btn-regular-bg)/70 hover:fuwari-text-90",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default DropdownMenu;
