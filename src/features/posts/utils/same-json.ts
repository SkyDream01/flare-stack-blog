/**
 * Whether two JSON values are the same document, whatever order their object
 * keys are in. A key holding `undefined` counts as absent, as JSON drops it.
 */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameJson(item, b[index]))
    );
  }
  const left = Object.entries(a).filter(([, value]) => value !== undefined);
  const right = Object.entries(b).filter(([, value]) => value !== undefined);
  if (left.length !== right.length) return false;
  const other = new Map(right);
  return left.every(
    ([key, value]) => other.has(key) && sameJson(value, other.get(key)),
  );
}
