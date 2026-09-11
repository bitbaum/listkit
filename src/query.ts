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

export const PAGE_KEY = "page";
export const SIZE_KEY = "size";
export const SORT_KEY = "sort";
export const DIR_KEY = "dir";
export const TEXT_KEY = "q";

/** Params as given by a router: a real URLSearchParams or Next's plain record. */
export type ParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

function readAll(params: ParamsLike, key: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(key).flatMap((v) => v.split(","));
  const v = params[key];
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).flatMap((s) => String(s).split(","));
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export type ParseOptions = { maxPageSize?: number };

/**
 * Read a query out of URL params, keeping only what the spec permits.
 *
 * Values outside a facet's declared `options` are dropped. One surveyed repo
 * cast `searchParams.sort` straight into a union with no runtime check and fell
 * through to a default, which meant a mistyped sort looked like it worked.
 */
export function parseQuery<T>(
  params: ParamsLike,
  spec: ListSpec<T>,
  opts: ParseOptions = {},
): ListQuery {
  const maxSize = opts.maxPageSize ?? 200;
  const facets: Record<string, string[]> = {};
  for (const f of spec.facets) {
    const wanted = readAll(params, f.key)
      .map((v) => v.trim())
      .filter(Boolean);
    const allowed = f.options
      ? wanted.filter((v) => (f.options as readonly string[]).includes(v))
      : wanted;
    // `one` and `ordinal` take a single value; extra ones are noise, not intent.
    const capped = f.kind === "one" || f.kind === "ordinal" ? allowed.slice(0, 1) : allowed;
    if (capped.length) facets[f.key] = capped;
  }

  const sortRaw = readAll(params, SORT_KEY)[0];
  const sort =
    sortRaw !== undefined && spec.sorts.some((s) => s.key === sortRaw) ? sortRaw : spec.defaultSort;
  const dirRaw = readAll(params, DIR_KEY)[0];
  const dir: "asc" | "desc" =
    dirRaw === "asc" || dirRaw === "desc" ? dirRaw : (spec.defaultDir ?? "asc");

  return {
    q: (readAll(params, TEXT_KEY)[0] ?? "").trim(),
    facets,
    sort,
    dir,
    page: clampInt(readAll(params, PAGE_KEY)[0], 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampInt(readAll(params, SIZE_KEY)[0], spec.defaultPageSize ?? 25, 1, maxSize),
  };
}

/** True when two queries would produce the same rows — page and size aside. */
export function sameResultSet(a: ListQuery, b: ListQuery): boolean {
  if (a.q !== b.q || a.sort !== b.sort || a.dir !== b.dir) return false;
  const keys = new Set([...Object.keys(a.facets), ...Object.keys(b.facets)]);
  for (const k of keys) {
    const x = a.facets[k] ?? [];
    const y = b.facets[k] ?? [];
    if (x.length !== y.length || x.some((v, i) => v !== y[i])) return false;
  }
  return true;
}

/**
 * Write a query back over the params the reader arrived with.
 *
 * `current` is copied, never replaced, so params this list knows nothing about
 * — a locale, a referrer, a feature flag — survive. When the result set
 * changes, `page` is dropped: page 4 of the old filter is not page 4 of the new
 * one, and the reader would land on an empty list they did not ask for.
 */
export function writeQuery<T>(
  current: ParamsLike,
  next: ListQuery,
  spec: ListSpec<T>,
  previous?: ListQuery,
): URLSearchParams {
  const out =
    current instanceof URLSearchParams
      ? new URLSearchParams(current)
      : new URLSearchParams(
          Object.entries(current).flatMap(([k, v]) =>
            v === undefined
              ? []
              : (Array.isArray(v) ? v : [v]).map((s) => [k, String(s)] as [string, string]),
          ),
        );

  const set = (key: string, value: string | null) => {
    if (value === null || value === "") out.delete(key);
    else out.set(key, value);
  };

  set(TEXT_KEY, next.q || null);
  for (const f of spec.facets) {
    const sel = next.facets[f.key] ?? [];
    set(f.key, sel.length ? sel.join(",") : null);
  }
  set(SORT_KEY, next.sort === spec.defaultSort ? null : next.sort);
  set(DIR_KEY, next.dir === (spec.defaultDir ?? "asc") ? null : next.dir);
  set(SIZE_KEY, next.pageSize === (spec.defaultPageSize ?? 25) ? null : String(next.pageSize));

  const resultSetChanged = previous ? !sameResultSet(previous, next) : false;
  set(PAGE_KEY, resultSetChanged || next.page <= 1 ? null : String(next.page));
  return out;
}

/** The query with everything cleared but the reader's page size. */
export function emptyQuery<T>(spec: ListSpec<T>): ListQuery {
  return {
    q: "",
    facets: {},
    sort: spec.defaultSort,
    dir: spec.defaultDir ?? "asc",
    page: 1,
    pageSize: spec.defaultPageSize ?? 25,
  };
}

/** Has the reader narrowed anything? Drives "clear all" and the empty state. */
export function isNarrowed(query: ListQuery): boolean {
  return query.q !== "" || Object.values(query.facets).some((v) => v.length > 0);
}
