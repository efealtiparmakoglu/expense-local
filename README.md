# expense-local

Local-first expense tracker — IndexedDB storage, six default
categories, monthly bar charts, CSV import/export with dedupe merge.
Single-file offline HTML, zero npm dependencies.

```text
$ npm test          # 9 core tests (Node)
$ npm run build     # -> dist/index.html
```

## Features

- **Categories** — six defaults (food, transport, housing, fun, health,
  other); per-category monthly totals with bar charts.
- **Monthly view** — bucket by `YYYY-MM`, month selector, list with
  inline delete.
- **CSV** — export the full ledger; import merges by id (adds new,
  updates existing) and reports skipped bad rows.
- **Validation** — `parseDate` enforces `YYYY-MM-DD` with real month
  and day ranges.

## Development

```console
$ npm test
$ npm run build
```

## License

MIT — see [LICENSE](LICENSE).
