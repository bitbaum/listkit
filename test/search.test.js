import test from "node:test";
import assert from "node:assert/strict";
import {
  applyQuery,
  emptyQuery,
  isRanked,
  normalise,
  parseQuery,
  searchMatches,
  searchScore,
  searchTerms,
  writeQuery,
  RELEVANCE_SORT,
} from "listkit";

const listings = [
  { title: "Bike, old frame", body: "A steel frame, needs wheels", city: "Bern", since: 3 },
  { title: "Sell my old bike", body: "Rides well", city: "Zürich", since: 1 },
  { title: "Old bike for sale", body: "Commuter", city: "Basel", since: 2 },
  { title: "Garden chairs", body: "Two chairs, one old bike basket", city: "Zug", since: 4 },
  { title: "Wohnung an der Bahnhofstraße", body: "3 Zimmer", city: "Zürich", since: 5 },
];
const spec = {
  facets: [],
  search: { text: (r) => [r.title, r.body, r.city] },
  sorts: [
    { key: "title", by: [(r) => r.title] },
    { key: "newest", by: [(r) => r.since] },
  ],
  defaultSort: "title",
};
const q = (over) => ({ ...emptyQuery(spec), ...over });
const titles = (over) => applyQuery(listings, spec, q(over)).rows.map((r) => r.title);

test("words match in any order", () => {
  assert.ok(searchMatches(spec.search, listings[1], "bike sell"));
  assert.ok(!searchMatches(spec.search, listings[1], "bike garden"), "every word must appear");
});

test("accents and ß fold on both sides", () => {
  assert.equal(normalise("  Zürich   Straße "), "zurich strasse");
  assert.deepEqual(titles({ q: "zurich" }), ["Sell my old bike", "Wohnung an der Bahnhofstraße"]);
  assert.deepEqual(titles({ q: "bahnhofstrasse" }), ["Wohnung an der Bahnhofstraße"]);
  assert.deepEqual(titles({ q: "ZÜRICH" }).length, 2);
});

test("terms are normalised and de-duplicated, for SQL builders", () => {
  assert.deepEqual(searchTerms("  Old  OLD bike "), ["old", "bike"]);
  assert.deepEqual(searchTerms("   "), []);
});

test("a search ranks by where and how well it matched", () => {
  // Title start + phrase beats title start, which beats a title match deep in,
  // which beats a match in the body.
  assert.deepEqual(titles({ q: "old bike" }), [
    "Old bike for sale",
    "Sell my old bike",
    "Bike, old frame",
    "Garden chairs",
  ]);
  assert.ok(searchScore(spec.search, listings[2], "old bike") > 0);
  assert.equal(searchScore(spec.search, listings[4], "old bike"), 0, "a non-match scores 0");
});

test("ties keep the list's own order", () => {
  const same = [
    { title: "b bike", body: "", city: "" },
    { title: "a bike", body: "", city: "" },
  ];
  const out = applyQuery(same, spec, q({ q: "bike" })).rows.map((r) => r.title);
  assert.deepEqual(out, ["a bike", "b bike"]);
});

test("a sort the reader chose wins over relevance", () => {
  assert.deepEqual(titles({ q: "old bike", sort: "newest" }), [
    "Sell my old bike",
    "Old bike for sale",
    "Bike, old frame",
    "Garden chairs",
  ]);
});

test("no text, no ranking — and rank:false opts out", () => {
  assert.equal(isRanked(spec, q({})), false);
  assert.equal(isRanked(spec, q({ q: "bike" })), true);
  const timeline = { ...spec, search: { ...spec.search, rank: false } };
  assert.equal(isRanked(timeline, q({ q: "bike" })), false);
  assert.equal(isRanked(timeline, q({ q: "bike", sort: RELEVANCE_SORT })), true);
});

test("?sort=relevance parses on a searchable spec, and falls back without text", () => {
  const parsed = parseQuery(new URLSearchParams("sort=relevance"), spec);
  assert.equal(parsed.sort, RELEVANCE_SORT);
  // Nothing to rank by: the default order, not an arbitrary one.
  assert.deepEqual(
    applyQuery(listings, spec, parsed).rows.map((r) => r.title),
    [...listings].map((r) => r.title).sort(),
  );
  const unsearchable = { ...spec, search: undefined };
  assert.equal(parseQuery(new URLSearchParams("sort=relevance"), unsearchable).sort, "title");
  assert.equal(
    writeQuery(new URLSearchParams(), { ...parsed, q: "bike" }, spec).toString(),
    "q=bike&sort=relevance",
  );
});
