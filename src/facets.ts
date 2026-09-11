/**
 * What you can narrow a list by.
 *
 * A survey of twelve repositories on 2026-09-11 found twelve incompatible
 * filter-state shapes and no two alike. The thing they actually disagree about
 * is not the data — it is what KIND of narrowing each field supports, and each
 * repo rediscovered the kinds one at a time. This is the closed set, taken from
 * what those repos already do:
 *
 *   one      pick a single value            "kind = product"
 *   many     pick several                   "status in (live, validating)"
 *   flag     a boolean switch               "has no site"
 *   range    numeric between                "price 10..50"
 *   ordinal  a threshold on a scale         "tier B or better"
 *
 * The sentinel for "no filter" is the EMPTY SELECTION, never a magic string.
 * One repo used the translated label ("Alle") as its all-value, which makes
 * filter identity depend on the reader's language — a German user and an
 * English user filtering the same list got different results.
 */

/** The kinds of narrowing a field can support. */
export type FacetKind = "one" | "many" | "flag" | "range" | "ordinal";

/** How several selected values combine. `any` is union, `all` is intersection. */
export type FacetLogic = "any" | "all";

export type Facet<T> = {
  /** URL parameter name. Short, stable, lowercase. */
  key: string;
  kind: FacetKind;
  /**
   * The comparable value(s) on a record. Returning an array makes a record
   * match on any of them, which is what tags and themes need.
   */
  value: (row: T) => string | string[] | number | boolean | null | undefined;
  /**
   * Permitted values, when the set is known. Anything else arriving in the URL
   * is dropped rather than passed through: a filter nobody can produce from the
   * UI is either a typo or someone probing, and neither deserves a query.
   */
  options?: readonly string[];
  /** `many` only — defaults to `any`. */
  logic?: FacetLogic;
  /** `ordinal` only — the scale, lowest first. Selection means "this or better". */
  scale?: readonly string[];
};

/** Free-text search: which parts of a record the query is matched against. */
export type SearchSpec<T> = {
  /** Every string worth matching. Empty strings and nulls are ignored. */
  text: (row: T) => (string | null | undefined)[];
};

export type Sortable<T> = {
  key: string;
  /** Sort keys, applied in order until one separates the two records. */
  by: ((row: T) => string | number | boolean | null | undefined)[];
  label?: string;
};

export type ListSpec<T> = {
  facets: readonly Facet<T>[];
  search?: SearchSpec<T>;
  sorts: readonly Sortable<T>[];
  /** Sort key used when the URL names none. Must exist in `sorts`. */
  defaultSort: string;
  defaultDir?: "asc" | "desc";
  defaultPageSize?: number;
};

/** Casefold and collapse whitespace, so " Foo  Bar " and "foo bar" match. */
export function normalise(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

function asList(v: ReturnType<Facet<unknown>["value"]>): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

/**
 * Does one record pass one facet's selection?
 *
 * An empty selection always passes. That is the whole reason this returns true
 * early: "no filter chosen" and "filter chosen that nothing matches" are
 * different states, and conflating them is how a list silently empties itself.
 */
export function facetMatches<T>(facet: Facet<T>, row: T, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  const raw = facet.value(row);

  switch (facet.kind) {
    case "flag": {
      // Present in the selection means "the flag must be true". A flag is the
      // only kind whose value is about the RECORD, not about a match.
      const want = selected[0] !== "0" && selected[0] !== "false";
      return Boolean(raw) === want;
    }
    case "one":
      return asList(raw).some((v) => v === selected[0]);
    case "many": {
      const have = new Set(asList(raw));
      return (facet.logic ?? "any") === "all"
        ? selected.every((s) => have.has(s))
        : selected.some((s) => have.has(s));
    }
    case "range": {
      // selected is [min, max]; either end may be blank, meaning unbounded.
      const n = Number(raw);
      if (!Number.isFinite(n)) return false;
      const lo = selected[0] === "" || selected[0] === undefined ? -Infinity : Number(selected[0]);
      const hi = selected[1] === "" || selected[1] === undefined ? Infinity : Number(selected[1]);
      if (!Number.isFinite(lo) && lo !== -Infinity) return true;
      if (!Number.isFinite(hi) && hi !== Infinity) return true;
      return n >= lo && n <= hi;
    }
    case "ordinal": {
      const scale = facet.scale ?? [];
      const threshold = selected[0];
      if (threshold === undefined) return true;
      const floor = scale.indexOf(threshold);
      if (floor < 0) return true; // an unknown threshold filters nothing
      const at = scale.indexOf(asList(raw)[0] ?? "");
      return at >= 0 && at >= floor;
    }
  }
}

/** Does a record contain the search text anywhere the spec points at? */
export function searchMatches<T>(spec: SearchSpec<T> | undefined, row: T, q: string): boolean {
  const needle = normalise(q);
  if (!needle || !spec) return true;
  return spec.text(row).some((v) => (v ? normalise(v).includes(needle) : false));
}
