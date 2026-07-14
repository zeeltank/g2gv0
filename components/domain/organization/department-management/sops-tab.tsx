'use client'

import { useState, useRef, useEffect } from 'react'
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

export interface Sop {
  id: string
  title: string
  version: string
  type: string
  status: string
  uploadedBy: string
  uploadedOn: string
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

export const MOCK_SOPS: Sop[] = [
  {
    id: 'sop-1',
    title: 'Employee Onboarding Workflow',
    version: 'v2.3',
    type: 'PDF',
    status: 'Active',
    uploadedBy: 'Priya Nair',
    uploadedOn: '12 Jun 2025',
  },
  {
    id: 'sop-2',
    title: 'Incident Reporting & Escalation',
    version: 'v1.1',
    type: 'DOCX',
    status: 'Active',
    uploadedBy: 'Sanjay Kapoor',
    uploadedOn: '28 May 2025',
  },
  {
    id: 'sop-3',
    title: 'Quarterly Performance Review',
    version: 'v3.0',
    type: 'PDF',
    status: 'Active',
    uploadedBy: 'Meera Iyer',
    uploadedOn: '15 May 2025',
  },
  {
    id: 'sop-4',
    title: 'Remote Work & Connectivity',
    version: 'v1.4',
    type: 'PDF',
    status: 'Draft',
    uploadedBy: 'Rahul Verma',
    uploadedOn: '02 Apr 2025',
  },
  {
    id: 'sop-5',
    title: 'Data Privacy & Retention',
    version: 'v2.0',
    type: 'DOCX',
    status: 'Archived',
    uploadedBy: 'Kabir Khan',
    uploadedOn: '19 Mar 2025',
  },
]

export const SOP_SUMMARY: { label: string; value: string; icon: ReactNode }[] = [
  { label: 'Total Tasks', value: '48', icon: <ClipboardList className="size-4" /> },
  { label: 'Completed Tasks', value: '31', icon: <CheckCircle2 className="size-4" /> },
  { label: 'Pending Tasks', value: '12', icon: <Clock className="size-4" /> },
  { label: 'Overdue Tasks', value: '5', icon: <AlertTriangle className="size-4" /> },
  { label: 'Employees', value: '86', icon: <Users className="size-4" /> },
  { label: 'Open Positions', value: '9', icon: <UserPlus className="size-4" /> },
  { label: 'Policies', value: '14', icon: <ScrollText className="size-4" /> },
  { label: 'Decision Rules', value: '7', icon: <ShieldCheck className="size-4" /> },
]

export const RECENT_ACTIVITY: ActivityEvent[] = [
  {
    id: 'act-1',
    icon: <FileText className="size-4" />,
    text: 'uploaded SOP "Employee Onboarding Workflow"',
    user: 'Priya Nair',
    date: '12 Jun 2025',
  },
  {
    id: 'act-2',
    icon: <ScrollText className="size-4" />,
    text: 'updated policy "Code of Conduct"',
    user: 'Sanjay Kapoor',
    date: '09 Jun 2025',
  },
  {
    id: 'act-3',
    icon: <ShieldCheck className="size-4" />,
    text: 'modified decision rule "Leave Approval Threshold"',
    user: 'Meera Iyer',
    date: '03 Jun 2025',
  },
  {
    id: 'act-4',
    icon: <FileText className="size-4" />,
    text: 'uploaded SOP "Incident Reporting & Escalation"',
    user: 'Sanjay Kapoor',
    date: '28 May 2025',
  },
]

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
  onSubmit: (sop: Sop) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [version, setVersion] = useState('')
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('Active')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    onSubmit({
      id: `sop-${Date.now()}`,
      title: title.trim(),
      version: version.trim() || 'v1.0',
      type: fileName ? (fileName.split('.').pop() ?? 'FILE').toUpperCase() : 'PDF',
      status,
      uploadedBy: 'You',
      uploadedOn: today,
    })
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
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
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
  sops,
  onAddSop,
  onDeleteSop,
  onUpdateSop,
}: {
  department: Department
  sops: Sop[]
  onAddSop: (sop: Sop) => void
  onDeleteSop: (id: string) => void
  onUpdateSop: (sop: Sop) => void
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editingSop, setEditingSop] = useState<Sop | null>(null)
  const [deletingSop, setDeletingSop] = useState<Sop | null>(null)
  const [viewAllOpen, setViewAllOpen] = useState(false)
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({})

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

  const handleDownload = (sop: Sop) => {
    const content = [
      `SOP: ${sop.title}`,
      `Version: ${sop.version}`,
      `Status: ${sop.status}`,
      `Type: ${sop.type}`,
      `Uploaded By: ${sop.uploadedBy}`,
      `Uploaded On: ${sop.uploadedOn}`,
      '',
      'This is a mock SOP document.',
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${sop.title.replace(/[^a-z0-9]/gi, '_')}_${sop.version}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleEdit = (sop: Sop) => {
    setEditingSop(sop)
    setOpenMenu(null)
  }

  const handleDelete = (sop: Sop) => {
    setDeletingSop(sop)
    setOpenMenu(null)
  }

  const confirmDelete = () => {
    if (deletingSop) {
      onDeleteSop(deletingSop.id)
      setDeletingSop(null)
    }
  }

  if (uploadOpen) {
    return (
      <UploadSopForm
        department={department}
        onCancel={() => setUploadOpen(false)}
        onSubmit={(sop) => {
          onAddSop(sop)
          setUploadOpen(false)
        }}
      />
    )
  }

  if (editingSop) {
    return (
      <EditSopForm
        sop={editingSop}
        onCancel={() => setEditingSop(null)}
        onSubmit={(updated) => {
          onUpdateSop(updated)
          setEditingSop(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Standard Operating Procedures</h3>
        <Button size="sm" className="h-9" onClick={() => setUploadOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Upload SOP
        </Button>
      </div>

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
              <IconButton label={`View ${sop.title}`} icon={<FileText className="size-4" />} onClick={() => handleDownload(sop)} />
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
                    <button
                      type="button"
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      Move to folder
                    </button>
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

      <div>
        <h4 className="mb-3 text-sm font-semibold text-foreground">Department Summary</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SOP_SUMMARY.map((item) => (
            <Card key={item.label}>
              <CardContent className="flex flex-col gap-1 p-4">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted text-foreground">
                  {item.icon}
                </div>
                <p className="mt-1 text-2xl font-semibold text-foreground">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity className="size-4" />
          Recent Activity
        </h4>
        <ul className="space-y-3">
          {RECENT_ACTIVITY.map((event) => (
            <li key={event.id} className="flex items-start gap-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                {event.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{event.user}</span> {event.text}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{event.date}</p>
              </div>
            </li>
          ))}
        </ul>
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
