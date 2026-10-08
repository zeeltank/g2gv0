'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'

interface Props {
  from: string
  to: string
}

/** A plain download link — a download, not a fetch, same pattern as the audit log export. */
export function IcsExportButton({ from, to }: Props) {
  const context = getLaravelContext()
  if (!isLaravelContextReady(context)) return null

  return (
    <a href={taskService.calendarExportIcsUrl(context, from, to)}>
      <Button variant="outline"><Download className="mr-2 size-4" />Export .ics</Button>
    </a>
  )
}
