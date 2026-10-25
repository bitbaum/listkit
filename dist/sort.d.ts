/**
 * Ordering by several keys at once.
 *
 * The survey found about fourteen hand-written multi-key comparators, chained
 * with `||` and each rediscovering the same two decisions: how to break a tie,
 * and where to put a missing value. Nobody agreed on the second. Nulls that
 * sort first push every incomplete record to the top of a list, which is
 * exactly the opposite of what a reader wants from "sort by date".
 *
 * So: missing values always sort LAST, in both directions. A record with no
 * date is not the oldest record; it is a record with no date, and it belongs at
 * the bottom whichever way the arrow points.
 */
export type SortKey<T> = (row: T) => string | number | boolean | null | undefined;
export type Direction = "asc" | "desc";
/**
 * A comparator over several keys, first key wins, later keys break ties.
 *
 * `dir` applies to every key. Where a list needs a fixed first key and a
 * flippable second — "always show attention first, then by name" — express the
 * fixed part as a boolean key, which coerces to 0/1 and orders stably.
 */
export declare function compareBy<T>(keys: readonly SortKey<T>[], dir?: Direction, locales?: string | string[]): (a: T, b: T) => number;
/** The direction a header should switch to when clicked. */
export declare function nextDirection(activeKey: string, clickedKey: string, current: Direction): Direction;
