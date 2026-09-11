import test from "node:test";
import assert from "node:assert/strict";
import {
  compareBy,
  nextDirection,
  pageOf,
  pageWindow,
  toggleInSet,
  toggleFlag,
  escapeLike,
  likeContains,
  debounce,
  latest,
} from "listkit";

// ─────────────────────────────────────────────────────────────── comparator
test("missing values sort last in BOTH directions", () => {
  const rows = [{ d: "2026-01-01" }, { d: null }, { d: "2025-01-01" }, { d: undefined }, { d: "" }];
  const asc = [...rows].sort(compareBy([(r) => r.d], "asc")).map((r) => r.d);
  const desc = [...rows].sort(compareBy([(r) => r.d], "desc")).map((r) => r.d);
  assert.deepEqual(asc.slice(0, 2), ["2025-01-01", "2026-01-01"]);
  assert.deepEqual(desc.slice(0, 2), ["2026-01-01", "2025-01-01"]);
  // A record with no date is not the oldest record.
  for (const list of [asc, desc]) {
    assert.equal(
      list.slice(2).every((v) => v === null || v === undefined || v === ""),
      true,
    );
  }
});

test("later keys break ties left by earlier ones", () => {
  const rows = [
    { urgent: false, name: "b" },
    { urgent: true, name: "z" },
    { urgent: true, name: "a" },
  ];
  const out = [...rows].sort(compareBy([(r) => !r.urgent, (r) => r.name])).map((r) => r.name);
  assert.deepEqual(out, ["a", "z", "b"], "urgent first, then alphabetical");
});

test("numbers compare numerically, not as text", () => {
  const rows = [{ n: 10 }, { n: 9 }, { n: 100 }];
  assert.deepEqual(
    [...rows].sort(compareBy([(r) => r.n])).map((r) => r.n),
    [9, 10, 100],
  );
});

test("strings compare the way a reader reads them, not by code point", () => {
  const rows = [{ s: "Zebra" }, { s: "apple" }, { s: "Äpfel" }];
  const out = [...rows].sort(compareBy([(r) => r.s], "asc", "de")).map((r) => r.s);
  // By code point "Ä" (U+00C4) is greater than "Z", so a naive comparator files
  // Äpfel after Zebra — at the bottom of the list, where nobody looks for it.
  // German collation folds it to "apfel", which sorts among the A's and, being
  // "apf…" against "app…", lands just before apple.
  assert.deepEqual(out, ["Äpfel", "apple", "Zebra"]);
  assert.notEqual(out[2], "Äpfel", "an accent must not exile a name to the end");
  // Case is not a sort key either: Zebra does not outrank apple for being capital.
  assert.deepEqual(
    [{ s: "b" }, { s: "A" }].sort(compareBy([(r) => r.s])).map((r) => r.s),
    ["A", "b"],
  );
});

test("a non-finite number is treated as missing, not as the largest value", () => {
  const rows = [{ n: 5 }, { n: NaN }, { n: 1 }];
  assert.deepEqual(
    [...rows]
      .sort(compareBy([(r) => r.n]))
      .map((r) => r.n)
      .slice(0, 2),
    [1, 5],
  );
});

test("clicking the active column flips it; clicking another starts ascending", () => {
  assert.equal(nextDirection("name", "name", "asc"), "desc");
  assert.equal(nextDirection("name", "name", "desc"), "asc");
  assert.equal(nextDirection("name", "date", "desc"), "asc");
});

// ──────────────────────────────────────────────────────────────────── paging
test("an empty list still has one page", () => {
  const p = pageOf(0, 1, 25);
  assert.equal(p.totalPages, 1);
  assert.equal(p.firstItem, 0);
  assert.equal(p.lastItem, 0);
  assert.equal(p.hasNext, false);
});

test("a nonsense page or size can never produce a negative slice", () => {
  for (const [total, page, size] of [
    [50, 0, 25],
    [50, -3, 25],
    [50, 1, 0],
    [50, 1, -10],
  ]) {
    const p = pageOf(total, page, size);
    assert.ok(p.from >= 0, `from ${p.from} for page=${page} size=${size}`);
    assert.ok(p.to >= p.from);
    assert.ok(p.pageSize >= 1);
  }
});

test("the shown range is 1-based and inclusive", () => {
  const p = pageOf(97, 2, 20);
  assert.equal(p.firstItem, 21);
  assert.equal(p.lastItem, 40);
  assert.equal(p.totalPages, 5);
});

test("a last page that is not full ends at the total", () => {
  const p = pageOf(97, 5, 20);
  assert.equal(p.firstItem, 81);
  assert.equal(p.lastItem, 97);
  assert.equal(p.hasNext, false);
});

test("the window collapses gaps and always keeps the ends", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(5, 9, 1), [1, null, 4, 5, 6, null, 9]);
  assert.deepEqual(pageWindow(2, 5, 1), [1, 2, 3, null, 5]);
});

// ──────────────────────────────────────────────────────────────────── values
test("toggling adds then removes, and keeps the order of the rest", () => {
  assert.deepEqual(toggleInSet(["a", "b"], "c"), ["a", "b", "c"]);
  assert.deepEqual(toggleInSet(["a", "b", "c"], "b"), ["a", "c"]);
  assert.deepEqual(toggleInSet([], "a"), ["a"]);
});

test("a flag has exactly two states", () => {
  assert.deepEqual(toggleFlag([]), ["1"]);
  assert.deepEqual(toggleFlag(["1"]), []);
});

test("LIKE wildcards in a reader's text are escaped", () => {
  assert.equal(escapeLike("a_b"), "a\\_b");
  assert.equal(escapeLike("100%"), "100\\%");
  assert.equal(escapeLike("a\\b"), "a\\\\b", "the backslash is escaped first");
  assert.equal(likeContains("50%"), "%50\\%%");
});

test("debounce fires once, with the last arguments", async () => {
  const seen = [];
  const d = debounce((v) => seen.push(v), 10);
  d("a");
  d("b");
  d("c");
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(seen, ["c"]);
});

test("a cancelled debounce never fires", async () => {
  const seen = [];
  const d = debounce((v) => seen.push(v), 10);
  d("a");
  d.cancel();
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(seen, []);
});

test("a slow earlier response cannot overwrite a fast later one", async () => {
  const search = latest(async (term) => {
    await new Promise((r) => setTimeout(r, term === "ab" ? 30 : 1));
    return term;
  });
  const [slow, fast] = await Promise.all([search("ab"), search("abc")]);
  assert.equal(slow, undefined, "the superseded call resolves to nothing");
  assert.equal(fast, "abc");
});
