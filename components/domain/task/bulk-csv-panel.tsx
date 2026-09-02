'use client'

/**
 * BULK TASK IMPORT FROM A SPREADSHEET.
 *
 * One row per task, for the case where the work was planned somewhere else and
 * only needs to land in the system.
 *
 * THE SAMPLE GATE IS DELIBERATE. "Choose CSV" stays disabled until the sample
 * has been downloaded, because the importer matches people, departments and
 * job roles by name: a file with the right data under the wrong headings
 * imports zero rows and reports every one of them as skipped. Making the
 * format impossible to skip past is cheaper than explaining the failure.
 *
 * PRESENTATIONAL ONLY — the upload call, the notifications it triggers and
 * closing the drawer stay in create-task-modal with the rest of the write path.
 */

import { Download, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { taskService } from '@/services/task'

type BulkResult = Awaited<ReturnType<typeof taskService.uploadBulkTasks>>

export function BulkCsvPanel({
  file, onFile, sampleDownloaded, onSampleDownloaded, result, loading, onUpload, onCancel,
}: {
  file: File | null
  onFile: (next: File | null) => void
  sampleDownloaded: boolean
  onSampleDownloaded: () => void
  result: BulkResult | null
  loading: boolean
  onUpload: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold">Bulk Task Upload</h3>
          <p className="text-xs text-muted-foreground">Download the format first, then upload the completed CSV.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Back to the single task form">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a href="/task-assignment-sample.csv" download onClick={onSampleDownloaded}>
          <Button type="button" variant="outline"><Download className="mr-2 size-4" />Download Sample CSV</Button>
        </a>
        <label className={cn(
          'inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium',
          sampleDownloaded ? 'cursor-pointer bg-background' : 'cursor-not-allowed opacity-50',
        )}>
          <FileText className="mr-2 size-4" />{file?.name ?? 'Choose CSV'}
          <input
            type="file" accept=".csv" className="hidden"
            disabled={!sampleDownloaded || loading}
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Button type="button" disabled={!file || loading} onClick={onUpload}>
          {loading ? 'Uploading…' : 'Import Tasks'}
        </Button>
      </div>

      {!sampleDownloaded && (
        <p className="mt-2 text-xs text-warning">Please download the sample CSV before choosing a file.</p>
      )}

      {result && (
        <div className="mt-4 rounded-lg border bg-background p-3 text-sm">
          <p className="font-medium">
            {result.imported ?? 0} task(s) imported
            {result.skipped_count ? `, ${result.skipped_count} row(s) skipped` : ''}.
          </p>
          {/* Every skipped row, with the reason. A count alone leaves somebody
              diffing two spreadsheets to find out what went wrong. */}
          {!!result.skipped_details?.length && (
            <div className="mt-3 max-h-48 overflow-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">Row</th><th className="p-2">Task</th>
                    <th className="p-2">Assigned To</th><th className="p-2">Department</th>
                    <th className="p-2">Job Role</th><th className="p-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.skipped_details.map((item, index) => (
                    <tr key={`${item.row ?? index}-${index}`} className="border-b last:border-0">
                      <td className="p-2">{item.row}</td>
                      <td className="p-2">{item.task_title}</td>
                      <td className="p-2">{item.assigned_to}</td>
                      <td className="p-2">{item.department}</td>
                      <td className="p-2">{item.job_role}</td>
                      <td className="p-2 text-destructive">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">Each row = one task record</p>
    </div>
  )
}
