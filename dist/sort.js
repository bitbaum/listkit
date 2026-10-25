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
const MISSING = Symbol("missing");
function coerce(v) {
    if (v === null || v === undefined)
        return MISSING;
    if (typeof v === "boolean")
        return v ? 1 : 0;
    if (typeof v === "number")
        return Number.isFinite(v) ? v : MISSING;
    const s = v.trim();
    return s === "" ? MISSING : s;
}
/**
 * Compare two values of one key. Strings compare with `localeCompare` so that
 * accented names land where a reader expects rather than where their code
 * points fall.
 */
function compareOne(a, b, dir, locales) {
    const x = coerce(a);
    const y = coerce(b);
    // Missing is not a value to be ordered — it is the absence of one, and it
    // goes last regardless of direction. Hence this runs BEFORE the flip.
    if (x === MISSING && y === MISSING)
        return 0;
    if (x === MISSING)
        return 1;
    if (y === MISSING)
        return -1;
    let cmp;
    if (typeof x === "number" && typeof y === "number")
        cmp = x - y;
    else
        cmp = String(x).localeCompare(String(y), locales, { numeric: true, sensitivity: "base" });
    return dir === "desc" ? -cmp : cmp;
}
/**
 * A comparator over several keys, first key wins, later keys break ties.
 *
 * `dir` applies to every key. Where a list needs a fixed first key and a
 * flippable second — "always show attention first, then by name" — express the
 * fixed part as a boolean key, which coerces to 0/1 and orders stably.
 */
export function compareBy(keys, dir = "asc", locales) {
    return (a, b) => {
        for (const key of keys) {
            const cmp = compareOne(key(a), key(b), dir, locales);
            if (cmp !== 0)
                return cmp;
        }
        return 0;
    };
}
/** The direction a header should switch to when clicked. */
export function nextDirection(activeKey, clickedKey, current) {
    return activeKey === clickedKey && current === "asc" ? "desc" : "asc";
}
