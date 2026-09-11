import test from "node:test";
import assert from "node:assert/strict";
import { applyQuery, matches, facetCounts, emptyQuery, facetMatches } from "listkit";

const rows = [
  {
    name: "aoz",
    kind: "client",
    status: "live",
    tags: ["housing"],
    site: "a",
    tier: "b",
    price: 900,
  },
  {
    name: "datacat",
    kind: "product",
    status: "live",
    tags: ["forms", "ai"],
    site: "d",
    tier: "a",
    price: 0,
  },
  {
    name: "causius",
    kind: "product",
    status: "prospect",
    tags: ["law"],
    site: "c",
    tier: "c",
    price: 0,
  },
  { name: "skif", kind: "product", status: "prospect", tags: [], site: null, tier: "c", price: 0 },
  {
    name: "camille",
    kind: "demo",
    status: "demo",
    tags: ["bakery"],
    site: "m",
    tier: "b",
    price: 0,
  },
];

/** @type {import("listkit").ListSpec<(typeof rows)[number]>} */
const spec = {
  facets: [
    { key: "kind", kind: "one", value: (r) => r.kind, options: ["product", "client", "demo"] },
    { key: "status", kind: "many", value: (r) => r.status, options: ["live", "prospect", "demo"] },
    {
      key: "tag",
      kind: "many",
      value: (r) => r.tags,
      options: ["housing", "forms", "ai", "law", "bakery"],
      logic: "all",
    },
    { key: "nosite", kind: "flag", value: (r) => !r.site },
    {
      key: "tier",
      kind: "ordinal",
      value: (r) => r.tier,
      options: ["a", "b", "c"],
      scale: ["c", "b", "a"],
    },
    { key: "price", kind: "range", value: (r) => r.price },
  ],
  search: { text: (r) => [r.name, ...r.tags] },
  sorts: [{ key: "name", by: [(r) => r.name] }],
  defaultSort: "name",
  defaultPageSize: 2,
};

const q = (over) => ({ ...emptyQuery(spec), ...over });

test("an empty selection filters nothing — not everything", () => {
  assert.equal(matches(rows, spec, q({ facets: { kind: [] } })).length, rows.length);
});

test("`many` with any-logic unions, with all-logic intersects", () => {
  assert.equal(matches(rows, spec, q({ facets: { status: ["live", "prospect"] } })).length, 4);
  assert.deepEqual(
    matches(rows, spec, q({ facets: { tag: ["forms", "ai"] } })).map((r) => r.name),
    ["datacat"],
    "all-logic needs every selected tag",
  );
  assert.equal(matches(rows, spec, q({ facets: { tag: ["forms", "law"] } })).length, 0);
});

test("a flag matches on the record's own truth", () => {
  assert.deepEqual(
    matches(rows, spec, q({ facets: { nosite: ["1"] } })).map((r) => r.name),
    ["skif"],
  );
});

test("an ordinal selects a threshold, not an equality", () => {
  // scale is c < b < a, so "b" means b or better.
  assert.deepEqual(
    matches(rows, spec, q({ facets: { tier: ["b"] } }))
      .map((r) => r.name)
      .sort(),
    ["aoz", "camille", "datacat"],
  );
  assert.equal(matches(rows, spec, q({ facets: { tier: ["c"] } })).length, 5);
});

test("an unknown ordinal threshold filters nothing rather than everything", () => {
  const tier = spec.facets.find((f) => f.key === "tier");
  assert.equal(facetMatches(tier, rows[0], ["zzz"]), true);
});

test("a range is inclusive and each end may be left open", () => {
  assert.equal(matches(rows, spec, q({ facets: { price: ["1", ""] } })).length, 1);
  assert.equal(matches(rows, spec, q({ facets: { price: ["", "0"] } })).length, 4);
  assert.equal(matches(rows, spec, q({ facets: { price: ["0", "900"] } })).length, 5);
});

test("search looks everywhere the spec points, and is case and space insensitive", () => {
  assert.deepEqual(
    matches(rows, spec, q({ q: "  BAKERY " })).map((r) => r.name),
    ["camille"],
  );
  assert.deepEqual(
    matches(rows, spec, q({ q: "cat" })).map((r) => r.name),
    ["datacat"],
  );
  assert.equal(matches(rows, spec, q({ q: "" })).length, rows.length);
});

test("facets combine as AND across keys", () => {
  const out = matches(rows, spec, q({ facets: { kind: ["product"], status: ["prospect"] } }));
  assert.deepEqual(out.map((r) => r.name).sort(), ["causius", "skif"]);
});

test("counts are computed with that facet's own selection lifted", () => {
  // Filtering by kind=product, the count beside kind=demo must still say 1 —
  // otherwise every unselected option reads as a dead end.
  const counts = facetCounts(rows, spec, q({ facets: { kind: ["product"] } }));
  assert.equal(counts.kind.demo, 1);
  assert.equal(counts.kind.product, 3);
  // Other facets ARE narrowed by the active kind: only products are counted.
  assert.equal(counts.status.live, 1, "live products");
});

test("applyQuery pages the sorted matches and reports both totals", () => {
  const out = applyQuery(rows, spec, q({ facets: { kind: ["product"] }, page: 2, pageSize: 2 }));
  assert.equal(out.total, 5, "total is the whole collection");
  assert.equal(out.matched, 3, "matched is what passed the filter");
  assert.deepEqual(
    out.rows.map((r) => r.name),
    ["skif"],
  );
  assert.equal(out.page.firstItem, 3);
  assert.equal(out.page.lastItem, 3);
});

test("a page past the end shows the last page and says it moved the reader", () => {
  const out = applyQuery(rows, spec, q({ page: 99, pageSize: 2 }));
  assert.equal(out.page.clamped, true);
  assert.equal(out.page.page, 3);
  assert.equal(out.rows.length, 1);
});

test("a query that matches nothing returns one empty page, not zero pages", () => {
  const out = applyQuery(rows, spec, q({ q: "nothing-matches-this" }));
  assert.equal(out.matched, 0);
  assert.equal(out.page.totalPages, 1);
  assert.equal(out.page.firstItem, 0);
  assert.deepEqual(out.rows, []);
});

test("the source array is never mutated", () => {
  const before = rows.map((r) => r.name);
  applyQuery(rows, spec, q({ sort: "name", dir: "desc" }));
  assert.deepEqual(
    rows.map((r) => r.name),
    before,
  );
});
