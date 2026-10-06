import { CellSelection } from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Check, ChevronDown } from "lucide-react";
import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/icon-button";
import {
  POPOVER_PANEL_CLASS,
  useAnchoredPopover,
} from "@/components/ui/use-anchored-popover";
import { MOTION, useMotionPresence } from "@/hooks/use-motion";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
  TABLE_CONTROL_GROUPS,
  type TableAction,
  type TableControlGroup,
  tableControlState,
} from "./table-controls";
import { tableMenuPosition } from "./table-menu-position";

interface TableBubbleMenuProps {
  editor: Editor | null;
}

type Size = "sm" | "md";
type ControlState = ReturnType<typeof tableControlState>;

const TOOLBAR_CLASS =
  "pointer-events-auto flex items-center gap-0.5 rounded-xl bg-(--fuwari-card-bg) p-1 shadow-md ring-1 ring-(--fuwari-input-border)";

const DESTRUCTIVE_CLASS =
  "hover:bg-(--fuwari-danger-bg) hover:text-(--fuwari-danger-fg)";

function textButtonClass(size: Size, destructive?: boolean) {
  return cn(
    "flex shrink-0 items-center gap-1.5 rounded-lg text-sm whitespace-nowrap transition-colors duration-200 fuwari-text-75",
    size === "md" ? "h-10 px-3" : "h-8 px-2",
    destructive
      ? DESTRUCTIVE_CLASS
      : "hover:bg-(--fuwari-btn-regular-bg) hover:text-(--fuwari-primary)",
  );
}

const Separator = () => (
  <div className="mx-1 h-4 w-px shrink-0 bg-(--fuwari-meta-divider)" />
);

/** A labelled dropdown of table actions, such as everything about rows. */
function TableActionMenu({
  editor,
  group,
  state,
  size,
}: {
  editor: Editor;
  group: Extract<TableControlGroup, { kind: "menu" }>;
  state: ControlState;
  size: Size;
}) {
  const [open, setOpen] = useState(false);
  const { triggerRef, popoverRef, style } = useAnchoredPopover({
    open,
    onDismiss: () => setOpen(false),
    width: 12 * 16,
    maxHeight: 240,
  });
  const actions = group.actions.filter((action) => state[action.id]?.available);

  useEffect(() => {
    if (open && style && !popoverRef.current?.contains(document.activeElement))
      popoverRef.current?.querySelector("button")?.focus();
  }, [open, style]);

  const pick = (action: TableAction) => {
    setOpen(false);
    action.run(editor);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          textButtonClass(size),
          open && "bg-(--fuwari-btn-regular-bg) text-(--fuwari-primary)",
        )}
      >
        {group.label()}
        <ChevronDown
          size={12}
          className={cn(
            "transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {style &&
        createPortal(
          <div
            ref={popoverRef}
            role="menu"
            aria-label={group.label()}
            data-state={open ? "open" : "closing"}
            inert={!open}
            className={cn(POPOVER_PANEL_CLASS, "p-1")}
            style={style}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                triggerRef.current?.focus();
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const items = Array.from(
                  popoverRef.current?.querySelectorAll("button") ?? [],
                );
                const index = items.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                const step = event.key === "ArrowDown" ? 1 : -1;
                items[(index + step + items.length) % items.length]?.focus();
              }
            }}
          >
            {actions.map((action) => {
              const active = state[action.id]?.active;
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  role={active === undefined ? "menuitem" : "menuitemcheckbox"}
                  aria-checked={active}
                  onClick={() => pick(action)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    action.destructive
                      ? cn("fuwari-text-75", DESTRUCTIVE_CLASS)
                      : "fuwari-text-75 hover:bg-(--fuwari-btn-regular-bg)/70 hover:fuwari-text-90",
                  )}
                >
                  <Icon size={14} aria-hidden className="shrink-0" />
                  <span className="flex-1">{action.label()}</span>
                  {active && (
                    <Check
                      size={14}
                      aria-hidden
                      className="shrink-0 text-(--fuwari-primary)"
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

function TableActionButton({
  editor,
  action,
  active,
  iconOnly,
  size,
}: {
  editor: Editor;
  action: TableAction;
  active?: boolean;
  iconOnly?: boolean;
  size: Size;
}) {
  const Icon = action.icon;
  if (iconOnly) {
    return (
      <IconButton
        label={action.label()}
        active={active}
        onClick={() => action.run(editor)}
        className={cn(
          size === "md" && "h-10 w-10",
          action.destructive && DESTRUCTIVE_CLASS,
        )}
      >
        <Icon size={size === "md" ? 16 : 14} strokeWidth={active ? 2.5 : 2} />
      </IconButton>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => action.run(editor)}
      className={cn(
        textButtonClass(size, action.destructive),
        active && "bg-(--fuwari-btn-regular-bg) text-(--fuwari-primary)",
      )}
    >
      <Icon size={14} aria-hidden />
      {action.label()}
    </button>
  );
}

/** The table menu's groups, in `TABLE_CONTROL_GROUPS` order. */
function TableControls({ editor, size }: { editor: Editor; size: Size }) {
  const state =
    useEditorState({
      editor,
      selector: ({ editor: current }) => tableControlState(current),
    }) ?? tableControlState(editor);

  const groups = TABLE_CONTROL_GROUPS.filter((group) =>
    group.actions.some((action) => state[action.id]?.available),
  );

  return groups.map((group, index) => (
    <div key={group.id} className="flex shrink-0 items-center gap-0.5">
      {index > 0 && <Separator />}
      {group.kind === "menu" ? (
        <TableActionMenu
          editor={editor}
          group={group}
          state={state}
          size={size}
        />
      ) : (
        group.actions
          .filter((action) => state[action.id]?.available)
          .map((action) => (
            <TableActionButton
              key={action.id}
              editor={editor}
              action={action}
              active={state[action.id]?.active}
              // The phone bar has no room for every label.
              iconOnly={group.iconOnly || size === "md"}
              size={size}
            />
          ))
      )}
    </div>
  ));
}

function selectionInTable(editor: Editor): boolean {
  if (editor.state.selection instanceof CellSelection) return true;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "table") return true;
  }
  return false;
}

function activeCell(editor: Editor): Element | null {
  const { selection } = editor.state;
  let cellPos: number | null = null;

  if (selection instanceof CellSelection) {
    cellPos = selection.$anchorCell.pos;
  } else {
    const { $from } = selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const type = $from.node(depth).type.name;
      if (type === "tableCell" || type === "tableHeader") {
        cellPos = $from.before(depth);
        break;
      }
    }
  }

  if (cellPos == null) return null;
  const dom = editor.view.nodeDOM(cellPos);
  return dom instanceof Element ? dom : null;
}

function useTableSelection(editor: Editor | null) {
  return (
    useEditorState({
      editor,
      selector: (ctx) => {
        if (!ctx.editor?.isEditable) {
          return { active: false, from: 0, to: 0 };
        }
        return {
          active: selectionInTable(ctx.editor),
          from: ctx.editor.state.selection.from,
          to: ctx.editor.state.selection.to,
        };
      },
    }) ?? { active: false, from: 0, to: 0 }
  );
}

export const TableBubbleMenu: React.FC<TableBubbleMenuProps> = ({ editor }) => {
  const { active, from, to } = useTableSelection(editor);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!editor) {
      setCoords(null);
      return;
    }
    if (!active) return;

    const scroller = document.getElementById("post-editor-scroll-container");
    const place = () => {
      const cell = activeCell(editor);
      const table = cell?.closest("table");
      if (!cell || !table) {
        setCoords(null);
        return;
      }
      setCoords(
        tableMenuPosition({
          table: table.getBoundingClientRect(),
          cell: cell.getBoundingClientRect(),
          menuWidth: menuRef.current?.offsetWidth ?? 0,
          viewportWidth: window.innerWidth,
          visibleTop: scroller?.getBoundingClientRect().top ?? 0,
        }),
      );
    };

    place();
    // The menu's width is known only once it has rendered.
    const frame = requestAnimationFrame(place);
    scroller?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    // Dragging a column border moves the cell without moving the selection.
    editor.on("update", place);
    return () => {
      cancelAnimationFrame(frame);
      editor.off("update", place);
      scroller?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [editor, active, from, to]);

  const present = useMotionPresence(active && !!coords, MOTION.popover);
  if (!editor || !present || !coords) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 hidden lg:block"
      style={{
        top: coords.top,
        left: coords.left,
        transform: "translateY(calc(-100% - 8px))",
      }}
    >
      <div
        ref={menuRef}
        role="toolbar"
        aria-label={m.editor_table_menu()}
        data-state={active ? "open" : "closing"}
        inert={!active}
        className={cn("fuwari-popover-motion", TOOLBAR_CLASS)}
      >
        <TableControls editor={editor} size="sm" />
      </div>
    </div>
  );
};

export function TableMobileBar({ editor }: { editor: Editor | null }) {
  const { active } = useTableSelection(editor);

  const present = useMotionPresence(active, MOTION.modal);
  if (!editor || !present) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center lg:hidden">
      <div
        role="toolbar"
        aria-label={m.editor_table_menu()}
        data-state={active ? "open" : "closing"}
        inert={!active}
        className={cn(
          "fuwari-edge-motion max-w-full overflow-x-auto",
          TOOLBAR_CLASS,
        )}
      >
        <TableControls editor={editor} size="md" />
      </div>
    </div>
  );
}
