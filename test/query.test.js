// Imported BY NAME, not from dist/ — a broken exports or files map otherwise
// stays green here and fails at the first consumer's install.
import test from "node:test";
import assert from "node:assert/strict";
import { parseQuery, writeQuery, emptyQuery, isNarrowed, sameResultSet } from "listkit";

/** @type {import("listkit").ListSpec<{kind:string,status:string,site:unknown,name:string}>} */
const spec = {
  facets: [
    { key: "kind", kind: "one", value: (r) => r.kind, options: ["product", "demo", "client"] },
    { key: "status", kind: "many", value: (r) => r.status, options: ["live", "prospect"] },
    { key: "nosite", kind: "flag", value: (r) => !r.site },
  ],
  search: { text: (r) => [r.name] },
  sorts: [
    { key: "name", by: [(r) => r.name] },
    { key: "kind", by: [(r) => r.kind] },
  ],
  defaultSort: "name",
  defaultPageSize: 25,
};

test("a value the spec does not permit is dropped, not passed through", () => {
  const q = parseQuery(new URLSearchParams("kind=wat&status=live"), spec);
  assert.deepEqual(q.facets.kind, undefined, "unknown option is not kept");
  assert.deepEqual(q.facets.status, ["live"]);
});

test("an unknown sort falls back to the default instead of silently surviving", () => {
  assert.equal(parseQuery(new URLSearchParams("sort=nope"), spec).sort, "name");
  assert.equal(parseQuery(new URLSearchParams("sort=kind"), spec).sort, "kind");
});

test("page is clamped, so ?page=0 can never become a negative offset", () => {
  assert.equal(parseQuery(new URLSearchParams("page=0"), spec).page, 1);
  assert.equal(parseQuery(new URLSearchParams("page=-4"), spec).page, 1);
  assert.equal(parseQuery(new URLSearchParams("page=abc"), spec).page, 1);
  assert.equal(parseQuery(new URLSearchParams("page=7"), spec).page, 7);
});

test("page size is clamped to a ceiling — a URL cannot ask for the whole table", () => {
  assert.equal(
    parseQuery(new URLSearchParams("size=100000"), spec, { maxPageSize: 200 }).pageSize,
    200,
  );
  assert.equal(parseQuery(new URLSearchParams("size=0"), spec).pageSize, 1);
});

test("a single-value facet ignores extra values rather than half-applying them", () => {
  assert.deepEqual(parseQuery(new URLSearchParams("kind=demo,product"), spec).facets.kind, [
    "demo",
  ]);
});

test("Next's plain searchParams record parses the same as URLSearchParams", () => {
  const a = parseQuery({ status: ["live", "prospect"], q: "cat" }, spec);
  const b = parseQuery(new URLSearchParams("status=live&status=prospect&q=cat"), spec);
  assert.deepEqual(a, b);
});

test("writing copies params it knows nothing about instead of rebuilding", () => {
  const current = new URLSearchParams("locale=de&ref=newsletter&kind=demo");
  const next = { ...emptyQuery(spec), facets: { kind: ["product"] } };
  const out = writeQuery(current, next, spec);
  assert.equal(out.get("locale"), "de", "an unrelated param survives");
  assert.equal(out.get("ref"), "newsletter");
  assert.equal(out.get("kind"), "product");
});

test("a value equal to the default is omitted, so the URL carries only choices", () => {
  const out = writeQuery(new URLSearchParams(), emptyQuery(spec), spec);
  assert.equal(out.toString(), "", "an untouched list has a clean URL");
});

test("page is dropped when the result set changes, and kept when only the page moves", () => {
  const previous = { ...emptyQuery(spec), facets: { kind: ["demo"] }, page: 4 };
  const narrowed = { ...previous, facets: { kind: ["product"] } };
  assert.equal(writeQuery(new URLSearchParams(), narrowed, spec, previous).get("page"), null);

  const paged = { ...previous, page: 5 };
  assert.equal(writeQuery(new URLSearchParams(), paged, spec, previous).get("page"), "5");
});

test("clearing a facet clears its param rather than writing an empty one", () => {
  const out = writeQuery(new URLSearchParams("kind=demo"), emptyQuery(spec), spec);
  assert.equal(out.has("kind"), false);
});

test("sameResultSet ignores paging and notices everything else", () => {
  const base = { ...emptyQuery(spec), facets: { status: ["live"] } };
  assert.equal(sameResultSet(base, { ...base, page: 9 }), true);
  assert.equal(sameResultSet(base, { ...base, q: "x" }), false);
  assert.equal(sameResultSet(base, { ...base, facets: { status: ["prospect"] } }), false);
  assert.equal(sameResultSet(base, { ...base, facets: {} }), false);
});

test("isNarrowed distinguishes an untouched list from a filtered one", () => {
  assert.equal(isNarrowed(emptyQuery(spec)), false);
  assert.equal(isNarrowed({ ...emptyQuery(spec), q: "a" }), true);
  assert.equal(
    isNarrowed({ ...emptyQuery(spec), facets: { kind: [] } }),
    false,
    "an empty selection is not a filter",
  );
  assert.equal(isNarrowed({ ...emptyQuery(spec), page: 3 }), false, "paging is not narrowing");
});

test("a round trip through the URL preserves the reader's query", () => {
  const q = {
    ...emptyQuery(spec),
    q: "cat",
    facets: { status: ["live", "prospect"] },
    sort: "kind",
    dir: "desc",
    page: 3,
  };
  const written = writeQuery(new URLSearchParams(), q, spec);
  const read = parseQuery(written, spec);
  assert.deepEqual(read, q);
});
