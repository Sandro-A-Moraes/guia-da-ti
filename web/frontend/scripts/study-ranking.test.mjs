import { test } from "node:test";
import assert from "node:assert/strict";
import { rankStudy, interactions } from "../src/study-ranking.ts";
import { paginate } from "../src/pagination.ts";
const items = [
  { type: "books", slug: "b", name: "Beta" },
  { type: "books", slug: "a", name: "Alfa" },
  { type: "books", slug: "c", name: "Capa" },
];
const activity = {
  "books/b": { average: 5, ratings: 2, hypes: 1, comments: 10 },
  "books/a": { average: 5, ratings: 3, hypes: 20, comments: 1 },
  "books/c": { average: 3, ratings: 1, hypes: 0, comments: 30 },
};
test("ranks real activity with deterministic ties and no in-place catalog mutation", () => {
  assert.deepEqual(
    rankStudy(items, activity, "hypes").map((r) => r.slug),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    rankStudy(items, activity, "comments").map((r) => r.slug),
    ["c", "b", "a"],
  );
  assert.deepEqual(
    rankStudy(items, activity, "interactions").map((r) => r.slug),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    rankStudy(items, activity, "rating").map((r) => r.slug),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    items.map((r) => r.slug),
    ["b", "a", "c"],
  );
});
test("empty activity is alphabetical, failed comment reads remain unknown", () => {
  assert.deepEqual(
    rankStudy(items, {}, "hypes").map((r) => r.slug),
    ["a", "b", "c"],
  );
  assert.equal(interactions({ ratings: 3, hypes: 4, comments: null }), null);
  assert.equal(interactions({ ratings: 3, hypes: 4, comments: 2 }), 9);
});
test("ranking happens before pagination", () => {
  const all = Array.from({ length: 26 }, (_, i) => ({
    type: "books",
    slug: String(i),
    name: String(i),
  }));
  assert.equal(
    paginate(rankStudy(all, { "books/25": { hypes: 10 } }, "hypes"), 1).items[0]
      .slug,
    "25",
  );
});
