'use client'

import { useRef, useState } from 'react'
import { FileUp, Loader2, Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * Bulk employee import.
 *
 * The Import button on the directory toolbar had no onClick at all. The
 * backend half already existed and was already guarded - Api\UserImportController
 * at POST /api/import-users, which takes the tenant from the token and refuses
 * a set of columns outright (password, plain_password, is_admin, status and
 * the rest) so an uploaded file cannot mint an administrator.
 *
 * This is deliberately thin: a file, a preview of what was parsed, and the
 * server's own count of what happened. It does not attempt column mapping -
 * the importer defines the columns, and inventing a mapping UI here would let
 * the two disagree.
 */

const MAX_PREVIEW_ROWS = 5

export function ImportEmployeesDialog({
  open,
  onOpenChange,
  context,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: LaravelContext
  onImported: (message: string) => void | Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setFile(null)
    setPreview([])
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  /**
   * Read only the first few lines for the preview.
   *
   * Naive comma splitting is fine here because this is *shown*, never sent -
   * the server parses the file itself. Splitting quoted commas wrongly in a
   * preview is a cosmetic problem; doing it in the import would not be.
   */
  async function choose(selected: File | null) {
    setError('')
    setFile(selected)
    setPreview([])

    if (!selected) return

    try {
      const head = await selected.slice(0, 64 * 1024).text()
      const lines = head.split(/\r?\n/).filter((line) => line.trim() !== '')
      setPreview(lines.slice(0, MAX_PREVIEW_ROWS + 1).map((line) => line.split(',')))
    } catch {
      // A preview that cannot be read is not a reason to block the upload.
      setPreview([])
    }
  }

  async function submit() {
    if (!file) return

    setIsUploading(true)
    setError('')

    try {
      const body = new FormData()
      body.append('file', file)

      /*
       * A bare fetch rather than apiClient, because this is multipart: the
       * shared client sets a JSON content type, and letting the browser set
       * the multipart boundary itself is the only way the upload parses.
       * The bearer token is attached by hand for the same reason.
       */
      const response = await fetch(buildApiUrl('/import-users', {
        sub_institute_id: context.subInstituteId,
        ...(context.token ? { type: 'api', token: context.token } : {}),
      }), {
        method: 'POST',
        headers: context.token ? { Authorization: `Bearer ${context.token}` } : {},
        body,
      })

      const result = await response.json().catch(() => null)

      if (!response.ok || String(result?.status ?? result?.status_code) === '0') {
        throw new Error(result?.message || `Import failed (${response.status}).`)
      }

      const created = result?.data?.created ?? result?.created
      const skipped = result?.data?.skipped ?? result?.skipped
      const summary = created !== undefined
        ? `Imported ${created} employee${created === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped` : ''}.`
        : (result?.message || 'Import complete.')

      await onImported(summary)
      reset()
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import employees</DialogTitle>
          <DialogDescription>
            Upload a CSV. The first row must be the column headings. Employees are added to your own
            organisation; credential and permission columns in the file are ignored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center transition-colors hover:bg-muted/40"
          >
            <FileUp className="size-6 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">
              {file ? file.name : 'Choose a CSV file'}
            </span>
            <span className="text-xs text-muted-foreground">
              {file ? `${(file.size / 1024).toFixed(0)} KB` : 'or drag one onto this box'}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void choose(event.target.files?.[0] ?? null)}
            />
          </label>

          {preview.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {preview[0].map((heading, index) => (
                      <th key={index} className="whitespace-nowrap px-2 py-1.5 font-semibold text-foreground">
                        {heading.trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-border">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                          {cell.trim()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
                Showing the first {Math.min(preview.length - 1, MAX_PREVIEW_ROWS)} row(s) as a check on the
                file, not the full import.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!file || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 size-4" /> Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
