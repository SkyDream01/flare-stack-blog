import type { Editor } from "@tiptap/core";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ListboxOption } from "@/components/ui/listbox-option";
import {
  POPOVER_PANEL_CLASS,
  popoverMotionOrigin,
} from "@/components/ui/use-anchored-popover";
import { MOTION, useMotionPresence } from "@/hooks/use-motion";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { SlashMenuState } from ".";
import {
  getSlashMenu,
  highlightSlashMenuItem,
  pickSlashMenuItem,
  subscribeSlashMenu,
} from ".";

const MENU_WIDTH = 14 * 16;

/**
 * The slash menu's popover. It lists the items the typed `/query` matches,
 * anchored below the typed text (above it when there is no room). Focus stays
 * in the editor: the extension handles the keys, and a click inserts an item.
 */
export function SlashMenuView({ editor }: { editor: Editor | null }) {
  const subscribe = useCallback(
    (listener: () => void) =>
      editor ? subscribeSlashMenu(editor, listener) : () => {},
    [editor],
  );
  const menu = useSyncExternalStore(
    subscribe,
    () => (editor ? getSlashMenu(editor) : null),
    () => null,
  );
  const open = menu !== null && menu.items.length > 0;
  const present = useMotionPresence(open, MOTION.popover);

  // Keep showing the last items while the menu animates out.
  const lastMenu = useRef<SlashMenuState | null>(null);
  if (open) lastMenu.current = menu;
  const shown = open ? menu : lastMenu.current;

  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const mount = open ? menu.mount : null;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!mount || !panel) return;
    return mount(panel, {
      onPosition: ({ x, y, strategy, placement }) => {
        setPosition({
          position: strategy,
          left: x,
          top: y,
          ...popoverMotionOrigin(placement.startsWith("top"), "left"),
        });
      },
    });
  }, [mount, present]);

  useEffect(() => {
    if (!present) setPosition(null);
  }, [present]);

  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;
  const activeIndex = shown?.activeIndex ?? 0;

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView?.({ block: "nearest" });
  });

  if (!editor || !present || !shown) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={listId}
      role="listbox"
      aria-label={m.editor_slash_menu()}
      data-state={open ? "open" : "closing"}
      inert={!open}
      aria-hidden={!open}
      style={{
        ...(position ?? { position: "fixed", left: 0, top: 0 }),
        width: MENU_WIDTH,
        visibility: position ? undefined : "hidden",
      }}
      className={cn(
        POPOVER_PANEL_CLASS,
        "max-h-80 overflow-y-auto p-1 custom-scrollbar",
      )}
    >
      {shown.items.map((item, index) => {
        const Icon = item.icon;
        const isActive = index === activeIndex;
        return (
          <ListboxOption
            key={item.id}
            id={optionId(index)}
            active={isActive}
            onActivate={() => highlightSlashMenuItem(editor, index)}
            onPick={() => pickSlashMenuItem(editor, index)}
            className="gap-3 px-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-(--fuwari-input-border)",
                isActive ? "text-(--fuwari-primary)" : "fuwari-text-50",
              )}
            >
              <Icon size={14} />
            </span>
            <span className="truncate">{item.title()}</span>
          </ListboxOption>
        );
      })}
    </div>,
    document.body,
  );
}
