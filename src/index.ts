/**
 * listkit — a list as a query.
 *
 * Filtering, sorting, searching and paging are the same problem everywhere and
 * were solved separately everywhere: a survey of twelve repositories on
 * 2026-09-11 found twelve incompatible filter-state shapes, ~34 hand-built URL
 * builders, ~25 copies of "toggle a value in a set", ~11 debounces at five
 * different delays, ~11 copies of `Math.ceil(total / pageSize)`, and four live
 * bugs that a shared codec makes unreachable.
 *
 * What this ships: the DECISIONS. A closed set of facet kinds, a URL codec that
 * copies rather than rebuilds, a comparator that puts missing values last, page
 * arithmetic that cannot produce a negative offset, and the handful of one-line
 * functions everyone rewrites.
 *
 * What this deliberately does not ship: markup, tokens, React, a search engine,
 * or an HTTP client. Nine token vocabularies and six chip treatments were found
 * among those same repos, several of them different on purpose. The fleet has
 * already run the experiment where a shared renderer owns the markup: it
 * reached two consumers out of twenty and shipped the same two defects to both,
 * unfixable downstream because a consumer cannot patch markup it does not own.
 * Centralize the rule; render it locally.
 */
export {
  facetMatches,
  searchMatches,
  normalise,
  type Facet,
  type FacetKind,
  type FacetLogic,
  type SearchSpec,
  type Sortable,
  type ListSpec,
} from "./facets.js";

export {
  parseQuery,
  writeQuery,
  emptyQuery,
  isNarrowed,
  sameResultSet,
  PAGE_KEY,
  SIZE_KEY,
  SORT_KEY,
  DIR_KEY,
  TEXT_KEY,
  type ListQuery,
  type ParamsLike,
  type ParseOptions,
} from "./query.js";

export { applyQuery, matches, facetCounts, type ListResult } from "./apply.js";
export { compareBy, nextDirection, type SortKey, type Direction } from "./sort.js";
export { pageOf, pageWindow, type PageInfo } from "./page.js";
export { toggleInSet, toggleFlag, escapeLike, likeContains, debounce, latest } from "./values.js";
