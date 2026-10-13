'use client'

/**
 * THE REPORT BUILDER — module → columns → filters → type/chart → save.
 *
 * Steps are rendered inline (not 5 separate files) since Phase 0 has no
 * registered modules yet to make a deeper split meaningfully testable —
 * revisit once Phase 1/3 give this real content to build against.
 *
 * ── FILTERS: ONE LEVEL, NOT A NESTED GROUP EDITOR ───────────────────────────
 *
 * The backend (ReportQueryExecutionService::applyAdvancedFilter) fully
 * supports an arbitrarily nested AND/OR tree. This UI only ever produces a
 * single flat group — one AND/OR choice, a flat list of conditions — which
 * already covers every real canned report recovered from the actual legacy
 * vtiger source (Docs/reports-engine/PLAN.md's reference table: e.g.
 * "accountid is not null" is one condition). A nested-group editor is real,
 * additional UI complexity with no backend work behind it — flagged as
 * Phase 4 polish, not quietly dropped.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  reportBuilderService,
  type FieldRef,
  type ModuleField,
  type ModuleOption,
  type ReportColumn,
  type ReportDefinition,
  type ReportResult,
  type ReportScope,
  type ReportType,
} from '@/services/reports'
import { ReportViewer } from '../report-viewer'

type FilterRow = FieldRef & { operator: string; value: string }

const STEPS = ['Module', 'Columns', 'Filters', 'Type', 'Save'] as const
type Step = (typeof STEPS)[number]

const OPERATORS = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'is_null', label: 'is empty' },
  { value: 'is_not_null', label: 'is not empty' },
]

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_year', label: 'This year' },
]

const AGGREGATES = ['sum', 'avg', 'min', 'max'] as const

export function ReportBuilderWizard({
  scope,
  reportId,
  defaultFolderId,
  onClose,
  onSaved,
}: {
  scope: ReportScope
  reportId: number | null
  defaultFolderId: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const context = useMemo(() => getLaravelContext(), [])

  const [step, setStep] = useState<Step>('Module')
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [fields, setFields] = useState<ModuleField[]>([])

  const [title, setTitle] = useState('')
  const [reportType, setReportType] = useState<ReportType>('tabular')
  const [primaryModule, setPrimaryModule] = useState('')
  const [columns, setColumns] = useState<ReportColumn[]>([])
  const [filterOp, setFilterOp] = useState<'AND' | 'OR'>('AND')
  const [filterRows, setFilterRows] = useState<FilterRow[]>([])
  const [datePreset, setDatePreset] = useState<string>('')
  const [dateField, setDateField] = useState<string>('')
  const [groupByField, setGroupByField] = useState('')
  const [chartType, setChartType] = useState<'Pie' | 'VerticalBar' | 'HorizontalBar' | 'Line'>('VerticalBar')
  const [sharingtype, setSharingtype] = useState<'Private' | 'Public'>('Private')

  const [preview, setPreview] = useState<ReportResult | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [loadingFields, setLoadingFields] = useState(false);
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    queueMicrotask(async () => {
      try {
        const response = await reportBuilderService.listModules(context, scope)
        setModules(response.data.modules)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load modules.')
      }
    })
  }, [context, scope])

  useEffect(() => {
    if (!isLaravelContextReady(context) || !reportId) return
    queueMicrotask(async () => {
      try {
        const response = await reportBuilderService.getReport(context, reportId)
        const report = response.data
        setTitle(report.title)
        setReportType(report.report_type)
        setPrimaryModule(report.primary_module)
        setSharingtype(report.sharingtype)
        setColumns(report.definition.columns ?? [])
        setFilterOp(report.definition.advanced_filter?.op ?? 'AND')
        setFilterRows(
          (report.definition.advanced_filter?.conditions ?? [])
            .filter((c): c is FilterRow => 'operator' in c)
            .map((c) => ({ module: c.module, field: c.field, operator: c.operator, value: String(c.value ?? '') })),
        )
        setDatePreset(report.definition.standard_filter?.preset ?? '')
        setDateField(report.definition.standard_filter?.field ?? '')
        setGroupByField(report.definition.group_by?.[0]?.field ?? report.definition.chart?.group_by.field ?? '')
        setChartType(report.definition.chart?.type ?? 'VerticalBar')
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load this report.')
      }
    })
  }, [context, reportId])

  const loadFields = useCallback(async (moduleKey: string) => {
    if (!moduleKey) return
    setLoadingFields(true)
    try {
      const response = await reportBuilderService.listFields(context, moduleKey)
      setFields(response.data.fields)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load fields.')
    } finally {
      setLoadingFields(false)
    }
  }, [context])

  useEffect(() => {
    if (!primaryModule) return
    queueMicrotask(() => {
      void loadFields(primaryModule)
    })
  }, [primaryModule, loadFields])

  const definition: ReportDefinition = useMemo(() => {
    const def: ReportDefinition = { columns }

    if (filterRows.length > 0) {
      def.advanced_filter = {
        op: filterOp,
        conditions: filterRows.map((r) => ({ module: r.module, field: r.field, operator: r.operator, value: r.value })),
      }
    }

    if (datePreset && dateField) {
      def.standard_filter = { module: primaryModule, field: dateField, preset: datePreset }
    }

    if (reportType === 'summary' && groupByField) {
      def.group_by = [{ module: primaryModule, field: groupByField }]
    }

    if (reportType === 'chart' && groupByField) {
      def.chart = {
        type: chartType,
        group_by: { module: primaryModule, field: groupByField },
        data_fields: columns.filter((c) => c.aggregate).slice(0, 3).map((c) => ({ module: c.module, field: c.field, aggregate: c.aggregate as string, label: c.label })),
      }
    }

    return def
  }, [columns, filterOp, filterRows, datePreset, dateField, primaryModule, reportType, groupByField, chartType])

  async function runPreview() {
    setPreviewError('')
    setPreview(null)

    try {
      const response = await reportBuilderService.preview(context, scope, reportType, primaryModule, definition)
      setPreview(response.data)
    } catch (reason) {
      setPreviewError(reason instanceof Error ? reason.message : 'This report could not be run.')
    }
  }

  async function save() {
    setSaving(true)
    setError('')

    const payload = {
      scope,
      folder_id: defaultFolderId,
      report_type: reportType,
      primary_module: primaryModule,
      title: title.trim(),
      sharingtype,
      definition,
    }

    try {
      if (reportId) {
        await reportBuilderService.updateReport(context, reportId, payload)
      } else {
        await reportBuilderService.createReport(context, payload)
      }

      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This report could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const groupableFields = fields.filter((f) => f.groupable)
  const dateFields = fields.filter((f) => f.type === 'date')
  const stepIndex = STEPS.indexOf(step)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex h-[88vh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{reportId ? 'Edit Report' : 'New Report'}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border pb-3">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              disabled={i > 0 && !primaryModule}
              className={`rounded-full px-3 py-1 text-xs font-medium ${step === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} disabled:opacity-40`}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'Module' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Module</Label>
                <SearchableSelect
                  value={primaryModule}
                  onChange={setPrimaryModule}
                  options={modules.map((m) => ({ value: m.key, label: m.label }))}
                  placeholder={modules.length ? 'Choose a module…' : 'No modules registered yet'}
                  disabled={modules.length === 0}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Report type</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(['tabular', 'summary', 'pivot', 'chart'] as ReportType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setReportType(t)}
                      className={`rounded-lg border p-3 text-sm capitalize ${reportType === t ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-surface-muted'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'Columns' && (
            <div className="space-y-2">
              {loadingFields && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />}
              {!loadingFields && fields.length === 0 && <p className="text-sm text-muted-foreground">No fields available for this module yet.</p>}

              {!loadingFields && fields.length > 0 && (
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={columns.length === fields.length}
                      ref={(el) => {
                        if (el) el.indeterminate = columns.length > 0 && columns.length < fields.length
                      }}
                      onChange={(e) => {
                        setColumns(
                          e.target.checked
                            ? fields.map((f) => ({ module: primaryModule, field: f.key, label: f.label, visible: true }))
                            : [],
                        )
                      }}
                    />
                    Select all
                  </span>
                  <span className="text-xs text-muted-foreground">{columns.length} of {fields.length} selected</span>
                </label>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {fields.map((field) => {
                  const col = columns.find((c) => c.field === field.key)

                  return (
                    <label key={field.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                      <span className="flex items-center gap-2 truncate text-sm">
                        <input
                          type="checkbox"
                          checked={!!col}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setColumns((cur) => [...cur, { module: primaryModule, field: field.key, label: field.label, visible: true }])
                            } else {
                              setColumns((cur) => cur.filter((c) => c.field !== field.key))
                            }
                          }}
                        />
                        <span className="truncate">{field.label}</span>
                      </span>
                      {col && field.aggregatable && (reportType === 'summary' || reportType === 'chart') && (
                        <select
                          value={col.aggregate ?? ''}
                          onChange={(e) => setColumns((cur) => cur.map((c) => (c.field === field.key ? { ...c, aggregate: (e.target.value || null) as ReportColumn['aggregate'] } : c)))}
                          className="shrink-0 rounded border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="">no aggregate</option>
                          {AGGREGATES.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'Filters' && (
            <div className="space-y-4">
              {dateFields.length > 0 && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
                  <div className="space-y-1.5">
                    <Label>Date field</Label>
                    <SearchableSelect value={dateField} onChange={setDateField} options={dateFields.map((f) => ({ value: f.key, label: f.label }))} placeholder="None" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date range</Label>
                    <SearchableSelect value={datePreset} onChange={setDatePreset} options={DATE_PRESETS} placeholder="Any time" />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Label>Match</Label>
                <select value={filterOp} onChange={(e) => setFilterOp(e.target.value as 'AND' | 'OR')} className="rounded border border-border bg-background px-2 py-1 text-sm">
                  <option value="AND">all</option>
                  <option value="OR">any</option>
                </select>
                <span className="text-sm text-muted-foreground">of these conditions</span>
              </div>

              {filterRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <SearchableSelect
                    value={row.field}
                    onChange={(v) => setFilterRows((cur) => cur.map((r, j) => (j === i ? { ...r, field: v } : r)))}
                    options={fields.map((f) => ({ value: f.key, label: f.label }))}
                    className="flex-1"
                  />
                  <select
                    value={row.operator}
                    onChange={(e) => setFilterRows((cur) => cur.map((r, j) => (j === i ? { ...r, operator: e.target.value } : r)))}
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {!['is_null', 'is_not_null'].includes(row.operator) && (
                    <Input
                      value={row.value}
                      onChange={(e) => setFilterRows((cur) => cur.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                      className="flex-1"
                    />
                  )}
                  <button type="button" onClick={() => setFilterRows((cur) => cur.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterRows((cur) => [...cur, { module: primaryModule, field: fields[0]?.key ?? '', operator: 'equals', value: '' }])}
                disabled={fields.length === 0}
              >
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Add condition
              </Button>
            </div>
          )}

          {step === 'Type' && (
            <div className="space-y-4">
              {(reportType === 'summary' || reportType === 'chart') && (
                <div className="space-y-1.5">
                  <Label>Group by</Label>
                  <SearchableSelect value={groupByField} onChange={setGroupByField} options={groupableFields.map((f) => ({ value: f.key, label: f.label }))} />
                </div>
              )}
              {reportType === 'chart' && (
                <div className="space-y-1.5">
                  <Label>Chart type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Pie', 'VerticalBar', 'HorizontalBar', 'Line'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setChartType(t)}
                        className={`rounded-lg border p-2 text-sm ${chartType === t ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Up to 3 data fields, chosen from the aggregates set in Columns.</p>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => void runPreview()}>Run preview</Button>

              {previewError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" aria-hidden="true" />
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}

              {preview && <ReportViewer reportType={reportType} result={preview} definition={definition} />}
            </div>
          )}

          {step === 'Save' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="report-title">Title</Label>
                <Input id="report-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Sharing</Label>
                <select value={sharingtype} onChange={(e) => setSharingtype(e.target.value as 'Private' | 'Public')} className="rounded border border-border bg-background px-2 py-1.5 text-sm">
                  <option value="Private">Private (only me, unless I share it)</option>
                  <option value="Public">Public (everyone in this organisation)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between border-t border-border pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            {stepIndex > 0 && <Button variant="outline" onClick={() => setStep(STEPS[stepIndex - 1])}>Back</Button>}
            {stepIndex < STEPS.length - 1 ? (
              <Button onClick={() => setStep(STEPS[stepIndex + 1])} disabled={!primaryModule}>Next</Button>
            ) : (
              <Button onClick={() => void save()} disabled={saving || !title.trim()}>
                {saving ? 'Saving…' : 'Save & Run'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
