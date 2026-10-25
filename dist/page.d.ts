/**
 * Paging arithmetic, done once.
 *
 * `Math.ceil(total / pageSize)` appeared about eleven times across the surveyed
 * repos, three times in one of them. The arithmetic is trivial; the edges are
 * not, and the edges are where the bugs were:
 *
 *  - `parseInt(searchParams.page ?? "1")` with no clamp, so `?page=0` produced
 *    `offset = -25` and the query threw;
 *  - a total of zero yielding zero pages, so the UI rendered "page 1 of 0";
 *  - a page number past the end returning an empty slice with no way back,
 *    because the control that would have taken the reader to page 1 was itself
 *    rendered from the out-of-range number.
 *
 * So `pageOf` always returns a page that exists, and says when it had to move
 * the reader — a caller that wants to correct the URL can see that it should.
 */
export type PageInfo = {
    /** The page actually being shown, 1-based and always within range. */
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    /** Slice bounds, for `array.slice(from, to)`. */
    from: number;
    to: number;
    /** 1-based inclusive range of items shown, for "showing 21–40 of 97". */
    firstItem: number;
    lastItem: number;
    hasPrev: boolean;
    hasNext: boolean;
    /** The requested page did not exist and the reader was moved to this one. */
    clamped: boolean;
};
export declare function pageOf(total: number, requested: number, pageSize: number): PageInfo;
/**
 * The page numbers to render, with gaps collapsed.
 *
 * `null` is a gap. Returning it rather than a string keeps the ellipsis a
 * rendering decision, which is the caller's to make.
 */
export declare function pageWindow(page: number, totalPages: number, span?: number): (number | null)[];
