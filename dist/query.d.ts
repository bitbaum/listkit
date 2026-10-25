/**
 * The query, and its round trip through a URL.
 *
 * Across the surveyed repos there were roughly thirty-four hand-built URL
 * builders, and four live bugs among them that this codec exists to make
 * impossible:
 *
 *  - one built `new URLSearchParams()` from scratch, so applying a preset
 *    silently wiped the reader's active search and five other facets;
 *  - one changed a date range without clearing `page`, so the reader landed on
 *    page 4 of a two-page result and saw nothing;
 *  - one preserved exactly three params by name, so every param added later had
 *    to be remembered in six separate template strings;
 *  - one used push rather than replace for a debounced search box, so the back
 *    button walked backwards through every intermediate spelling of the word.
 *
 * So: always copy the params you were given, always drop `page` when the result
 * set changes, and never write a value that equals the default — a URL should
 * carry what the reader chose, not a restatement of what they did not.
 */
import type { ListSpec } from "./facets.js";
export type ListQuery = {
    /** Free text. Empty means no text filter. */
    q: string;
    /** facet key → selected values. An absent key and an empty array are the same. */
    facets: Record<string, string[]>;
    sort: string;
    dir: "asc" | "desc";
    /** 1-based. Clamped on parse: `?page=0` must never become a negative offset. */
    page: number;
    pageSize: number;
};
export declare const PAGE_KEY = "page";
export declare const SIZE_KEY = "size";
export declare const SORT_KEY = "sort";
export declare const DIR_KEY = "dir";
export declare const TEXT_KEY = "q";
/**
 * The sort key that means "best match first". Accepted on any spec with a
 * search; it needs no entry in `sorts` and falls back to the default sort when
 * there is no text to rank by.
 */
export declare const RELEVANCE_SORT = "relevance";
/** Params as given by a router: a real URLSearchParams or Next's plain record. */
export type ParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;
export type ParseOptions = {
    maxPageSize?: number;
};
/**
 * Read a query out of URL params, keeping only what the spec permits.
 *
 * Values outside a facet's declared `options` are dropped. One surveyed repo
 * cast `searchParams.sort` straight into a union with no runtime check and fell
 * through to a default, which meant a mistyped sort looked like it worked.
 */
export declare function parseQuery<T>(params: ParamsLike, spec: ListSpec<T>, opts?: ParseOptions): ListQuery;
/** True when two queries would produce the same rows — page and size aside. */
export declare function sameResultSet(a: ListQuery, b: ListQuery): boolean;
/**
 * Write a query back over the params the reader arrived with.
 *
 * `current` is copied, never replaced, so params this list knows nothing about
 * — a locale, a referrer, a feature flag — survive. When the result set
 * changes, `page` is dropped: page 4 of the old filter is not page 4 of the new
 * one, and the reader would land on an empty list they did not ask for.
 */
export declare function writeQuery<T>(current: ParamsLike, next: ListQuery, spec: ListSpec<T>, previous?: ListQuery): URLSearchParams;
/** The query with everything cleared but the reader's page size. */
export declare function emptyQuery<T>(spec: ListSpec<T>): ListQuery;
/** Has the reader narrowed anything? Drives "clear all" and the empty state. */
export declare function isNarrowed(query: ListQuery): boolean;
