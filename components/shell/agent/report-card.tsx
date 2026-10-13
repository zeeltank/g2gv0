'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Printer, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ChatReport } from '@/lib/intelligence/ai-chat-artifacts'
import { SendReportDialog } from './send-report-dialog'

function formatMoment(value: string): string {
  const date = new Date(value.replace(' ', 'T'))

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

/**
 * A report the assistant built, shown in the conversation.
 *
 * Presentational: it shows the descriptor it is given and links to the saved report page,
 * which owns viewing, editing and printing. Print opens that page with `?print=1`. Send is
 * offered only when the backend says `can_send`; it opens the send dialog (recipients, note,
 * confirm, per-recipient result). `onSend` is an optional notification that it was opened.
 */
export function ReportCard({
  report,
  onSend,
}: {
  report: ChatReport
  /** Called when Send is pressed. Ignored unless `report.can_send`. */
  onSend?: (report: ChatReport) => void
}) {
  const [sendOpen, setSendOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-sm text-foreground shadow-sm">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{report.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {report.row_count} record{report.row_count === 1 ? '' : 's'} read from {report.data_source} ·{' '}
            {formatMoment(report.generated_at)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={report.url_path}>Open / Preview</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`${report.url_path}?print=1`}>
            <Printer className="h-4 w-4" />
            Print
          </Link>
        </Button>
        {report.can_send ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onSend?.(report)
              setSendOpen(true)
            }}
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        ) : null}
      </div>

      {report.can_send ? (
        <SendReportDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          reportId={report.id}
          title={report.title}
          previewHref={report.url_path}
        />
      ) : null}
    </div>
  )
}
