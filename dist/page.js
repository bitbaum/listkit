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
export function pageOf(total, requested, pageSize) {
    const size = Math.max(1, Math.floor(pageSize) || 1);
    const count = Math.max(0, Math.floor(total) || 0);
    // An empty list still has one page — the one that says there is nothing.
    const totalPages = Math.max(1, Math.ceil(count / size));
    const wanted = Math.max(1, Math.floor(requested) || 1);
    const page = Math.min(wanted, totalPages);
    const from = (page - 1) * size;
    const to = Math.min(from + size, count);
    return {
        page,
        pageSize: size,
        total: count,
        totalPages,
        from,
        to,
        firstItem: count === 0 ? 0 : from + 1,
        lastItem: to,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        clamped: page !== wanted,
    };
}
/**
 * The page numbers to render, with gaps collapsed.
 *
 * `null` is a gap. Returning it rather than a string keeps the ellipsis a
 * rendering decision, which is the caller's to make.
 */
export function pageWindow(page, totalPages, span = 1) {
    const keep = new Set([1, totalPages]);
    for (let i = page - span; i <= page + span; i++)
        if (i >= 1 && i <= totalPages)
            keep.add(i);
    const sorted = [...keep].sort((a, b) => a - b);
    const out = [];
    let previous = 0;
    for (const n of sorted) {
        if (previous && n - previous > 1)
            out.push(null);
        out.push(n);
        previous = n;
    }
    return out;
}
