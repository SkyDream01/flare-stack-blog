interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const VIEWPORT_MARGIN = 8;
/** Room the menu needs above its anchor: its height plus the gap. */
const MENU_CLEARANCE = 48;

/**
 * Where the table menu goes: above the table and aligned to its right edge,
 * so it never covers a row or the column borders being dragged. Once the
 * table's top has scrolled out of view it sits above the active cell instead.
 * It always stays inside the viewport. `left` is the menu's left edge and
 * `top` the anchor's top; the menu is drawn just above that line.
 */
export function tableMenuPosition({
  table,
  cell,
  menuWidth,
  viewportWidth,
  visibleTop,
}: {
  table: Box;
  cell: Box;
  menuWidth: number;
  viewportWidth: number;
  visibleTop: number;
}) {
  const anchor = table.top - MENU_CLEARANCE >= visibleTop ? table : cell;
  const maxLeft = viewportWidth - VIEWPORT_MARGIN - menuWidth;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(anchor.right - menuWidth, maxLeft),
  );
  return { top: anchor.top, left };
}
