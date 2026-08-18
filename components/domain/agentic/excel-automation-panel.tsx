'use client'

/**
 * Launch screen for the Social Media Content Automation (Excel) agent.
 *
 * A generic form cannot express this one: the file has to be checked against
 * the connected Google Sheet's template before anything is written, and a
 * mismatched column is the failure people actually hit.
 *
 * So it is a two-step flow — Check file, then Upload. The check is a real
 * server-side dry run (`validate_only`) that parses the workbook, compares
 * headers against the template and reports what would be written, without
 * touching the customer's sheet. That also keeps a spreadsheet parser out of
 * the browser bundle.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileSpreadsheet,
  Link2,
  Loader2,
  PlugZap,
  Trash2,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { useLaravelContext } from '@/hooks/use-agentic'
import { excelAgentService } from '@/services/agentic'
import type {
  Agent,
  ExcelConnectionTest,
  ExcelCredentialStatus,
  ExcelUploadResult,
} from '@/services/agentic'

interface ExcelAutomationPanelProps {
  agent: Agent
  onRefresh: () => void
}

/** Columns the agent's template uses when the sheet has not reported its own. */
const FALLBACK_COLUMNS = [
  'Platform',
  'Topic',
  'Full Post Copy',
  'Image Brief',
  'Post Date',
  'Status',
  'Image/Video',
  'Formate',
]

export function ExcelAutomationPanel({ agent, onRefresh }: ExcelAutomationPanelProps) {
  const resolveContext = useLaravelContext()

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState<'check' | 'upload' | null>(null)
  const [checked, setChecked] = useState<ExcelUploadResult | null>(null)
  const [uploaded, setUploaded] = useState<ExcelUploadResult | null>(null)
  const [templateColumns, setTemplateColumns] = useState<string[]>(FALLBACK_COLUMNS)
  const [connection, setConnection] = useState<ExcelCredentialStatus | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ExcelConnectionTest | null>(null)

  // The connected sheet decides the template, so read it rather than assuming.
  const loadTemplate = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    try {
      const payload = await excelAgentService.credentials(context)
      setConnection(payload)

      const columns = payload?.template?.columns

      if (Array.isArray(columns) && columns.length > 0) {
        setTemplateColumns(columns.map(String))
      }
    } catch {
      // Falling back to the documented columns is better than blocking the
      // screen because a template lookup failed.
    }
  }, [resolveContext])

  useEffect(() => {
    // Deferred so the lookup's setState lands after this render rather than
    // cascading out of the effect body.
    queueMicrotask(() => {
      loadTemplate()
    })
  }, [loadTemplate])

  const pick = (selected: File | null) => {
    setFile(selected)
    setChecked(null)
    setUploaded(null)
  }

  const send = async (validateOnly: boolean) => {
    const context = resolveContext()
    if (!isLaravelContextReady(context) || !file) return

    setBusy(validateOnly ? 'check' : 'upload')
    if (validateOnly) setUploaded(null)

    try {
      const payload = await excelAgentService.upload(context, file, validateOnly)

      if (validateOnly) {
        setChecked(payload)
      } else {
        setUploaded(payload)
        if (payload.status) {
          setChecked(null)
          setFile(null)
          onRefresh()
        }
      }
    } catch (error) {
      // A header mismatch comes back as a 422, which apiClient throws, so the
      // message carries the detail the user needs.
      const failure: ExcelUploadResult = {
        status: false,
        message: error instanceof Error ? error.message : 'Could not reach the server.',
      }

      if (validateOnly) setChecked(failure)
      else setUploaded(failure)
    } finally {
      setBusy(null)
    }
  }

  /**
   * The blank workbook is built server-side from this organisation's own
   * template headers. Generating a CSV here instead would hand the user a file
   * the .xlsx-only upload then rejects.
   */
  const downloadTemplate = () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    // An anchor click, not a location assignment: this is a cross-origin file
    // download from the API, and the page should stay where it is. The server
    // sends Content-Disposition, so the filename comes from there.
    const link = document.createElement('a')
    link.href = excelAgentService.templateUrl(context)
    link.rel = 'noopener'
    link.click()
  }

  const testConnection = async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    setTesting(true)
    setTestResult(null)

    try {
      setTestResult(await excelAgentService.testConnection(context))
    } catch (error) {
      setTestResult({
        status: false,
        message: error instanceof Error ? error.message : 'Could not reach the sheet.',
      })
    } finally {
      setTesting(false)
    }
  }

  const outcome = uploaded ?? checked

  const sheetId = connection?.google_credential?.google_sheet_id

  return (
    <div className="space-y-4">
      {/* Which sheet this writes to. Without it the upload is a leap of faith. */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Connected sheet</p>
              {sheetId ? (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-xs text-primary underline-offset-2 hover:underline"
                >
                  {sheetId}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">Not connected yet.</p>
              )}
              {connection?.template?.name && (
                <p className="mt-0.5 text-xs text-muted-foreground">Template: {connection.template.name}</p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={testConnection}
            disabled={testing || !sheetId}
            className="h-8 gap-1.5 rounded-lg text-xs font-semibold"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
            Test connection
          </Button>
        </div>

        {testResult && (
          <p
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
              testResult.status
                ? 'border-border bg-background text-foreground'
                : 'border-destructive/30 bg-destructive/5 text-destructive',
            )}
          >
            {testResult.status ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {testResult.message}
              {testResult.sheet_title && ` · tab "${testResult.sheet_title}"`}
              {testResult.error && ` — ${testResult.error}`}
            </span>
          </p>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Upload content plan</p>
          <p className="text-xs text-muted-foreground">
            Rows are appended to your connected Google Sheet. Column headers must match its template exactly.
          </p>
        </div>

        <Button variant="outline" onClick={downloadTemplate} className="h-8 gap-1.5 rounded-lg text-xs font-semibold">
          <Download className="h-3.5 w-3.5" /> Template
        </Button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const dropped = event.dataTransfer.files?.[0]
          if (dropped?.name.toLowerCase().endsWith('.xlsx')) pick(dropped)
        }}
        className={cn(
          'rounded-xl border-2 border-dashed transition-colors',
          dragging ? 'border-primary bg-primary/5' : file ? 'border-border bg-muted/20' : 'border-border',
        )}
      >
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          {file ? (
            <>
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <span className="text-sm font-semibold text-foreground">{file.name}</span>
              <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
            </>
          ) : (
            <>
              <CloudUpload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Drop your .xlsx here, or click to browse</span>
              <span className="text-xs text-muted-foreground">Excel workbooks only, up to 10 MB</span>
            </>
          )}

          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {file && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => send(true)}
            disabled={busy !== null}
            className="h-9 gap-2 rounded-lg font-semibold"
          >
            {busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Check file
          </Button>

          <Button
            onClick={() => send(false)}
            // Deliberately allowed without a check: the server validates again
            // before writing, so the check is a convenience, not a gate.
            disabled={busy !== null}
            className="h-9 flex-1 gap-2 rounded-lg font-bold"
          >
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
            {busy === 'upload' ? 'Uploading…' : 'Upload to Google Sheet'}
          </Button>

          <Button
            variant="outline"
            onClick={() => pick(null)}
            disabled={busy !== null}
            aria-label="Remove file"
            className="h-9 gap-2 rounded-lg font-semibold"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {outcome && <Outcome result={outcome} />}

      {/* Required format */}
      <div className="rounded-xl border border-border bg-muted/20 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> Required columns
        </p>
        <div className="flex flex-wrap gap-1.5">
          {templateColumns.map((column) => (
            <span
              key={column}
              className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {column}
            </span>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}

function Outcome({ result }: { result: ExcelUploadResult }) {
  const dryRun = Boolean(result.validated_only)

  return (
    <div
      className={cn(
        'space-y-3 rounded-lg border p-3',
        result.status ? 'border-border bg-muted/30' : 'border-destructive/30 bg-destructive/5',
      )}
    >
      <div className="flex items-start gap-2.5">
        {result.status ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}

        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', result.status ? 'text-foreground' : 'text-destructive')}>
            {result.message}
          </p>

          {result.status && (
            <p className="text-xs text-muted-foreground">
              {dryRun
                ? `${result.rows_ready ?? 0} rows ready. Nothing written yet.`
                : `${result.rows_uploaded ?? 0} rows appended`}
              {result.written_range ? ` · range ${result.written_range}` : ''}
              {result.skipped_empty_rows ? ` · ${result.skipped_empty_rows} empty rows skipped` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Header comparison — the failure people actually hit. */}
      {result.expected_headers && result.received_headers && (
        <HeaderComparison expected={result.expected_headers} received={result.received_headers} />
      )}

      {/* Headers matched but data did not: the server names the exact cell. */}
      {result.errors && result.errors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-destructive">
            {result.errors.length} cell {result.errors.length === 1 ? 'problem' : 'problems'}
          </p>
          <div className="overflow-hidden rounded-lg border border-destructive/30">
            <table className="min-w-full text-[11px]">
              <thead className="bg-destructive/5">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-bold text-muted-foreground">Row</th>
                  <th className="px-2.5 py-1.5 text-left font-bold text-muted-foreground">Column</th>
                  <th className="px-2.5 py-1.5 text-left font-bold text-muted-foreground">Problem</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.slice(0, 25).map((issue, index) => (
                  <tr key={index} className="border-t border-destructive/20">
                    <td className="px-2.5 py-1.5 tabular-nums text-foreground">{issue.row}</td>
                    <td className="px-2.5 py-1.5 text-foreground">{issue.column}</td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.errors.length > 25 && (
            <p className="text-xs text-muted-foreground">…and {result.errors.length - 25} more.</p>
          )}
        </div>
      )}

      {result.extra_headers && result.extra_headers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Extra columns ignored: {result.extra_headers.join(', ')}
        </p>
      )}

      {result.preview_rows && result.preview_rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-[11px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-bold text-muted-foreground">#</th>
                {(result.expected_headers ?? []).map((header) => (
                  <th key={header} className="px-2.5 py-1.5 text-left font-bold text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.preview_rows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  <td className="px-2.5 py-1.5 text-muted-foreground">{index + 1}</td>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="max-w-[140px] truncate px-2.5 py-1.5 text-foreground"
                      title={String(cell ?? '')}
                    >
                      {String(cell ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function HeaderComparison({ expected, received }: { expected: string[]; received: string[] }) {
  const normalise = (value: string) => value.toLowerCase().trim()
  const wanted = expected.map(normalise)
  const matched = received.filter((header) => wanted.includes(normalise(header))).length

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Detected headers — {matched}/{expected.length} match
      </p>
      <div className="flex flex-wrap gap-1.5">
        {received.map((header, index) => {
          const ok = wanted.includes(normalise(header))

          return (
            <span
              key={`${header}-${index}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium',
                ok
                  ? 'border-border bg-background text-foreground'
                  : 'border-destructive/40 bg-destructive/5 text-destructive',
              )}
            >
              {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {header || '(blank)'}
            </span>
          )
        })}
      </div>
    </div>
  )
}
