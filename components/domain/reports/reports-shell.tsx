'use client'

/**
 * THE REPORTS SHELL — folder sidebar + report list + "New Report", for one
 * module_scope. Mirrors vtiger's own Reports screen shape (a folder tree on
 * the left, that folder's reports on the right) with "All Reports" and
 * "Shared With Me" as two fixed, always-present entries above the real
 * folders — both computed views, never real folder rows (see
 * Docs/reports-engine/PLAN.md §2/§4).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, FolderPlus, Plus, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import {
  reportBuilderService,
  type ReportFolder,
  type ReportScope,
  type ReportSummary,
  type ReportView,
} from '@/services/reports'
import { ReportBuilderWizard } from './builder/report-builder-wizard'
import { ReportViewPage } from './report-view-page'

type Selection = { view: ReportView; folderId?: number }

export function ReportsShell({ scope, title, description }: { scope: ReportScope; title: string; description: string }) {
  const context = useMemo(() => getLaravelContext(), [])

  const [folders, setFolders] = useState<ReportFolder[]>([])
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [selection, setSelection] = useState<Selection>({ view: 'all' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<ReportFolder | null>(null)

  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingReportId, setEditingReportId] = useState<number | null>(null)
  const [viewingReportId, setViewingReportId] = useState<number | null>(null)
  // Bumped whenever the builder saves changes to the report currently being
  // viewed — passed as ReportViewPage's `key` so it remounts and re-fetches
  // rather than silently showing the pre-edit definition/result.
  const [viewReloadKey, setViewReloadKey] = useState(0)

  const loadFolders = useCallback(async () => {
    if (!isLaravelContextReady(context)) return
    try {
      const response = await reportBuilderService.listFolders(context, scope)
      setFolders(response.data.folders)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load folders.')
    }
  }, [context, scope])

  const loadReports = useCallback(async () => {
    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await reportBuilderService.listReports(context, scope, selection.view, selection.folderId)
      setReports(response.data.reports)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load reports.')
    } finally {
      setLoading(false)
    }
  }, [context, scope, selection])

  useEffect(() => {
    queueMicrotask(() => {
      void loadFolders()
    })
  }, [loadFolders])

  useEffect(() => {
    queueMicrotask(() => {
      void loadReports()
    })
  }, [loadReports])

  async function createFolder() {
    if (!newFolderName.trim()) return

    try {
      await reportBuilderService.createFolder(context, scope, newFolderName.trim())
      setNewFolderOpen(false)
      setNewFolderName('')
      await loadFolders()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That folder could not be created.')
    }
  }

  async function confirmDeleteFolder() {
    if (!deleteFolderTarget) return

    try {
      await reportBuilderService.deleteFolder(context, deleteFolderTarget.id)
      setDeleteFolderTarget(null)

      if (selection.folderId === deleteFolderTarget.id) {
        setSelection({ view: 'all' })
      }

      await loadFolders()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That folder could not be removed.')
    }
  }

  async function deleteReport(report: ReportSummary) {
    try {
      await reportBuilderService.deleteReport(context, report.id)
      await loadReports()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That report could not be removed.')
    }
  }

  const isNavActive = (candidate: Selection) =>
    candidate.view === selection.view && candidate.folderId === selection.folderId

  if (viewingReportId !== null) {
    return (
      <>
        <ReportViewPage
          key={viewReloadKey}
          reportId={viewingReportId}
          scope={scope}
          onBack={() => setViewingReportId(null)}
          onEdit={() => { setEditingReportId(viewingReportId); setBuilderOpen(true) }}
          onDeleted={() => { setViewingReportId(null); void loadReports() }}
        />
        {builderOpen && (
          <ReportBuilderWizard
            scope={scope}
            reportId={editingReportId}
            defaultFolderId={selection.view === 'folder' ? selection.folderId ?? null : null}
            onClose={() => setBuilderOpen(false)}
            onSaved={() => { setBuilderOpen(false); setViewReloadKey((k) => k + 1) }}
          />
        )}
      </>
    )
  }

  return (
    <div className="flex h-full gap-6 p-4 sm:p-6">
      <aside className="w-64 shrink-0 space-y-1">
        <h1 className="mb-3 text-lg font-semibold text-foreground">{title}</h1>

        <NavItem label="All Reports" active={isNavActive({ view: 'all' })} onClick={() => setSelection({ view: 'all' })} />
        <NavItem label="Shared With Me" active={isNavActive({ view: 'shared' })} onClick={() => setSelection({ view: 'shared' })} />

        <div className="mt-4 mb-1 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folders</span>
          <button
            type="button"
            onClick={() => setNewFolderOpen(true)}
            aria-label="New folder"
            title="New folder"
            className="rounded p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <FolderPlus className="size-4" aria-hidden="true" />
          </button>
        </div>

        {folders.map((folder) => (
          <div key={folder.id} className="group flex items-center">
            <NavItem
              label={folder.name}
              active={isNavActive({ view: 'folder', folderId: folder.id })}
              onClick={() => setSelection({ view: 'folder', folderId: folder.id })}
              className="flex-1"
            />
            {!folder.is_system && (
              <button
                type="button"
                onClick={() => setDeleteFolderTarget(folder)}
                aria-label={`Delete ${folder.name}`}
                className="invisible rounded p-1 text-muted-foreground hover:text-destructive group-hover:visible"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}

        {newFolderOpen && (
          <div className="mt-2 flex items-center gap-1 px-2">
            <Input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void createFolder()}
              placeholder="Folder name"
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-8" onClick={() => void createFolder()}>Add</Button>
          </div>
        )}
      </aside>

      <section className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button onClick={() => { setEditingReportId(null); setBuilderOpen(true) }}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            New Report
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sharing</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Loading reports…</TableCell></TableRow>
              )}
              {!loading && reports.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-14 text-center">
                  <BarChart3 className="mx-auto mb-2 size-8 text-muted-foreground/50" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">No reports here yet. Click &ldquo;New Report&rdquo; to build one.</p>
                </TableCell></TableRow>
              )}
              {!loading && reports.map((report) => (
                <TableRow
                  key={report.id}
                  className="cursor-pointer"
                  onClick={() => setViewingReportId(report.id)}
                >
                  <TableCell className="font-medium text-foreground">{report.title}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{report.report_type}</TableCell>
                  <TableCell>
                    <Badge variant={report.sharingtype === 'Public' ? 'outline' : 'muted'}>{report.sharingtype}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{report.last_run_at ?? 'Never run'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Delete ${report.title}`}
                        title="Delete"
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void deleteReport(report)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {builderOpen && (
        <ReportBuilderWizard
          scope={scope}
          reportId={editingReportId}
          defaultFolderId={selection.view === 'folder' ? selection.folderId ?? null : null}
          onClose={() => setBuilderOpen(false)}
          onSaved={() => { setBuilderOpen(false); void loadReports() }}
        />
      )}

      <ConfirmDialog
        open={deleteFolderTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteFolderTarget(null) }}
        title="Remove this folder?"
        description={deleteFolderTarget ? `"${deleteFolderTarget.name}" will be removed. Its reports must be moved or deleted first.` : ''}
        confirmLabel="Remove"
        onConfirm={() => void confirmDeleteFolder()}
      />
    </div>
  )
}

function NavItem({ label, active, onClick, className }: { label: string; active: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-surface-muted',
        className,
      )}
    >
      {label}
    </button>
  )
}
