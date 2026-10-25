/**
 * Free-text search: which records match, and in what order to show them.
 *
 * v0.1 matched the whole query as one substring. That failed the two ways
 * people actually type:
 *
 *  - word order. "bike sell" did not find "Sell my old bike", because the
 *    phrase "bike sell" appears nowhere. Every word must appear somewhere; the
 *    order is the reader's, not the record's.
 *  - accents. "zurich" did not find "Zürich", and "strasse" did not find
 *    "Straße" — on platforms whose readers type on whatever keyboard is in
 *    front of them. Text is folded before comparing, on both sides.
 *
 * And it did not rank. A match on the title and a match three paragraphs into a
 * description sorted by name alike, so the record the reader meant could land
 * on page two. `searchScore` ranks by WHERE a word matched (the spec lists the
 * fields most important first) and HOW well (the whole field, a field's start,
 * a word's start, anywhere inside).
 *
 * Still no search engine: no stemming, no typo tolerance, no index. Those
 * belong to a database or a dedicated engine; this is the rule an in-memory
 * list and a SQL builder can share.
 */
import type { SearchSpec } from "./facets.js";
/**
 * Casefold, strip accents, collapse whitespace. "  Zürich  Straße " and
 * "zurich strasse" become the same string. ß has no decomposition, so it is
 * mapped by hand, the same way German itself spells it without the letter.
 */
export declare function normalise(v: string): string;
/**
 * The words of a query, normalised and de-duplicated. A SQL builder applies
 * one `likeContains` per term, ANDed, to agree with `searchMatches`.
 */
export declare function searchTerms(q: string): string[];
/** Does every word of the query appear in at least one of the record's fields? */
export declare function searchMatches<T>(spec: SearchSpec<T> | undefined, row: T, q: string): boolean;
/**
 * How well a record matches, higher first; 0 when it does not match at all.
 *
 * Each term scores its best field, weighted by that field's position in
 * `spec.text` (first field 1, second 1/2, third 1/3 …), and the whole query
 * found as a phrase earns a bonus — so "old bike" ranks "Old bike for sale"
 * above "Bike, old frame".
 */
export declare function searchScore<T>(spec: SearchSpec<T> | undefined, row: T, q: string): number;
