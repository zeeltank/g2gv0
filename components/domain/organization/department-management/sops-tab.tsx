'use client'

import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  ScrollText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SelectInput } from '../components'
import { cn } from '@/lib/utils'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'
import { useDepartmentContent } from './use-department-content'

export interface Sop {
  id: string
  title: string
  version: string
  type: string
  status: string
  uploadedBy: string
  uploadedOn: string
  /** Whether a document is actually attached, so Download can be disabled. */
  hasFile?: boolean
}

export interface ActivityEvent {
  id: string
  icon: ReactNode
  text: string
  user: string
  date: string
}

export function sopStatusClass(status: string) {
  switch (status) {
    case 'Active':
      return 'bg-success/15 text-success'
    case 'Draft':
      return 'bg-warning/15 text-warning'
    case 'Archived':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

/*
 * Three fixtures lived here and are gone:
 *
 *   MOCK_SOPS        - five hardcoded SOPs shown for every department.
 *   SOP_SUMMARY      - eight hardcoded stat cards (Total Tasks 48, Employees
 *                      86, ...) that were exported and never rendered by
 *                      anything, so they described nothing at all.
 *   RECENT_ACTIVITY  - a four-entry activity feed that WAS rendered, and was
 *                      identical under every department in every tenant.
 *
 * SOPs now load per department from /api/department-sops.
 */
function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
    </button>
  )
}

function UploadSopForm({
  department,
  onSubmit,
  onCancel,
}: {
  department: Department
  /**
   * The second argument is the real File.
   *
   * This form previously kept only `event.target.files[0].name` - a string -
   * and threw the File itself away, which is part of why "Download" had
   * nothing to serve and had to fabricate a text blob instead.
   */
  onSubmit: (sop: Sop, file: File | null) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [version, setVersion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('Active')

  const fileName = file?.name ?? ''

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    onSubmit(
      {
        id: `sop-${Date.now()}`,
        title: title.trim(),
        version: version.trim() || 'v1.0',
        type: fileName ? (fileName.split('.').pop() ?? 'FILE').toUpperCase() : 'PDF',
        status,
        uploadedBy: 'You',
        uploadedOn: today,
      },
      file,
    )
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Upload SOP</h3>
        <Button variant="ghost" size="icon-sm" onClick={onCancel}>
          <X className="size-4" />
          <span className="sr-only">Cancel upload</span>
        </Button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="sop-title" className="text-sm font-medium text-foreground">
            Document Title
          </label>
          <Input
            id="sop-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Employee Onboarding Workflow"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sop-version" className="text-sm font-medium text-foreground">
            Version
          </label>
          <Input
            id="sop-version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="e.g. v1.0"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sop-file" className="text-sm font-medium text-foreground">
            Upload File
          </label>
          <label
            htmlFor="sop-file"
            className="flex h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <span className="truncate">{fileName || 'Choose a file...'}</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <Upload className="size-4" />
            </span>
            <input
              id="sop-file"
              type="file"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sop-status" className="text-sm font-medium text-foreground">
            Status
          </label>
          <SelectInput
            id="sop-status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Draft', label: 'Draft' },
              { value: 'Archived', label: 'Archived' },
            ]}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            <Upload className="size-4" aria-hidden="true" />
            Upload SOP
          </Button>
        </div>
      </form>
    </div>
  )
}

function EditSopForm({
  sop,
  onSubmit,
  onCancel,
}: {
  sop: Sop
  onSubmit: (sop: Sop) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(sop.title)
  const [version, setVersion] = useState(sop.version)
  const [status, setStatus] = useState(sop.status)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit({
      ...sop,
      title: title.trim(),
      version: version.trim() || 'v1.0',
      status,
    })
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Edit SOP</h3>
        <Button variant="ghost" size="icon-sm" onClick={onCancel}>
          <X className="size-4" />
          <span className="sr-only">Cancel edit</span>
        </Button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="edit-sop-title" className="text-sm font-medium text-foreground">
            Document Title
          </label>
          <Input
            id="edit-sop-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Employee Onboarding Workflow"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="edit-sop-version" className="text-sm font-medium text-foreground">
            Version
          </label>
          <Input
            id="edit-sop-version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="e.g. v1.0"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="edit-sop-status" className="text-sm font-medium text-foreground">
            Status
          </label>
          <SelectInput
            id="edit-sop-status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Draft', label: 'Draft' },
              { value: 'Archived', label: 'Archived' },
            ]}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            <Pencil className="size-4" aria-hidden="true" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}

function DeleteConfirmDialog({
  sop,
  onConfirm,
  onCancel,
}: {
  sop: Sop
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={!!sop} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete SOP</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{sop.title}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ViewAllDialog({
  sops,
  onClose,
  onEdit,
  onDelete,
  onDownload,
}: {
  sops: Sop[]
  onClose: () => void
  onEdit: (sop: Sop) => void
  onDelete: (sop: Sop) => void
  onDownload: (sop: Sop) => void
}) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>All Standard Operating Procedures</DialogTitle>
          <DialogDescription>
            Browse and manage all SOPs for this department.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Uploaded On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sops.map((sop) => (
                <TableRow key={sop.id}>
                  <TableCell className="font-medium">{sop.title}</TableCell>
                  <TableCell>{sop.version}</TableCell>
                  <TableCell>{sop.type}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                        sopStatusClass(sop.status),
                      )}
                    >
                      {sop.status}
                    </span>
                  </TableCell>
                  <TableCell>{sop.uploadedBy}</TableCell>
                  <TableCell>{sop.uploadedOn}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label={`View ${sop.title}`}
                        icon={<FileText className="size-4" />}
                        onClick={() => onDownload(sop)}
                      />
                      <IconButton
                        label={`Edit ${sop.title}`}
                        icon={<Pencil className="size-4" />}
                        onClick={() => onEdit(sop)}
                      />
                      <IconButton
                        label={`Delete ${sop.title}`}
                        icon={<Trash2 className="size-4" />}
                        onClick={() => onDelete(sop)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sops.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                    No SOPs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SopsTab({
  department,
  context,
  canManage,
}: {
  department: Department
  context: LaravelContext
  canManage: boolean
}) {
  const loader = useCallback(
    (departmentId: string) => organizationService.getDepartmentSops(context, departmentId),
    [context],
  )
  const { items, isLoading, error, reload, setError } = useDepartmentContent(department.id, loader)

  /**
   * The tab's own view-model, derived from the API records.
   *
   * `uploadedBy` was the literal string 'You' on everything this UI created,
   * and 'Priya Nair' / 'Sanjay Kapoor' on the fixtures. It is now whoever
   * actually last touched the record, resolved server-side.
   */
  const sops: Sop[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        title: item.name,
        version: item.version || 'v1.0',
        type: item.fileName ? (item.fileName.split('.').pop() ?? 'FILE').toUpperCase() : '—',
        status: item.status,
        uploadedBy: item.updatedBy,
        uploadedOn: item.lastUpdated,
        hasFile: item.hasFile,
      })),
    [items],
  )

  const recentlyUpdated = useMemo(() => sops.slice(0, 4), [sops])

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editingSop, setEditingSop] = useState<Sop | null>(null)
  const [deletingSop, setDeletingSop] = useState<Sop | null>(null)
  const [viewAllOpen, setViewAllOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({})

  async function persist(action: () => Promise<unknown>, failureMessage: string) {
    setIsSaving(true)
    setError('')
    try {
      await action()
      await reload()
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failureMessage)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!openMenu) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRefs.current[openMenu]?.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenu])

  /**
   * Download the actual stored document.
   *
   * This used to assemble a text blob whose body was the literal sentence
   * "This is a mock SOP document." and hand that to the user as their file -
   * named .txt regardless of what had supposedly been uploaded. View and
   * Download were both wired to it, so neither did what its label said.
   */
  const handleDownload = (sop: Sop) => {
    if (typeof window === 'undefined') return

    if (!sop.hasFile) {
      setError(`"${sop.title}" has no document attached.`)
      return
    }

    window.location.href = organizationService.departmentSopDownloadUrl(context, sop.id)
  }

  /** Open the document in a new tab instead of saving it. */
  const handleView = (sop: Sop) => {
    if (typeof window === 'undefined') return

    if (!sop.hasFile) {
      setError(`"${sop.title}" has no document attached.`)
      return
    }

    window.open(organizationService.departmentSopDownloadUrl(context, sop.id), '_blank', 'noopener')
  }

  const handleEdit = (sop: Sop) => {
    setEditingSop(sop)
    setOpenMenu(null)
  }

  const handleDelete = (sop: Sop) => {
    setDeletingSop(sop)
    setOpenMenu(null)
  }

  const confirmDelete = async () => {
    if (!deletingSop) return
    const target = deletingSop
    setDeletingSop(null)
    await persist(
      () => organizationService.deleteDepartmentSop(context, target.id),
      'Failed to delete SOP.',
    )
  }

  if (uploadOpen) {
    return (
      <UploadSopForm
        department={department}
        onCancel={() => setUploadOpen(false)}
        onSubmit={async (sop, file) => {
          const ok = await persist(
            () => organizationService.saveDepartmentSop(context, {
              department_id: String(department.id),
              title: sop.title,
              version: sop.version,
              status: sop.status,
              ...(file ? { document: file } : {}),
            }),
            'Failed to upload SOP.',
          )
          if (ok) setUploadOpen(false)
        }}
      />
    )
  }

  if (editingSop) {
    return (
      <EditSopForm
        sop={editingSop}
        onCancel={() => setEditingSop(null)}
        onSubmit={async (updated) => {
          const ok = await persist(
            () => organizationService.saveDepartmentSop(
              context,
              {
                department_id: String(department.id),
                title: updated.title,
                version: updated.version,
                status: updated.status,
              },
              updated.id,
            ),
            'Failed to update SOP.',
          )
          if (ok) setEditingSop(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          Standard Operating Procedures ({sops.length})
        </h3>
        {canManage && (
          <Button size="sm" className="h-9" onClick={() => setUploadOpen(true)} disabled={isSaving}>
            <Plus className="size-4" aria-hidden="true" />
            Upload SOP
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading SOPs...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!isLoading && !error && sops.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No SOPs have been uploaded for {department.name} yet.
        </p>
      )}

      <div className="space-y-2">
        {sops.map((sop) => (
          <div
            key={sop.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{sop.title}</p>
                <Badge variant="muted" className="shrink-0 rounded-md px-2 text-xs">
                  {sop.version}
                </Badge>
                <span
                  className={cn(
                    'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                    sopStatusClass(sop.status),
                  )}
                >
                  {sop.status}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {sop.type} <span className="mx-1">·</span> Uploaded by {sop.uploadedBy}{' '}
                <span className="mx-1">·</span> {sop.uploadedOn}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* View opens the document; Download saves it. Both used to
                  call the same handler, which fabricated a text file. */}
              <IconButton label={`View ${sop.title}`} icon={<FileText className="size-4" />} onClick={() => handleView(sop)} />
              <IconButton label={`Download ${sop.title}`} icon={<Download className="size-4" />} onClick={() => handleDownload(sop)} />
              <div
                ref={(el) => {
                  menuRefs.current[sop.id] = el
                }}
                className="relative"
              >
                <IconButton
                  label={`More options for ${sop.title}`}
                  icon={<MoreVertical className="size-4" />}
                  onClick={() => setOpenMenu((current) => (current === sop.id ? null : sop.id))}
                />
                {openMenu === sop.id && (
                  <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      onClick={() => handleEdit(sop)}
                    >
                      Edit details
                    </button>
                    {/*
                      * "Move to folder" was a <button> with no onClick, and
                      * SOPs have no folder concept in the schema - there is
                      * nowhere to move one to. Removed rather than left as a
                      * menu item that silently does nothing.
                      */}
                    <button
                      type="button"
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(sop)}
                    >
                      Delete SOP
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
        onClick={() => setViewAllOpen(true)}
      >
        View All SOPs
      </button>

      {/*
        * Recent Activity was RECENT_ACTIVITY.map(...) - four invented events
        * ("Priya Nair uploaded...") rendered identically under every
        * department. There is no activity log behind SOPs, so rather than
        * keep a convincing fiction this shows the real thing we do have: the
        * most recently updated documents, and who touched them.
        */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity className="size-4" />
          Recently Updated
        </h4>
        {recentlyUpdated.length === 0 ? (
          <p className="text-sm text-muted-foreground">No SOP activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {recentlyUpdated.map((sop) => (
              <li key={sop.id} className="flex items-start gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-medium">{sop.uploadedBy}</span> updated {sop.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{sop.uploadedOn}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deletingSop && (
        <DeleteConfirmDialog
          sop={deletingSop}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingSop(null)}
        />
      )}

      {viewAllOpen && (
        <ViewAllDialog
          sops={sops}
          onClose={() => setViewAllOpen(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDownload={handleDownload}
        />
      )}
    </div>
  )
}
