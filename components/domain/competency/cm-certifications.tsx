'use client'

import React, { useCallback, useMemo, useState } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Plus,
  RefreshCw,
  FileText,
  Clock,
  AlertCircle,
  FileBadge,
  X,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  CheckCircle2,
  Trash2,
  Link2,
  ClipboardList,
  History as HistoryIcon,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

import { useAuth } from '@/hooks/use-auth'
import {
  useCertifications,
  useCertificationDetail,
  useCertificationEmployees,
  useCertificationRequirements,
  type CertificationPanelTab,
} from '@/hooks/use-certifications'
import type {
  CertificationItem,
  CertificationListParams,
  CertificationPayload,
  CertificationRequirement,
  CertificationRequirementPayload,
  CertificationSortField,
  ComplianceKey,
} from '@/services/competency'

const ALL = 'all'

/** Explicit tab ids - deriving them from the labels is what broke sibling screens. */
const LIST_TABS = [
  { id: 'all', label: 'All Certifications' },
  { id: 'my', label: 'My Certifications' },
  { id: 'soon', label: 'Expiring Soon' },
  { id: 'expired', label: 'Expired' },
] as const
type ListTabId = (typeof LIST_TABS)[number]['id']

const PANEL_TABS: { id: CertificationPanelTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'documents', label: 'Documents' },
  { id: 'history', label: 'History' },
]

const STATUS_OPTIONS = [
  { value: 'valid', label: 'Active' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
]

const CERT_TYPE_OPTIONS = [
  { value: 'Industry Certification', label: 'Industry Certification' },
  { value: 'Vendor Certification', label: 'Vendor Certification' },
  { value: 'Internal Certification', label: 'Internal Certification' },
  { value: 'Regulatory', label: 'Regulatory' },
  { value: 'License', label: 'License' },
]

const PER_PAGE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
]

const nf = (n: number) => n.toLocaleString()

/** Compliance -> the StatusBadge variant that actually exists in the design system. */
function complianceVariant(key: ComplianceKey | string) {
  if (key === 'compliant') return 'success' as const
  if (key === 'expiring') return 'warning' as const
  return 'error' as const
}

function statusVariant(status: string) {
  if (status === 'valid') return 'success' as const
  if (status === 'expiring') return 'warning' as const
  return 'error' as const
}

function verificationVariant(status: string | null) {
  if (status === 'verified') return 'success' as const
  if (status === 'rejected') return 'error' as const
  return 'pending' as const
}

function withAll(options: { value: string; label: string }[], allLabel: string) {
  return [{ value: ALL, label: allLabel }, ...options]
}

/* ------------------------------------------------------------------ *
 * KPI card
 * ------------------------------------------------------------------ */

function KpiCard({
  icon,
  tone,
  label,
  value,
  hint,
  loading,
  onClick,
  active,
}: {
  icon: React.ReactNode
  tone: string
  label: string
  value: number | null
  hint: string
  loading: boolean
  onClick?: () => void
  active?: boolean
}) {
  return (
    <Card
      className={`shadow-sm transition-colors ${onClick ? 'cursor-pointer hover:border-primary/40' : ''} ${
        active ? 'border-primary/50 ring-1 ring-primary/20' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}>{icon}</div>
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-16 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-foreground mt-1">{value === null ? '--' : nf(value)}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Add / edit a held certification
 * ------------------------------------------------------------------ */

function CertificationDialog({
  open,
  onOpenChange,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: CertificationItem | null
  saving: boolean
  onSubmit: (payload: CertificationPayload) => Promise<{ ok: boolean; message: string }>
}) {
  const { options: employeeOptions } = useCertificationEmployees(open)

  const [name, setName] = useState('')
  const [userId, setUserId] = useState('')
  const [issuingBody, setIssuingBody] = useState('')
  const [certType, setCertType] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [status, setStatus] = useState('valid')
  const [issuedDate, setIssuedDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset the form whenever the dialog opens for a different record. Derived
  // during render (not in an effect) to satisfy the set-state-in-effect rule.
  const formKey = `${open ? 'open' : 'closed'}:${initial?.id ?? 'new'}`
  const [lastKey, setLastKey] = useState(formKey)
  if (formKey !== lastKey) {
    setLastKey(formKey)
    setName(initial?.name ?? '')
    setUserId(initial?.user_id ? String(initial.user_id) : '')
    setIssuingBody(initial?.issuing_body ?? '')
    setCertType(initial?.certification_type ?? '')
    setCredentialId(initial?.credential_id ?? '')
    setStatus(initial?.status ?? 'valid')
    setIssuedDate(initial?.issued_date ?? '')
    setExpiryDate(initial?.expiry_date ?? '')
    setError(null)
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('Certification name is required.')
      return
    }
    const result = await onSubmit({
      name: name.trim(),
      user_id_target: userId ? Number(userId) : null,
      issuing_body: issuingBody || undefined,
      certification_type: certType || undefined,
      credential_id: credentialId || undefined,
      status,
      issued_date: issuedDate || undefined,
      expiry_date: expiryDate || undefined,
    })
    if (result.ok) {
      onOpenChange(false)
    } else {
      setError(result.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Certification' : 'Add Employee Certification'}</DialogTitle>
          <DialogDescription>
            Record a credential an employee holds, with its validity window and issuing authority.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-muted-foreground">Certification Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PMP - Project Management Professional"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Employee</label>
            <Select
              value={userId}
              onChange={setUserId}
              options={employeeOptions}
              placeholder="Select employee"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Certification Type</label>
            <Select
              value={certType}
              onChange={setCertType}
              options={CERT_TYPE_OPTIONS}
              placeholder="Select type"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Issuing Authority</label>
            <Input
              value={issuingBody}
              onChange={(e) => setIssuingBody(e.target.value)}
              placeholder="e.g. PMI"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Certification ID</label>
            <Input
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="e.g. PMP-7845123"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Valid From</label>
            <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Valid Until</label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Status</label>
            <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} className="mt-1 w-full" />
          </div>
        </div>

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add Certification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Certification requirements manager
 * ------------------------------------------------------------------ */

function RequirementDialog({
  open,
  onOpenChange,
  departments,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: { value: string; label: string }[]
}) {
  const { requirements, loading, error, saving, create, remove, retry } = useCertificationRequirements(open)

  const [name, setName] = useState('')
  const [certType, setCertType] = useState('')
  const [issuingBody, setIssuingBody] = useState('')
  const [jobrole, setJobrole] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [mandatory, setMandatory] = useState('1')
  const [validityMonths, setValidityMonths] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) {
      setFormError('Requirement name is required.')
      return
    }
    const payload: CertificationRequirementPayload = {
      name: name.trim(),
      certification_type: certType || undefined,
      issuing_body: issuingBody || undefined,
      jobrole: jobrole.trim() || undefined,
      department_id: departmentId ? Number(departmentId) : null,
      is_mandatory: mandatory === '1',
      validity_months: validityMonths ? Number(validityMonths) : null,
    }
    const result = await create(payload)
    if (result.ok) {
      setName('')
      setCertType('')
      setIssuingBody('')
      setJobrole('')
      setDepartmentId('')
      setValidityMonths('')
      setFormError(null)
    } else {
      setFormError(result.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Certification Requirements</DialogTitle>
          <DialogDescription>
            Define which credential a job role, department or the whole organisation is expected to hold. These
            drive the Requirements tab and the Compliant Employees metric.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-muted-foreground">Certification Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ISO 27001 Lead Auditor" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Type</label>
            <Select value={certType} onChange={setCertType} options={CERT_TYPE_OPTIONS} placeholder="Select type" className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Issuing Authority</label>
            <Input value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)} placeholder="e.g. BSI" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Job Role</label>
            <Input value={jobrole} onChange={(e) => setJobrole(e.target.value)} placeholder="Leave blank for all roles" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Department</label>
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              options={departments}
              placeholder="Organisation-wide"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Requirement</label>
            <Select
              value={mandatory}
              onChange={setMandatory}
              options={[
                { value: '1', label: 'Mandatory' },
                { value: '0', label: 'Recommended' },
              ]}
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Validity (months)</label>
            <Input
              type="number"
              value={validityMonths}
              onChange={(e) => setValidityMonths(e.target.value)}
              placeholder="e.g. 36"
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={submit} disabled={saving} className="w-full gap-2">
              <Plus className="w-4 h-4" /> {saving ? 'Saving...' : 'Add Requirement'}
            </Button>
          </div>
        </div>

        {formError && <p className="text-xs text-destructive">{formError}</p>}

        <div className="mt-2 max-h-72 overflow-auto g2g-scrollbar border border-border rounded-lg">
          {loading ? (
            <div className="p-4 flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState title="Could not load requirements" description={error} retry={retry} className="border-0" />
          ) : requirements.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-8 h-8" />}
              title="No requirements defined"
              description="Add the first certification requirement above."
              className="border-0"
            />
          ) : (
            <Table className="w-full text-sm">
              <TableHeader className="bg-muted/30 sticky top-0">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3 py-2 font-bold">Certification</TableHead>
                  <TableHead className="px-3 py-2 font-bold">Applies To</TableHead>
                  <TableHead className="px-3 py-2 font-bold">Requirement</TableHead>
                  <TableHead className="px-3 py-2 font-bold">Holders</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {requirements.map((requirement: CertificationRequirement) => (
                  <TableRow key={requirement.id}>
                    <TableCell className="px-3 py-2 font-medium">
                      {requirement.name}
                      {requirement.issuing_body && (
                        <span className="block text-xs text-muted-foreground">{requirement.issuing_body}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs text-muted-foreground max-w-[220px] truncate">
                      {requirement.scope}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <StatusBadge
                        variant={requirement.is_mandatory ? 'error' : 'pending'}
                        label={requirement.is_mandatory ? 'Mandatory' : 'Recommended'}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs">{requirement.holders ?? 0}</TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(requirement.id)}
                        aria-label={`Delete ${requirement.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Attach a document
 * ------------------------------------------------------------------ */

function DocumentDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { title: string; description?: string; link?: string; file?: File | null }) => Promise<{
    ok: boolean
    message: string
  }>
}) {
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) {
      setError('Document title is required.')
      return
    }
    if (!file && !link.trim()) {
      setError('Attach a file or provide a link.')
      return
    }
    setBusy(true)
    const result = await onSubmit({ title: title.trim(), link: link.trim() || undefined, file })
    setBusy(false)
    if (result.ok) {
      setTitle('')
      setLink('')
      setFile(null)
      setError(null)
      onOpenChange(false)
    } else {
      setError(result.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach Document</DialogTitle>
          <DialogDescription>Upload the certificate file, or link to it if it is hosted elsewhere.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. PMP Certificate" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">File</label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">PDF, image or Word document, up to 10 MB.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">or Link</label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Attaching...' : 'Attach'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Add a note
 * ------------------------------------------------------------------ */

function NoteDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (note: string) => Promise<{ ok: boolean; message: string }>
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!note.trim()) {
      setError('Enter a note.')
      return
    }
    setBusy(true)
    const result = await onSubmit(note.trim())
    setBusy(false)
    if (result.ok) {
      setNote('')
      setError(null)
      onOpenChange(false)
    } else {
      setError(result.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>Notes are appended to this certification with your name and the date.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="e.g. Recertification required before expiry."
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving...' : 'Add Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export function CmCertifications() {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<ListTabId>('all')
  const [selectedCert, setSelectedCert] = useState<number | null>(null)
  const [panelTab, setPanelTab] = useState<CertificationPanelTab>('overview')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [complianceFilter, setComplianceFilter] = useState(ALL)
  const [expiryFilter, setExpiryFilter] = useState(ALL)
  const [departmentFilter, setDepartmentFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [issuerFilter, setIssuerFilter] = useState(ALL)
  const [verificationFilter, setVerificationFilter] = useState(ALL)
  const [expiryFrom, setExpiryFrom] = useState('')
  const [expiryTo, setExpiryTo] = useState('')

  // Sort + pagination
  const [sort, setSort] = useState<CertificationSortField>('created_at')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState('10')

  // Selection + dialogs
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [certDialogOpen, setCertDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CertificationItem | null>(null)
  const [requirementDialogOpen, setRequirementDialogOpen] = useState(false)
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)

  // The tab pills are just preset filters on top of the filter bar.
  const tabParams: Partial<CertificationListParams> = useMemo(() => {
    if (activeTab === 'my') return { user_id_filter: user?.id ? String(user.id) : undefined }
    if (activeTab === 'soon') return { expiry_window: '60' }
    if (activeTab === 'expired') return { expiry_window: 'expired' }
    return {}
  }, [activeTab, user?.id])

  const params: CertificationListParams = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter === ALL ? undefined : statusFilter,
      compliance: complianceFilter === ALL ? undefined : complianceFilter,
      expiry_window: expiryFilter === ALL ? undefined : expiryFilter,
      department_id: departmentFilter === ALL ? undefined : departmentFilter,
      certification_type: typeFilter === ALL ? undefined : typeFilter,
      issuing_body: issuerFilter === ALL ? undefined : issuerFilter,
      verification_status: verificationFilter === ALL ? undefined : verificationFilter,
      expiry_from: expiryFrom || undefined,
      expiry_to: expiryTo || undefined,
      sort,
      direction,
      page,
      per_page: Number(perPage),
      ...tabParams,
    }),
    [
      search,
      statusFilter,
      complianceFilter,
      expiryFilter,
      departmentFilter,
      typeFilter,
      issuerFilter,
      verificationFilter,
      expiryFrom,
      expiryTo,
      sort,
      direction,
      page,
      perPage,
      tabParams,
    ],
  )

  const {
    loading,
    error,
    items,
    pagination,
    metrics,
    metricsLoading,
    filterOptions,
    saving,
    actionMessage,
    actionError,
    retry,
    create,
    update,
    remove,
    bulk,
    exportRows,
    clearMessages,
  } = useCertifications(params)

  const detail = useCertificationDetail(selectedCert, panelTab)

  const departmentOptions = filterOptions?.departments ?? []

  /* --------------------------- interactions --------------------------- */

  const resetPage = useCallback(() => setPage(1), [])

  const changeTab = (tab: ListTabId) => {
    setActiveTab(tab)
    setSelectedCert(null)
    setSelectedIds([])
    resetPage()
  }

  const toggleSort = (field: CertificationSortField) => {
    if (sort === field) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setDirection('asc')
    }
    resetPage()
  }

  const sortIcon = (field: CertificationSortField) => {
    if (sort !== field) return <ChevronsUpDown className="w-3 h-3 opacity-40" />
    return direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  const allOnPageSelected = items.length > 0 && items.every((row) => selectedIds.includes(row.id))

  const toggleSelectAll = () => {
    setSelectedIds(allOnPageSelected ? [] : items.map((row) => row.id))
  }

  const toggleRow = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((rowId) => rowId !== id) : [...current, id],
    )
  }

  const runBulk = async (action: Parameters<typeof bulk>[0], status?: string) => {
    if (selectedIds.length === 0) return
    const result = await bulk(action, selectedIds, status)
    if (result.ok) {
      setSelectedIds([])
      if (action === 'delete') setSelectedCert(null)
    }
  }

  const handleExport = async () => {
    const rows = await exportRows()
    const headers = [
      'Certification Name',
      'Employee',
      'Employee No',
      'Department',
      'Job Role',
      'Certification Type',
      'Issuing Authority',
      'Certification ID',
      'Valid From',
      'Valid Until',
      'Days To Expiry',
      'Status',
      'Compliance',
      'Verification',
    ]
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        [
          row.name,
          row.employee_name,
          row.employee_no,
          row.department,
          row.jobrole,
          row.certification_type,
          row.issuing_body,
          row.credential_id,
          row.issued_date_label,
          row.expiry_date_label,
          row.days_to_expiry,
          row.status_label,
          row.compliance,
          row.verification_status,
        ]
          .map(escape)
          .join(','),
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `certifications-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const lastPage = pagination?.last_page ?? 1
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(page - 1, lastPage - 2))
    return Array.from({ length: Math.min(3, lastPage) }, (_, i) => start + i).filter((p) => p <= lastPage)
  }, [page, lastPage])

  const rangeStart = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.per_page + 1 : 0
  const rangeEnd = pagination ? Math.min(pagination.page * pagination.per_page, pagination.total) : 0

  const cert = detail.detail

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-foreground" /> Certification & Compliance Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage certification requirements, track employee compliance, expiration dates, and verification.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-10 px-4 rounded-xl font-bold gap-2">
                <Plus className="w-4 h-4" /> Add Certification Requirement <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRequirementDialogOpen(true)}>
                Certification Requirement
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditing(null)
                  setCertDialogOpen(true)
                }}
              >
                Employee Certification
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2"
            onClick={handleExport}
          >
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          icon={<FileBadge className="w-5 h-5" />}
          tone="bg-primary/10 text-primary"
          label="Total Certifications"
          value={metrics?.total ?? null}
          hint="All certifications"
          loading={metricsLoading}
          active={complianceFilter === ALL && expiryFilter === ALL && verificationFilter === ALL}
          onClick={() => {
            setComplianceFilter(ALL)
            setExpiryFilter(ALL)
            setVerificationFilter(ALL)
            setActiveTab('all')
            resetPage()
          }}
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="bg-success/10 text-success"
          label="Compliant Employees"
          value={metrics?.compliant_employees ?? null}
          hint={
            metrics
              ? `${metrics.compliant_percent}% of ${nf(metrics.employees_evaluated)} evaluated`
              : 'Meeting every mandatory requirement'
          }
          loading={metricsLoading}
        />
        <KpiCard
          icon={<Clock className="w-5 h-5" />}
          tone="bg-orange-500/10 text-orange-500"
          label="Expiring Soon"
          value={metrics?.expiring_soon ?? null}
          hint={`Within ${metrics?.expiring_window_days ?? 60} days`}
          loading={metricsLoading}
          active={expiryFilter === '60'}
          onClick={() => {
            setExpiryFilter(expiryFilter === '60' ? ALL : '60')
            resetPage()
          }}
        />
        <KpiCard
          icon={<AlertCircle className="w-5 h-5" />}
          tone="bg-destructive/10 text-destructive"
          label="Expired"
          value={metrics?.expired ?? null}
          hint="Require attention"
          loading={metricsLoading}
          active={expiryFilter === 'expired'}
          onClick={() => {
            setExpiryFilter(expiryFilter === 'expired' ? ALL : 'expired')
            resetPage()
          }}
        />
        <KpiCard
          icon={<ShieldCheck className="w-5 h-5" />}
          tone="bg-primary/10 text-primary"
          label="Pending Verification"
          value={metrics?.pending_verification ?? null}
          hint="Awaiting review"
          loading={metricsLoading}
          active={verificationFilter === 'pending'}
          onClick={() => {
            setVerificationFilter(verificationFilter === 'pending' ? ALL : 'pending')
            resetPage()
          }}
        />
      </div>

      {/* Filters and List wrapper */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by certification or employee..."
              className="h-10 pl-8 bg-background border-border"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetPage()
              }}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value)
              resetPage()
            }}
            options={withAll(filterOptions?.statuses ?? STATUS_OPTIONS, 'Status: All')}
            className="h-10 bg-background w-32"
          />
          <Select
            value={complianceFilter}
            onChange={(value) => {
              setComplianceFilter(value)
              resetPage()
            }}
            options={withAll(filterOptions?.compliance ?? [], 'Compliance: All')}
            className="h-10 bg-background w-40"
          />
          <Select
            value={expiryFilter}
            onChange={(value) => {
              setExpiryFilter(value)
              resetPage()
            }}
            options={withAll(filterOptions?.expiry_windows ?? [], 'Expiry: All')}
            className="h-10 bg-background w-36"
          />
          <Select
            value={departmentFilter}
            onChange={(value) => {
              setDepartmentFilter(value)
              resetPage()
            }}
            options={withAll(departmentOptions, 'Department: All')}
            className="h-10 bg-background w-40"
          />
          <Select
            value={typeFilter}
            onChange={(value) => {
              setTypeFilter(value)
              resetPage()
            }}
            options={withAll(filterOptions?.certification_types ?? CERT_TYPE_OPTIONS, 'Type: All')}
            className="h-10 bg-background w-48"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 px-4 gap-2 bg-background border-border text-sm ml-auto">
                <Filter className="w-4 h-4" /> More Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Issuing Authority</label>
                <Select
                  value={issuerFilter}
                  onChange={(value) => {
                    setIssuerFilter(value)
                    resetPage()
                  }}
                  options={withAll(filterOptions?.issuing_bodies ?? [], 'All authorities')}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Verification</label>
                <Select
                  value={verificationFilter}
                  onChange={(value) => {
                    setVerificationFilter(value)
                    resetPage()
                  }}
                  options={withAll(filterOptions?.verification ?? [], 'All states')}
                  className="mt-1 w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Expiry from</label>
                  <Input
                    type="date"
                    value={expiryFrom}
                    onChange={(e) => {
                      setExpiryFrom(e.target.value)
                      resetPage()
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Expiry to</label>
                  <Input
                    type="date"
                    value={expiryTo}
                    onChange={(e) => {
                      setExpiryTo(e.target.value)
                      resetPage()
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIssuerFilter(ALL)
                  setVerificationFilter(ALL)
                  setExpiryFrom('')
                  setExpiryTo('')
                  resetPage()
                }}
              >
                Clear extra filters
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Tab Pills & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {LIST_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors border ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-card text-muted-foreground border-transparent hover:bg-muted/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <span className="text-xs font-semibold text-muted-foreground mr-1">
                {selectedIds.length} selected
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 px-3 gap-2 bg-background border-border text-sm"
                  disabled={selectedIds.length === 0 || saving}
                >
                  Bulk Actions <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Verification</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => runBulk('verify')}>Mark Verified</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runBulk('reject')}>Mark Rejected</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => runBulk('update_status', 'valid')}>Set Active</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runBulk('update_status', 'expired')}>Set Expired</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runBulk('revoke')}>Revoke</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => runBulk('delete')}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="h-9 w-9 p-0 bg-background border-border"
              onClick={retry}
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {(actionMessage || actionError) && (
          <div
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
              actionError
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-success/30 bg-success/10 text-success'
            }`}
          >
            <span>{actionError || actionMessage}</span>
            <button onClick={clearMessages} aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Split View */}
      <div className="flex gap-6 items-stretch min-w-[1000px] h-[600px]">
        <Card
          className={`flex flex-col overflow-hidden h-full transition-all duration-300 ${
            selectedCert ? 'w-1/2' : 'w-full'
          }`}
        >
          <div className="flex-1 overflow-auto g2g-scrollbar relative z-10 bg-card">
            {loading ? (
              <div className="p-4 flex flex-col gap-2">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : error ? (
              <ErrorState
                title="Could not load certifications"
                description={error}
                retry={retry}
                className="border-0 h-full"
              />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<FileBadge className="w-10 h-10" />}
                title="No certifications found"
                description="No credential matches the current filters. Adjust the filters or add a certification."
                className="border-0 h-full"
                action={
                  <Button
                    onClick={() => {
                      setEditing(null)
                      setCertDialogOpen(true)
                    }}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Certification
                  </Button>
                }
              />
            ) : (
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/30 border-b border-border sticky top-0 z-20">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 px-4 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-muted-foreground/30 text-primary focus:ring-primary w-4 h-4"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground">
                      <button className="flex items-center gap-1" onClick={() => toggleSort('name')}>
                        Certification Name {sortIcon('name')}
                      </button>
                    </TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground">Employee</TableHead>
                    {!selectedCert && (
                      <TableHead className="px-4 py-3 font-bold text-foreground">Department</TableHead>
                    )}
                    <TableHead className="px-4 py-3 font-bold text-foreground">
                      <button className="flex items-center gap-1" onClick={() => toggleSort('issued_date')}>
                        Valid From {sortIcon('issued_date')}
                      </button>
                    </TableHead>
                    {!selectedCert && (
                      <TableHead className="px-4 py-3 font-bold text-foreground">
                        <button className="flex items-center gap-1" onClick={() => toggleSort('expiry_date')}>
                          Valid Until {sortIcon('expiry_date')}
                        </button>
                      </TableHead>
                    )}
                    <TableHead className="px-4 py-3 font-bold text-foreground">
                      <button className="flex items-center gap-1" onClick={() => toggleSort('status')}>
                        Status {sortIcon('status')}
                      </button>
                    </TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground">Compliance</TableHead>
                    <TableHead className="w-12 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {items.map((row) => (
                    <TableRow
                      key={row.id}
                      className={`hover:bg-muted/30 cursor-pointer ${selectedCert === row.id ? 'bg-primary/5' : ''}`}
                      onClick={() => {
                        setSelectedCert(row.id)
                        setPanelTab('overview')
                      }}
                    >
                      <TableCell className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-muted-foreground/30 text-primary focus:ring-primary w-4 h-4"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.name}`}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-4 font-medium text-foreground max-w-[200px] truncate">
                        {row.name}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <span className="font-semibold text-xs whitespace-nowrap">
                          {selectedCert
                            ? row.employee_initials ?? '--'
                            : row.employee_name ?? 'Unassigned'}
                        </span>
                      </TableCell>
                      {!selectedCert && (
                        <TableCell className="px-4 py-4 text-muted-foreground text-xs">
                          {row.department ?? '--'}
                        </TableCell>
                      )}
                      <TableCell className="px-4 py-4 text-muted-foreground text-xs whitespace-nowrap">
                        {row.issued_date_label ?? '--'}
                      </TableCell>
                      {!selectedCert && (
                        <TableCell className="px-4 py-4 text-muted-foreground text-xs whitespace-nowrap">
                          {row.expiry_date_label ?? '--'}
                        </TableCell>
                      )}
                      <TableCell className="px-4 py-4">
                        <StatusBadge variant={statusVariant(row.status)} label={row.status_label} />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <StatusBadge variant={complianceVariant(row.compliance_key)} label={row.compliance} />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors mx-auto">
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCert(row.id)
                                setPanelTab('overview')
                              }}
                            >
                              View Certificate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(row)
                                setCertDialogOpen(true)
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                            {STATUS_OPTIONS.filter((option) => option.value !== 'revoked').map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={() => update(row.id, { status: option.value })}
                              >
                                Set {option.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => update(row.id, { verification_status: 'verified' })}
                            >
                              Mark Verified
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => update(row.id, { status: 'revoked' })}>
                              Revoke
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={async () => {
                                const result = await remove(row.id)
                                if (result.ok && selectedCert === row.id) setSelectedCert(null)
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card">
            <span>
              {pagination && pagination.total > 0
                ? `Showing ${rangeStart}-${rangeEnd} of ${nf(pagination.total)}`
                : 'No results'}
            </span>
            <div className="flex items-center gap-2">
              <span className="mr-2 flex items-center">
                Show
                <Select
                  value={perPage}
                  onChange={(value) => {
                    setPerPage(value)
                    resetPage()
                  }}
                  options={PER_PAGE_OPTIONS}
                  className="w-16 h-7 inline-flex text-xs mx-1"
                />
                per page
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {pageNumbers.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  variant="outline"
                  size="sm"
                  className={`h-7 w-7 p-0 ${
                    pageNumber === page ? 'bg-primary text-primary-foreground border-primary' : ''
                  }`}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Sidebar: Details Panel */}
        {selectedCert && (
          <Card className="flex-1 flex flex-col overflow-hidden h-full">
            <div className="p-5 border-b border-border flex flex-col gap-4 bg-card z-10 shrink-0 relative">
              <Button
                variant="ghost"
                className="absolute top-4 right-4 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedCert(null)}
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </Button>
              <div className="pr-8">
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  {detail.loading && !cert ? <Skeleton className="h-6 w-48" /> : cert?.name ?? 'Certification'}
                </h2>
              </div>

              <div className="flex items-center gap-6 mt-2 border-b border-border/50">
                {PANEL_TABS.map((tab) => {
                  const isActive = tab.id === panelTab
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setPanelTab(tab.id)}
                      className={`pb-2 text-xs font-semibold transition-colors relative ${
                        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                      {isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <CardContent className="flex-1 overflow-auto g2g-scrollbar relative z-10 p-5 bg-card">
              {detail.error ? (
                <ErrorState
                  title="Could not load this certification"
                  description={detail.error}
                  retry={detail.reload}
                  className="border-0"
                />
              ) : panelTab === 'overview' ? (
                detail.loading || !cert ? (
                  <div className="flex flex-col gap-4">
                    {Array.from({ length: 6 }, (_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {/* Employee */}
                    <div className="flex items-center gap-4 pb-6 border-b border-border">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                        {cert.employee?.initials ?? cert.employee_initials ?? '--'}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-foreground">
                          {cert.employee?.name ?? cert.employee_name ?? 'Unassigned'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cert.employee?.jobrole ?? '--'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cert.employee?.department ?? cert.department ?? '--'}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-col gap-1 items-end">
                        <div className="flex gap-2">
                          <span>Emp ID</span>
                          <span className="font-semibold text-foreground">
                            {cert.employee?.employee_no ?? '--'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <span>Email</span>
                          <span className="font-semibold text-foreground">{cert.employee?.email ?? '--'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Certification Type</p>
                        <p className="text-sm font-semibold text-foreground">{cert.certification_type ?? '--'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valid Until</p>
                        <p className="text-sm font-semibold text-foreground">{cert.expiry_date_label ?? '--'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Issuing Authority</p>
                        <p className="text-sm font-semibold text-foreground">{cert.issuing_body ?? '--'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        <StatusBadge variant={statusVariant(cert.status)} label={cert.status_label} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Certification ID</p>
                        <p className="text-sm font-semibold text-foreground">{cert.credential_id ?? '--'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Compliance</p>
                        <StatusBadge variant={complianceVariant(cert.compliance_key)} label={cert.compliance} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valid From</p>
                        <p className="text-sm font-semibold text-foreground">{cert.issued_date_label ?? '--'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Days to Expiry</p>
                        <p className="text-sm font-semibold text-foreground">
                          {cert.days_to_expiry === null
                            ? '--'
                            : cert.days_to_expiry < 0
                              ? `Expired ${Math.abs(cert.days_to_expiry)} days ago`
                              : `${nf(cert.days_to_expiry)} days`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Verification</p>
                        <StatusBadge
                          variant={verificationVariant(cert.verification_status)}
                          label={cert.verification_status ?? 'Pending'}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Linked Competency</p>
                        <p className="text-sm font-semibold text-foreground">{cert.competency ?? '--'}</p>
                      </div>
                    </div>

                    {cert.verification_status !== 'verified' && (
                      <div className="flex gap-2">
                        <Button
                          className="gap-2"
                          onClick={() => update(cert.id, { verification_status: 'verified' })}
                          disabled={saving}
                        >
                          <CheckCircle2 className="w-4 h-4" /> Verify
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => update(cert.id, { verification_status: 'rejected' })}
                          disabled={saving}
                        >
                          <ShieldAlert className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    )}

                    {/* Documents preview */}
                    <div className="pt-6 border-t border-border">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-foreground">Documents</h4>
                        <Button
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground"
                          onClick={() => setDocumentDialogOpen(true)}
                          aria-label="Attach document"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <button
                        className="text-xs text-primary font-semibold"
                        onClick={() => setPanelTab('documents')}
                      >
                        Open the Documents tab to view attachments
                      </button>
                    </div>

                    {/* Notes */}
                    <div className="pt-6 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-foreground">Notes</h4>
                        <Button
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground"
                          onClick={() => setNoteDialogOpen(true)}
                          aria-label="Add note"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {cert.notes ? (
                        <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 whitespace-pre-line">
                          {cert.notes}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                          No notes recorded yet.
                        </p>
                      )}
                    </div>
                  </div>
                )
              ) : detail.tabLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : detail.tabError ? (
                <ErrorState
                  title="Could not load this tab"
                  description={detail.tabError}
                  retry={detail.reload}
                  className="border-0"
                />
              ) : panelTab === 'compliance' ? (
                detail.compliance ? (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
                      <div>
                        <p className="text-xs text-muted-foreground">Compliance status</p>
                        <StatusBadge
                          variant={complianceVariant(detail.compliance.compliance_key)}
                          label={detail.compliance.compliance}
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-2">{detail.compliance.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Days to expiry</p>
                        <p className="text-2xl font-bold text-foreground">
                          {detail.compliance.days_to_expiry === null
                            ? '--'
                            : nf(detail.compliance.days_to_expiry)}
                        </p>
                      </div>
                    </div>

                    {detail.compliance.validity_percent !== null && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Validity window elapsed</span>
                          <span className="font-semibold text-foreground">
                            {detail.compliance.validity_percent}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${detail.compliance.validity_percent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                          <span>{detail.compliance.issued_date ?? '--'}</span>
                          <span>{detail.compliance.expiry_date ?? '--'}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Verification</p>
                        <StatusBadge
                          variant={verificationVariant(detail.compliance.verification_status)}
                          label={detail.compliance.verification_status ?? 'Pending'}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Verified by</p>
                        <p className="text-sm font-semibold text-foreground">
                          {detail.compliance.verified_by ?? '--'}
                          {detail.compliance.verified_at ? ` - ${detail.compliance.verified_at}` : ''}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">Required credential</p>
                        <p className="text-sm font-semibold text-foreground">
                          {detail.compliance.is_required && detail.compliance.requirement
                            ? `${detail.compliance.requirement.name} (${
                                detail.compliance.requirement.is_mandatory ? 'Mandatory' : 'Recommended'
                              }) for ${detail.compliance.requirement.scope}`
                            : 'Not tied to a certification requirement'}
                        </p>
                      </div>
                    </div>

                    {detail.compliance.holder && (
                      <div className="pt-4 border-t border-border">
                        <h4 className="text-sm font-bold text-foreground mb-3">Holder&apos;s overall position</h4>
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: 'Total', value: detail.compliance.holder.total, tone: 'text-foreground' },
                            { label: 'Compliant', value: detail.compliance.holder.compliant, tone: 'text-success' },
                            { label: 'Expiring', value: detail.compliance.holder.expiring, tone: 'text-warning' },
                            {
                              label: 'Non-Compliant',
                              value: detail.compliance.holder.non_compliant,
                              tone: 'text-destructive',
                            },
                          ].map((tile) => (
                            <div key={tile.label} className="p-3 rounded-lg border border-border text-center">
                              <p className={`text-xl font-bold ${tile.tone}`}>{nf(tile.value)}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{tile.label}</p>
                            </div>
                          ))}
                        </div>
                        {detail.compliance.holder.missing.length > 0 && (
                          <p className="text-xs text-destructive mt-3">
                            Missing mandatory: {detail.compliance.holder.missing.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState title="No compliance data" className="border-0" />
                )
              ) : panelTab === 'requirements' ? (
                detail.requirements.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardList className="w-8 h-8" />}
                    title="No requirements apply"
                    description="No certification requirement is mapped to this employee's role or department."
                    className="border-0"
                    action={
                      <Button variant="outline" onClick={() => setRequirementDialogOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" /> Add Requirement
                      </Button>
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    {detail.requirementSummary && (
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 text-sm">
                        <span className="text-muted-foreground">
                          {detail.requirementSummary.met} of {detail.requirementSummary.total} met
                          {detail.requirementSummary.mandatory > 0
                            ? ` - ${detail.requirementSummary.mandatory} mandatory`
                            : ''}
                        </span>
                        <span className="font-bold text-foreground">{detail.requirementSummary.met_percent}%</span>
                      </div>
                    )}
                    {detail.requirements.map((requirement) => (
                      <div
                        key={requirement.id}
                        className={`p-3 rounded-lg border ${
                          requirement.is_current ? 'border-primary/40 bg-primary/5' : 'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {requirement.name}
                              {requirement.is_current && (
                                <span className="ml-2 text-[11px] text-primary font-bold">This credential</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{requirement.scope}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusBadge
                              variant={requirement.is_met ? 'success' : 'error'}
                              label={requirement.is_met ? 'Met' : 'Not Met'}
                              size="sm"
                            />
                            <StatusBadge
                              variant={requirement.is_mandatory ? 'error' : 'pending'}
                              label={requirement.is_mandatory ? 'Mandatory' : 'Recommended'}
                              size="sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                          <span>Held status: {requirement.held_status}</span>
                          {requirement.held_expiry && <span>Expires {requirement.held_expiry}</span>}
                          {requirement.validity_months && <span>Valid {requirement.validity_months} months</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : panelTab === 'documents' ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground">Attached documents</h4>
                    <Button variant="outline" className="h-8 gap-2" onClick={() => setDocumentDialogOpen(true)}>
                      <Plus className="w-3.5 h-3.5" /> Attach
                    </Button>
                  </div>
                  {detail.documents.length === 0 ? (
                    <EmptyState
                      icon={<FileText className="w-8 h-8" />}
                      title="No documents attached"
                      description="Upload the certificate or link to where it is hosted."
                      className="border-0"
                    />
                  ) : (
                    detail.documents.map((document) => (
                      <div
                        key={document.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {document.file_url ? (
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Link2 className="w-4 h-4 text-primary shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{document.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {document.file_name ?? document.link ?? ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {document.uploaded_on ? `Uploaded ${document.uploaded_on}` : ''}
                          </span>
                          {document.url && (
                            <a
                              href={document.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                              aria-label={`Download ${document.title}`}
                            >
                              <DownloadCloud className="w-4 h-4" />
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => detail.removeDocument(document.id)}
                            aria-label={`Remove ${document.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-3">Activity</h4>
                    {detail.history.length === 0 ? (
                      <EmptyState
                        icon={<HistoryIcon className="w-8 h-8" />}
                        title="No activity yet"
                        description="Changes to this certification will appear here."
                        className="border-0"
                      />
                    ) : (
                      <div className="flex flex-col gap-3">
                        {detail.history.map((entry) => (
                          <div key={entry.id} className="flex gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                            <div>
                              <p className="text-sm text-foreground">{entry.description ?? entry.action}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {entry.by} - {entry.date}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {detail.audit.length > 0 && (
                    <div className="pt-4 border-t border-border">
                      <h4 className="text-sm font-bold text-foreground mb-3">Record audit</h4>
                      <div className="flex flex-col gap-2">
                        {detail.audit.map((entry) => (
                          <div key={entry.label} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{entry.label}</span>
                            <span className="font-semibold text-foreground">
                              {entry.by} - {entry.date}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <CertificationDialog
        open={certDialogOpen}
        onOpenChange={setCertDialogOpen}
        initial={editing}
        saving={saving}
        onSubmit={(payload) => (editing ? update(editing.id, payload) : create(payload))}
      />
      <RequirementDialog
        open={requirementDialogOpen}
        onOpenChange={setRequirementDialogOpen}
        departments={departmentOptions}
      />
      <DocumentDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        onSubmit={detail.addDocument}
      />
      <NoteDialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen} onSubmit={detail.addNote} />
    </div>
  )
}
