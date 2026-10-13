'use client';

import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

/** Page frame, header and inline banner used by the IDMS library screen. */
export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto space-y-4 p-4 @xl:p-6">{children}</div>;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold leading-none text-slate-950">{title}</h1>
          {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
        </div>
        {action}
      </div>
    </section>
  );
}

export function InlineMessage({ type, text }: { type: 'success' | 'error' | 'info'; text: string }) {
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  const classes =
    type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : type === 'info'
        ? 'border-blue-200 bg-blue-50 text-blue-800'
        : 'border-red-200 bg-red-50 text-red-800';

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
