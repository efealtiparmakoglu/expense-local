import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createExpense,
  filterMonth,
  fromCsv,
  mergeExpenses,
  monthOf,
  monthlyBuckets,
  parseDate,
  toCsv,
  topCategories,
} from "../src/core.ts";

const SAMPLE = [
  createExpense(50, "food", "market", "2026-09-03", 1000),
  createExpense(20, "transport", "bus", "2026-09-10", 2000),
  createExpense(120, "food", "restaurant", "2026-09-25", 3000),
  createExpense(600, "housing", "rent", "2026-10-01", 4000),
];

test("parseDate validates", () => {
  assert.equal(parseDate("2026-09-24"), "2026-09-24");
  assert.equal(parseDate("2026-13-01"), null);
  assert.equal(parseDate("24-09-2026"), null);
  assert.equal(parseDate("hello"), null);
});

test("monthOf extracts YYYY-MM", () => {
  assert.equal(monthOf("2026-09-24"), "2026-09");
});

test("monthlyBuckets groups and sums", () => {
  const buckets = monthlyBuckets(SAMPLE);
  assert.equal(buckets.length, 2);
  const sep = buckets.find((b) => b.month === "2026-09");
  assert.equal(sep?.total, 190);
  assert.equal(sep?.byCategory.food, 170);
  assert.equal(sep?.byCategory.transport, 20);
});

test("filterMonth returns only that month", () => {
  const oct = filterMonth(SAMPLE, "2026-10");
  assert.equal(oct.length, 1);
  assert.equal(oct[0]?.category, "housing");
});

test("topCategories sorts descending", () => {
  const top = topCategories(SAMPLE, "2026-09");
  assert.equal(top[0]?.category, "food");
  assert.equal(top[0]?.total, 170);
});

test("toCsv/fromCsv round trip", () => {
  const csv = toCsv(SAMPLE);
  const { expenses, skipped } = fromCsv(csv);
  assert.equal(skipped, 0);
  assert.deepEqual(expenses, SAMPLE);
});

test("fromCsv skips bad rows", () => {
  const csv = [
    "id,amount,category,description,date",
    "1,10,food,x,2026-09-01",
    "bad,row",
    "2,20,fun,y,2026-13-99",
  ].join("\n");
  const { expenses, skipped } = fromCsv(csv);
  assert.equal(expenses.length, 1);
  assert.equal(skipped, 2);
});

test("merge dedupes by id", () => {
  const existing = [SAMPLE[0] as (typeof SAMPLE)[number]];
  const incoming = [SAMPLE[0] as (typeof SAMPLE)[number], SAMPLE[1] as (typeof SAMPLE)[number]];
  const { merged, added, updatedCount } = mergeExpenses(existing, incoming);
  assert.equal(merged.length, 2);
  assert.equal(added, 1);
  assert.equal(updatedCount, 1);
});

test("createExpense mints unique ids", () => {
  const a = createExpense(1, "fun", "", "2026-09-01", 1000);
  const b = createExpense(2, "fun", "", "2026-09-01", 1000);
  assert.notEqual(a.id, b.id);
});
