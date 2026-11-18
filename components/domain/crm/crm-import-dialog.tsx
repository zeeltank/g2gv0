'use client'

import { useMemo, useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { CrmImportResponse } from '@/types/crm'

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function downloadTemplate(filename: string, headers: readonly string[]) {
  const blob = new Blob(['﻿' + headers.map(csvCell).join(',')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Minimal RFC-4180 CSV reader - same inline parser cm-competency-library.tsx already uses; not worth sharing for a 2nd caller. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
    } else field += char
  }

  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)

  return rows
}

interface Props {
  isOpen: boolean
  onClose: () => void
  noun: string
  /** lowercase CSV header -> camelCase API field name (e.g. {'last name': 'lastName'}). */
  headerMap: Record<string, string>
  /** Human-readable headers for the downloadable blank template, in column order. */
  templateHeaders: readonly string[]
  templateFilename: string
  submitImport: (context: ReturnType<typeof getLaravelContext>, rows: Record<string, unknown>[]) => Promise<CrmImportResponse>
  onImported: () => void
}

/**
 * Shared CSV import wizard, reused by Leads/Contacts/Organizations/
 * Campaigns - a header-alias map and a template header list are the only
 * per-module knowledge needed, same pattern as cm-competency-library.tsx's
 * IMPORT_HEADER_MAP. Unrecognized columns are ignored, not rejected - a
 * user's own export (or a spreadsheet with extra notes columns) should
 * still import cleanly.
 */
export function CrmImportDialog({ isOpen, onClose, noun, headerMap, templateHeaders, templateFilename, submitImport, onImported }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [parseError, setParseError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [response, setResponse] = useState<CrmImportResponse | null>(null)
  const [error, setError] = useState('')

  const reset = () => {
    setFileName(''); setRows([]); setParseError(''); setResponse(null); setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => { reset(); onClose() }

  const handleFile = async (file: File) => {
    setFileName(file.name)
    setResponse(null)
    setError('')

    const text = await file.text()
    const table = parseCsv(text)

    if (table.length < 2) {
      setParseError('The file needs a header row and at least one row of data.')
      setRows([])
      return
    }

    const headers = table[0].map((h) => h.trim().toLowerCase().replace(/^﻿/, ''))
    const keys = headers.map((h) => headerMap[h] ?? null)

    if (!keys.some(Boolean)) {
      setParseError('No recognized columns found. Download the template to see the expected headers.')
      setRows([])
      return
    }

    setParseError('')
    setRows(
      table.slice(1).map((cells) => {
        const row: Record<string, unknown> = {}
        cells.forEach((cell, i) => {
          const key = keys[i]
          if (key && cell.trim() !== '') row[key] = cell.trim()
        })
        return row
      }),
    )
  }

  const handleSubmit = async () => {
    if (!isLaravelContextReady(context) || rows.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      const result = await submitImport(context, rows)
      setResponse(result)
      if (result.data.created > 0) onImported()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to import this file.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Import {noun}s</DialogTitle>
          <DialogDescription>Upload a CSV file, or download the template to see the expected columns.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(templateFilename, templateHeaders)}>
            Download Template
          </Button>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file) }}
            />
            {fileName && !parseError && rows.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">{fileName}: {rows.length} row{rows.length === 1 ? '' : 's'} ready to import.</p>
            )}
          </div>

          {parseError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{parseError}</div>}
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

          {response && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">{response.message}</p>
              {response.data.results.filter((r) => !r.ok).length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {response.data.results.filter((r) => !r.ok).map((r) => (
                    <li key={r.row}>Row {r.row}: {r.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button disabled={rows.length === 0 || submitting} onClick={() => void handleSubmit()}>
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <FileUp className="mr-2 size-4" aria-hidden="true" />}
            Import {rows.length > 0 ? `${rows.length} ` : ''}{noun}{rows.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
