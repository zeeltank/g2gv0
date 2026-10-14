/**
 * Shared TanStack Table v9 feature composition for every report result table
 * in this engine (tabular view, drill-down dialog) — one `tableFeatures()`
 * object so every table opts into the same capabilities the same way,
 * matching shadcn/ui's own documented v9 pattern (a dedicated
 * `data-table-features.ts` alongside `columns.tsx`/`data-table.tsx`).
 *
 * Deliberately NOT opting into `rowPaginationFeature` — pagination here is
 * server-driven (ReportController::run()'s own page/per_page params,
 * Docs/reports-engine/PLAN.md Phase 4), so TanStack only ever sees one
 * page's worth of rows at a time; its own pagination row-model would be
 * redundant. Sorting is genuinely client-side (re-order the rows already on
 * screen) since re-querying the server on every header click would be far
 * more friction than the UI gain justifies for a single visible page.
 */
import {
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table'

export const reportTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})

export type ReportTableFeatures = typeof reportTableFeatures
