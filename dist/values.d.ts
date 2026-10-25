/**
 * The small operations every list rewrites.
 *
 * `toggleInSet` was found about twenty-five times across twelve repositories,
 * in two encodings, and two of the copies were character-for-character
 * identical in repos that share no code. One repo wrote the same three-line
 * body eight times for eight facets, plus eleven more for its boolean flags.
 * That is roughly a hundred and twenty lines in one file expressing one idea.
 *
 * `escapeLike` is the sharper case: three repos escape `%` and `_` before
 * putting a reader's text into a SQL LIKE, and four do not. In those four,
 * typing a single underscore matches every row.
 */
/** Add a value if absent, remove it if present. Order is preserved. */
export declare function toggleInSet(values: readonly string[], value: string): string[];
/** A flag's two states, as the codec writes them: `["1"]` on, `[]` off. */
export declare function toggleFlag(values: readonly string[]): string[];
/**
 * Escape a reader's text for a SQL `LIKE`/`ILIKE` pattern.
 *
 * `%` and `_` are wildcards there. Unescaped, a search for "a_b" matches "axb",
 * and a search for "%" matches every row in the table — which reads to the
 * reader as a filter that does nothing. The backslash must go first or it
 * escapes the escapes.
 */
export declare function escapeLike(value: string): string;
/** `escapeLike`, wrapped for a contains match. */
export declare function likeContains(value: string): string;
/**
 * Call `fn` only once the caller has stopped for `ms`.
 *
 * Eleven hand-rolled copies, five different delays, and — more importantly —
 * only three of the twelve repos also guarded against a slow earlier response
 * overwriting a fast later one. `debounce` cannot fix that race on its own, so
 * `latest` below does, and they are exported together to make the pair obvious.
 */
export declare function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): ((...args: A) => void) & {
    cancel: () => void;
};
/**
 * Wrap an async function so only the most recent call can resolve.
 *
 * Without this, typing "ab" then "abc" can render the results for "ab" if the
 * first request happens to be slower — the reader sees results that do not
 * match the box they are looking at, and nothing in the UI admits it.
 */
export declare function latest<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R | undefined>;
