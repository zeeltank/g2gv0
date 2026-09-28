'use client';

import React from 'react';
import { AlertTriangle, DatabaseZap, Loader2, RefreshCw } from 'lucide-react';

/** Shared surface for every Brain screen, matching the LMS card language. */
export function Card({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /** Anchor target, so a summary screen can deep-link to one card. */
  id?: string;
}) {
  return (
    <div id={id} className={`rounded-2xl border border-gray-200/70 bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function ScreenHeader({
  title,
  description,
  breadcrumb,
  onRefresh,
  refreshing,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">{breadcrumb}</p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}

export function MetricTiles({
  metrics,
}: {
  metrics: Array<{ key: string; label: string; value: number; available?: boolean; hint?: string }>;
}) {
  if (!metrics.length) return null;

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map((metric) => (
        <Card key={metric.key} className="p-4">
          <p className="truncate text-[11px] font-bold uppercase tracking-widest text-gray-400">{metric.label}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${metric.available === false ? 'text-slate-300' : 'text-slate-900'}`}>
            {metric.available === false ? '—' : metric.value.toLocaleString()}
          </p>
          {metric.available === false ? (
            <p className="mt-1 text-[11px] text-slate-400">store not provisioned</p>
          ) : (
            metric.hint && <p className="mt-1 text-[11px] text-slate-400">{metric.hint}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyMessage = 'No rows for this organization yet.',
  onRowClick,
  maxHeight = '28rem',
}: {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  emptyMessage?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  maxHeight?: string;
}) {
  if (!columns.length) {
    return <p className="px-4 py-6 text-sm text-slate-400">This table has none of the expected columns in this database.</p>;
  }

  if (!rows.length) {
    return <p className="px-4 py-6 text-sm text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-auto scrollbar-hide" style={{ maxHeight }}>
      <table className="w-full min-w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="whitespace-nowrap border-b border-gray-200 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-500"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, index) => (
            <tr
              key={String(row.id ?? index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer transition-colors hover:bg-blue-50/60' : 'transition-colors hover:bg-gray-50/70'}
            >
              {columns.map((column) => (
                <td key={column.key} className="max-w-[22rem] truncate px-4 py-2.5 text-slate-700" title={cellText(row[column.key])}>
                  {cellText(row[column.key]) || <span className="text-slate-300">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One cell, as a person reads it.
 *
 * A stored JSON column used to be dumped verbatim into the table — a wall of
 * braces and quoted keys nobody can scan. Structured values are summarised
 * instead: a list becomes its items, an object becomes its values, and the full
 * text still reaches the cell's tooltip via the `title` attribute.
 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Several LMS columns store JSON as text; unwrap it rather than showing it raw.
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return cellText(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => cellText(entry)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        const text = cellText(entry);
        return text ? `${humaniseKey(key)}: ${text}` : '';
      })
      .filter(Boolean)
      .join(' · ');
  }

  return String(value);
}

/** `head_user_id` -> `Head user`. Column names are schema, not English. */
export function humaniseKey(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').replace(/\bids?\b/gi, '').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

export function Panel({
  title,
  count,
  available,
  table,
  children,
}: {
  title: string;
  count?: number;
  available?: boolean;
  /**
   * The source table. Kept for the tooltip an administrator may want, never
   * printed: `hpbrain_recommendation_evidence` under a panel heading tells a
   * principal nothing and makes the screen read like a database console.
   */
  table?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-900" title={table}>{title}</h2>
        </div>
        {available === false ? (
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">
            not provisioned
          </span>
        ) : (
          typeof count === 'number' && (
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500 tabular-nums">
              {count.toLocaleString()}
            </span>
          )
        )}
      </div>
      {available === false ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400">
          <DatabaseZap size={16} />
          This store is not present in the current database, so there is nothing to show.
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

export function BreakdownBars({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data.length) return <p className="px-4 py-6 text-sm text-slate-400">Nothing recorded yet.</p>;
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-2 px-4 py-4">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-44 shrink-0 truncate text-slate-600" title={item.label}>
            {item.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <span
              className="block h-full rounded-full bg-[#0D6EFD]"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </span>
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-slate-700">
            {item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-gray-200/70 bg-white/80 px-4 py-8 text-sm text-slate-500">
      <Loader2 size={16} className="animate-spin" />
      {label}…
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/70 px-4 py-5">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-700">Enterprise Brain could not load this screen</p>
          <p className="mt-1 break-words text-sm text-red-600">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Pill({ tone = 'gray', children }: { tone?: 'gray' | 'blue' | 'green' | 'amber'; children: React.ReactNode }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-50 text-[#0D6EFD]',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  } as const;

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function HeroHeader({
  breadcrumb,
  title,
  description,
  actions,
  meta,
}: {
  breadcrumb?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <Card className="overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              {breadcrumb && (
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{breadcrumb}</p>
              )}
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
              {description && <p className="mt-2 max-w-3xl text-sm text-slate-400">{description}</p>}
              {meta && <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">{meta}</div>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
          </div>
        </div>
      </Card>
    </section>
  );
}
