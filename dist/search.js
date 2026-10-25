/**
 * Casefold, strip accents, collapse whitespace. "  Zürich  Straße " and
 * "zurich strasse" become the same string. ß has no decomposition, so it is
 * mapped by hand, the same way German itself spells it without the letter.
 */
export function normalise(v) {
    return v
        .normalize("NFKD")
        .replace(/\p{M}+/gu, "")
        .replace(/ß/g, "ss")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}
/**
 * The words of a query, normalised and de-duplicated. A SQL builder applies
 * one `likeContains` per term, ANDed, to agree with `searchMatches`.
 */
export function searchTerms(q) {
    return [...new Set(normalise(q).split(" ").filter(Boolean))];
}
function fields(spec, row) {
    return spec.text(row).map((v) => (v ? normalise(v) : ""));
}
/** Does every word of the query appear in at least one of the record's fields? */
export function searchMatches(spec, row, q) {
    const terms = searchTerms(q);
    if (!terms.length || !spec)
        return true;
    const text = fields(spec, row).filter(Boolean);
    return terms.every((t) => text.some((f) => f.includes(t)));
}
const startsWord = (field, term) => field.startsWith(term) || field.includes(` ${term}`);
/** How well one term matches one field: 0 (absent) to 4 (the whole field). */
function quality(field, term) {
    if (!field || !field.includes(term))
        return 0;
    if (field === term)
        return 4;
    if (field.startsWith(term))
        return 3;
    if (startsWord(field, term))
        return 2;
    return 1;
}
/**
 * How well a record matches, higher first; 0 when it does not match at all.
 *
 * Each term scores its best field, weighted by that field's position in
 * `spec.text` (first field 1, second 1/2, third 1/3 …), and the whole query
 * found as a phrase earns a bonus — so "old bike" ranks "Old bike for sale"
 * above "Bike, old frame".
 */
export function searchScore(spec, row, q) {
    const terms = searchTerms(q);
    if (!terms.length || !spec)
        return 0;
    const text = fields(spec, row);
    let score = 0;
    for (const term of terms) {
        let best = 0;
        text.forEach((field, i) => {
            best = Math.max(best, quality(field, term) / (i + 1));
        });
        if (best === 0)
            return 0;
        score += best;
    }
    const phrase = terms.join(" ");
    if (terms.length > 1) {
        const at = text.findIndex((f) => f.includes(phrase));
        if (at >= 0)
            score += 2 / (at + 1);
    }
    return score;
}
