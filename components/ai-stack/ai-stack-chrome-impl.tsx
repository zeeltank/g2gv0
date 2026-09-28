'use client';

/**
 * The chrome every Fees → AI Stack screen shares.
 *
 * Six screens in this folder open with the same header, report failure the same way
 * and say "nothing here yet" the same way. Without this they were six copies of forty
 * lines of Tailwind, which is how two of them end up looking subtly different after a
 * design tweak lands in one.
 *
 * It is deliberately only chrome — no data, no fetching, no knowledge of any tab. The
 * visual language is the one `fees-templates-screen.tsx` established (white cards,
 * hairline slate borders, 2xl radius), because Templates shipped first and is the tab
 * this set has to look like.
 */

import type { ReactNode } from 'react';
import { AlertTriangle, Check, Info, Loader2, RefreshCw, type LucideIcon } from 'lucide-react';

/** The heading strip: what the tab is, plus Refresh and whatever actions it owns. */
export function FeesAiHeader({
  icon: Icon,
  title,
  summary,
  loading = false,
  onRefresh,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  summary: string;
  loading?: boolean;
  onRefresh?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-0.5 max-w-3xl text-sm leading-6 text-slate-500">{summary}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </button>
        )}
        {actions}
      </div>
    </header>
  );
}

/** A plain white panel. Every list and form on these screens sits in one. */
export function FeesAiCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

export function FeesAiCardHeading({ title, hint, actions }: { title: string; hint?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {actions}
    </div>
  );
}

export function FeesAiNotice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <Check className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

export function FeesAiError({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        {children}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          <RefreshCw className="size-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}

/** Context the reader needs to interpret what they are looking at. Never a warning. */
export function FeesAiHint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function FeesAiLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function FeesAiEmpty({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
      <Icon className="mx-auto size-7 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** A count with a label. Money is never invented — pass a string when there is no figure. */
export function FeesAiMetrics({
  metrics,
}: {
  metrics: Array<{ key: string; label: string; value: string | number; hint?: string }>;
}) {
  if (!metrics.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.key} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="truncate text-[11px] font-semibold uppercase tracking-widest text-slate-400">{metric.label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-slate-900">
            {typeof metric.value === 'number' ? metric.value.toLocaleString('en-IN') : metric.value}
          </p>
          {metric.hint && <p className="mt-1 text-[11px] leading-4 text-slate-400">{metric.hint}</p>}
        </div>
      ))}
    </div>
  );
}

const TONES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-slate-200 text-slate-700',
} as const;

export function FeesAiPill({ tone = 'gray', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium capitalize ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Table head cells, so every list on these screens has the same overline treatment. */
export function FeesAiTableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="bg-slate-50">
        {columns.map((column) => (
          <th
            key={column}
            className="whitespace-nowrap border-b border-slate-200 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500"
          >
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Locale-stable date rendering, matching the Templates screen's `en-IN` output. */
export function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
