/* Pure expense logic: records, categories, monthly aggregation, CSV
 * parse/export. No DOM, no storage. */

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  /** ISO date: YYYY-MM-DD */
  date: string;
}

export const DEFAULT_CATEGORIES = [
  "food", "transport", "housing", "fun", "health", "other",
] as const;

export function newId(now: number = Date.now()): string {
  return now.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

/** Parse "YYYY-MM-DD" or reject. */
export function parseDate(text: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return text;
}

export function createExpense(
  amount: number,
  category: string,
  description: string,
  date: string,
  now: number = Date.now(),
): Expense {
  return { id: newId(now), amount, category, description, date };
}

/** "2026-09" from an ISO date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export interface MonthBucket {
  month: string;
  total: number;
  byCategory: Record<string, number>;
}

/** Group expenses by month, totals + per-category sums. */
export function monthlyBuckets(expenses: Expense[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const expense of expenses) {
    const month = monthOf(expense.date);
    let bucket = map.get(month);
    if (!bucket) {
      bucket = { month, total: 0, byCategory: {} };
      map.set(month, bucket);
    }
    bucket.total += expense.amount;
    bucket.byCategory[expense.category] =
      (bucket.byCategory[expense.category] ?? 0) + expense.amount;
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Filter to one month. */
export function filterMonth(expenses: Expense[], month: string): Expense[] {
  return expenses.filter((expense) => monthOf(expense.date) === month);
}

/** Top spending categories in a month, descending. */
export function topCategories(expenses: Expense[], month: string): Array<{ category: string; total: number }> {
  const bucket = monthlyBuckets(expenses).find((b) => b.month === month);
  if (!bucket) return [];
  return Object.entries(bucket.byCategory)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** Export as CSV: id,amount,category,description,date */
export function toCsv(expenses: Expense[]): string {
  const escape = (value: string): string =>
    /[",\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
  const lines = ["id,amount,category,description,date"];
  for (const e of expenses) {
    lines.push(
      [e.id, String(e.amount), escape(e.category), escape(e.description), e.date].join(","),
    );
  }
  return lines.join("\n");
}

/** Parse a CSV in the same format; skips the header and bad rows. */
export function fromCsv(text: string): { expenses: Expense[]; skipped: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { expenses: [], skipped: 0 };
  const expenses: Expense[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    if (parts.length < 5) {
      skipped++;
      continue;
    }
    const [id, amount, category, description, date] = parts;
    const parsedAmount = Number(amount);
    if (!parseDate(date ?? "") || Number.isNaN(parsedAmount)) {
      skipped++;
      continue;
    }
    expenses.push({
      id: id as string,
      amount: parsedAmount,
      category: category ?? "other",
      description: description ?? "",
      date: date as string,
    });
  }
  return { expenses, skipped };
}

/** Dedupe-merge imports by id, newest updated wins. */
export function mergeExpenses(existing: Expense[], incoming: Expense[]): { merged: Expense[]; added: number; updatedCount: number } {
  const byId = new Map<string, Expense>();
  for (const e of existing) byId.set(e.id, e);
  let added = 0;
  let updatedCount = 0;
  for (const e of incoming) {
    if (!byId.has(e.id)) {
      added++;
      byId.set(e.id, e);
    } else {
      updatedCount++;
      byId.set(e.id, e);
    }
  }
  return { merged: [...byId.values()], added, updatedCount };
}
