/**
 * Running a query against an in-memory array, and counting the result.
 *
 * This is one of two execution models on purpose. The survey found repos that
 * filter entirely in the browser over a bounded, statically generated array
 * (correct for them), repos that never do client work and push every predicate
 * into SQL (also correct), and repos that must mix because a computed column
 * cannot be filtered in the database. A package that forces one of those serves
 * one repo and strands the rest — so the SPEC is shared and the engine is not.
 * This module is the array engine; a SQL engine consumes the same spec.
 */
import { type ListSpec } from "./facets.js";
import { type PageInfo } from "./page.js";
import { type ListQuery } from "./query.js";
export type ListResult<T> = {
    /** The rows on the current page. */
    rows: T[];
    /** Every row that passed, before paging — for "N of M". */
    matched: number;
    total: number;
    page: PageInfo;
    /**
     * For each facet, how many rows each option would leave if it were added to
     * the current selection. Rendering a filter that leads to nothing is how a
     * reader concludes the page is broken.
     */
    counts: Record<string, Record<string, number>>;
};
/** Every row that passes the query, unpaged and unsorted. */
export declare function matches<T>(rows: readonly T[], spec: ListSpec<T>, query: ListQuery): T[];
/**
 * How many rows each option of each facet would yield.
 *
 * Counted with that facet's OWN selection lifted, which is what makes the
 * numbers useful: while filtering by `kind=product`, the count beside
 * `kind=demo` should say how many demos there are, not zero.
 */
export declare function facetCounts<T>(rows: readonly T[], spec: ListSpec<T>, query: ListQuery): Record<string, Record<string, number>>;
/**
 * Is this query ordered by relevance? Only while there is text to rank by,
 * and only when the reader asked for it (`?sort=relevance`) or has not chosen
 * a sort of their own — an explicit "newest" stays newest while searching.
 */
export declare function isRanked<T>(spec: ListSpec<T>, query: ListQuery): boolean;
/** Filter, sort, count and page in one pass. */
export declare function applyQuery<T>(rows: readonly T[], spec: ListSpec<T>, query: ListQuery): ListResult<T>;
