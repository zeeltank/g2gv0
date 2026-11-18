'use client'

import Link from 'next/link'
import { FileBarChart, LayoutTemplate } from 'lucide-react'

import type { ReportSuggestion, TemplateSuggestion } from '@/lib/intelligence/ai-chat-artifacts'

const chip =
  'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary'

/**
 * Suggested report types and templates for the module the chat is open in, as chips.
 *
 * A report chip calls `onSend` with the suggestion's own prompt, so the chat builds it the
 * same way it would a typed request. A template chip opens that template's screen (the
 * module's Templates tab). Pure props: it fetches nothing and knows no module.
 */
export function ArtifactChips({
  reports = [],
  templates = [],
  onSend,
}: {
  reports?: ReportSuggestion[]
  templates?: TemplateSuggestion[]
  onSend: (message: string) => void
}) {
  const openable = templates.filter((template) => template.screen_path)

  if (reports.length === 0 && openable.length === 0) return null

  return (
    <div className="space-y-2">
      {reports.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Suggested report types</p>
          <div className="flex flex-wrap gap-1.5">
            {reports.map((report) => (
              <button
                key={`${report.module_key}:${report.data_source}`}
                type="button"
                className={chip}
                title={report.description}
                onClick={() => onSend(report.prompt)}
              >
                <FileBarChart className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{report.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {openable.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Templates</p>
          <div className="flex flex-wrap gap-1.5">
            {openable.map((template) => (
              <Link
                key={template.id}
                href={template.screen_path as string}
                className={chip}
                title={template.description ?? `${template.kind} template (${template.status})`}
              >
                <LayoutTemplate className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{template.name}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{template.kind}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
