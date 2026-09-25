/* DOM layer: expense form, list, month selector, bar chart, CSV
 * import/export. IndexedDB storage via a copy of the store pattern. */

import {
  DEFAULT_CATEGORIES,
  createExpense,
  filterMonth,
  fromCsv,
  mergeExpenses,
  monthOf,
  monthlyBuckets,
  toCsv,
  topCategories,
  type Expense,
} from "./core.ts";

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

const DB_NAME = "expense-local";
let db: IDBDatabase | null = null;
let expenses: Expense[] = [];
let viewMonth = monthOf(new Date().toISOString().slice(0, 10));

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("expenses")) {
        database.createObjectStore("expenses", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("idb failed"));
  });
}

async function persistAll(): Promise<void> {
  if (!db) return;
  const tx = db.transaction("expenses", "readwrite");
  const store = tx.objectStore("expenses");
  store.clear();
  for (const expense of expenses) store.put(expense);
}

async function reload(): Promise<void> {
  expenses = await new Promise((resolve, reject) => {
    const tx = db!.transaction("expenses", "readonly");
    const request = tx.objectStore("expenses").getAll();
    request.onsuccess = () => resolve(request.result as Expense[]);
    request.onerror = () => reject(request.error);
  });
}

function monthOptions(): void {
  const select = $("month") as HTMLSelectElement;
  const months = [...new Set(expenses.map((e) => monthOf(e.date)))].sort().reverse();
  if (!months.includes(viewMonth)) viewMonth = months[0] ?? viewMonth;
  select.innerHTML = months.map((m) => `<option value="${m}">${m}</option>`).join("");
  select.value = viewMonth;
}

function renderChart(): void {
  const chart = $("chart") as HTMLElement;
  const top = topCategories(expenses, viewMonth);
  const max = Math.max(...top.map((t) => t.total), 1);
  chart.innerHTML = top
    .map(
      (t) =>
        `<div class="bar-row"><span class="bar-label">${t.category}</span>` +
        `<div class="bar"><div class="bar-fill" style="width:${Math.round((t.total / max) * 100)}%"></div></div>` +
        `<span class="bar-value">${t.total.toFixed(0)}</span></div>`,
    )
    .join("");
}

function renderList(): void {
  const listEl = $("list") as HTMLElement;
  const monthExpenses = filterMonth(expenses, viewMonth).sort((a, b) => b.date.localeCompare(a.date));
  listEl.innerHTML = monthExpenses
    .map(
      (e) =>
        `<div class="row"><span>${e.date}</span><span>${e.category}</span>` +
        `<span>${e.description}</span><strong>${e.amount.toFixed(2)}</strong>` +
        `<button data-id="${e.id}" class="del">✕</button></div>`,
    )
    .join("");
  listEl.querySelectorAll<HTMLButtonElement>(".del").forEach((button) => {
    button.addEventListener("click", async () => {
      expenses = expenses.filter((e) => e.id !== button.dataset.id);
      await persistAll();
      repaint();
    });
  });
}

function repaint(): void {
  monthOptions();
  renderChart();
  renderList();
  const monthExpenses = filterMonth(expenses, viewMonth);
  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  $("summary").textContent = `${viewMonth}: ${monthExpenses.length} expense(s), total ${total.toFixed(2)}`;
}

async function addExpense(): Promise<void> {
  const amount = Number(($("amount") as HTMLInputElement).value);
  const category = ($("category") as HTMLSelectElement).value;
  const description = ($("description") as HTMLInputElement).value;
  const date = ($("date") as HTMLInputElement).value;
  if (Number.isNaN(amount) || amount <= 0 || !date) {
    $("form-status").textContent = "amount and date are required";
    return;
  }
  expenses.push(createExpense(amount, category, description, date));
  await persistAll();
  ($("amount") as HTMLInputElement).value = "";
  ($("description") as HTMLInputElement).value = "";
  $("form-status").textContent = "";
  repaint();
}

function exportCsv(): void {
  const blob = new Blob([toCsv(expenses)], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "expenses.csv";
  link.click();
}

function importCsv(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { expenses: incoming, skipped } = fromCsv(text);
    const { merged, added } = mergeExpenses(expenses, incoming);
    expenses = merged;
    await persistAll();
    $("import-status").textContent = `imported ${added}, skipped ${skipped}`;
    repaint();
  });
  input.click();
}

async function setup(): Promise<void> {
  db = await openDb();
  await reload();
  viewMonth = monthOf(new Date().toISOString().slice(0, 10));

  const categorySelect = $("category") as HTMLSelectElement;
  categorySelect.innerHTML = DEFAULT_CATEGORIES.map(
    (category) => `<option value="${category}">${category}</option>`,
  ).join("");
  ($("date") as HTMLInputElement).value = new Date().toISOString().slice(0, 10);
  $("add").addEventListener("click", addExpense);
  $("export").addEventListener("click", exportCsv);
  $("import").addEventListener("click", importCsv);
  $("month").addEventListener("change", (event) => {
    viewMonth = (event.target as HTMLSelectElement).value;
    repaint();
  });
  repaint();
}

setup();
