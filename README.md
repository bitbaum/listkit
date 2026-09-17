# listkit

A list as a query. Filtering, sorting, searching and paging are the same problem
everywhere, and they were solved separately everywhere.

A survey of twelve repositories in this fleet on 2026-09-11 found:

| what | count |
| --- | --- |
| incompatible filter-state shapes | 12, no two alike |
| hand-built URL builders | ~34 |
| copies of "toggle a value in a set" | ~25, in two encodings |
| debounces, at five different delays | ~11 |
| copies of `Math.ceil(total / pageSize)` | ~11, three in one repo |
| repos that escape `%` and `_` before a SQL `LIKE` | 3 of 7 that need to |

Two of the toggle copies were character-for-character identical in repos that
share no code. One repo wrote the same three-line body eight times for eight
facets, plus eleven more for its boolean flags — about a hundred and twenty
lines expressing one idea.

Four live bugs were among the URL builders, and this codec exists so they cannot
be written again:

- one built `new URLSearchParams()` from scratch, so applying a preset silently
  wiped the reader's active search and five other facets;
- one changed a date range without clearing `page`, landing the reader on page 4
  of a two-page result;
- one preserved exactly three params by name, so every param added later had to
  be remembered in six separate template strings;
- one used `push` rather than `replace` for a debounced search box, so the back
  button walked backwards through every intermediate spelling of the word.

## What it ships

The **decisions**, and nothing else.

```ts
import { parseQuery, writeQuery, applyQuery, type ListSpec } from "listkit";

const spec: ListSpec<Project> = {
  facets: [
    { key: "kind", kind: "one", value: (p) => p.kind, options: ["product", "client", "demo"] },
    { key: "status", kind: "many", value: (p) => p.status, options: ["live", "prospect"] },
    { key: "nosite", kind: "flag", value: (p) => !p.site },
  ],
  search: { text: (p) => [p.name, p.description, p.host] },
  sorts: [
    { key: "name", by: [(p) => p.name] },
    { key: "newest", by: [(p) => p.since, (p) => p.name] },
  ],
  defaultSort: "name",
  defaultPageSize: 25,
};

const query = parseQuery(searchParams, spec); // validated, clamped
const { rows, matched, page, counts } = applyQuery(projects, spec, query);
const url = `?${writeQuery(searchParams, next, spec, query)}`;
```

### Five facet kinds, and no magic sentinel

`one` · `many` · `flag` · `range` · `ordinal`. The value for "no filter" is the
**empty selection**, never a magic string. One surveyed repo used the translated
label (`"Alle"`) as its all-value, which made filter identity depend on the
reader's language.

### Rules the tests pin

- An **empty selection filters nothing**, not everything.
- **Missing values sort last in both directions.** A record with no date is not
  the oldest record.
- **`?page=0` can never become a negative offset**, and an empty list still has
  one page rather than "page 1 of 0".
- **Facet counts are computed with that facet's own selection lifted**, so while
  filtering by `kind=product` the count beside `kind=demo` still says how many
  demos exist, instead of zero.
- **Writing copies the params you were given.** A locale or a referrer survives.
- **`page` is dropped when the result set changes**, kept when only the page moves.
- **A superseded async search resolves to `undefined`**, so a slow "ab" cannot
  overwrite a fast "abc".

## What it deliberately does not ship

Markup, tokens, React, a search engine, or an HTTP client.

Nine token vocabularies and six chip treatments were found among those same
repos, several different **on purpose** — one marketplace is monochrome by
design, one product reserves an accent colour for Bitcoin UI, one is the only
RTL-aware surface in the fleet. The fleet has already run the experiment where a
shared renderer owns the markup: it reached two consumers out of twenty and
shipped the same two defects to both, unfixable downstream because a consumer
cannot patch markup it does not own.

Centralize the rule; render it locally.

The execution engine is also yours. `applyQuery` is the in-memory engine, for
bounded collections. The same `ListSpec` describes what a SQL builder should do
with a large one — `escapeLike` and `likeContains` are exported for exactly that.
Forcing one execution model would serve one repo and strand the rest.

## Install

```bash
pnpm add github:bitbaum/listkit#v0.1.0
```

## Develop

```bash
pnpm install
pnpm run verify   # format, lint, typecheck, build, test
```

Tests import the package **by name**, so a broken `exports` or `files` map fails
here rather than at the first consumer's install.

MIT.

---

Part of **[bitbaum](https://bitbaum.orangecat.ch)** — AI-native products on open
infrastructure, built in Zürich. Every package here lists the apps that use it:
**[which apps use listkit](https://bitbaum.orangecat.ch/packages/#listkit)**.
