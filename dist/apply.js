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
import { facetMatches } from "./facets.js";
import { searchMatches, searchScore, searchTerms } from "./search.js";
import { compareBy } from "./sort.js";
import { pageOf } from "./page.js";
import { RELEVANCE_SORT } from "./query.js";
/** Every row that passes the query, unpaged and unsorted. */
export function matches(rows, spec, query) {
    return rows.filter((row) => {
        if (!searchMatches(spec.search, row, query.q))
            return false;
        for (const facet of spec.facets) {
            if (!facetMatches(facet, row, query.facets[facet.key] ?? []))
                return false;
        }
        return true;
    });
}
/**
 * How many rows each option of each facet would yield.
 *
 * Counted with that facet's OWN selection lifted, which is what makes the
 * numbers useful: while filtering by `kind=product`, the count beside
 * `kind=demo` should say how many demos there are, not zero.
 */
export function facetCounts(rows, spec, query) {
    const out = {};
    for (const facet of spec.facets) {
        const others = { ...query, facets: { ...query.facets, [facet.key]: [] } };
        const pool = matches(rows, spec, others);
        const tally = {};
        for (const option of facet.options ?? []) {
            tally[option] = pool.filter((row) => facetMatches(facet, row, [option])).length;
        }
        out[facet.key] = tally;
    }
    return out;
}
/**
 * Is this query ordered by relevance? Only while there is text to rank by,
 * and only when the reader asked for it (`?sort=relevance`) or has not chosen
 * a sort of their own — an explicit "newest" stays newest while searching.
 */
export function isRanked(spec, query) {
    if (!spec.search || searchTerms(query.q).length === 0)
        return false;
    if (query.sort === RELEVANCE_SORT)
        return true;
    return spec.search.rank !== false && query.sort === spec.defaultSort;
}
/** Filter, sort, count and page in one pass. */
export function applyQuery(rows, spec, query) {
    const passed = matches(rows, spec, query);
    const sort = spec.sorts.find((s) => s.key === query.sort) ??
        spec.sorts.find((s) => s.key === spec.defaultSort) ??
        spec.sorts[0];
    const byKey = sort ? compareBy(sort.by, query.dir) : null;
    let sorted;
    if (isRanked(spec, query)) {
        // Score once per row, not once per comparison. Ties keep the list's own
        // order, so equally good matches still read alphabetically (or newest
        // first, or whatever the default is).
        const scored = passed.map((row) => ({ row, score: searchScore(spec.search, row, query.q) }));
        scored.sort((a, b) => b.score - a.score || (byKey ? byKey(a.row, b.row) : 0));
        sorted = scored.map((s) => s.row);
    }
    else {
        sorted = byKey ? [...passed].sort(byKey) : passed;
    }
    const page = pageOf(sorted.length, query.page, query.pageSize);
    return {
        rows: sorted.slice(page.from, page.to),
        matched: passed.length,
        total: rows.length,
        page,
        counts: facetCounts(rows, spec, query),
    };
}
