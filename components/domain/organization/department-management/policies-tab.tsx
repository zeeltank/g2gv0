'use client'

import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  Clock,
  Copy,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectInput } from '../components'
import type { Department } from '@/lib/gtg-org-data'

export interface Policy {
  id: string
  name: string
  code: string
  status: string
  lastUpdated: string
  updatedBy: string
  description?: string
}

export const MOCK_POLICIES: Policy[] = [
  {
    id: 'pol-1',
    name: 'Code of Conduct',
    code: 'HR-COD-001',
    status: 'Active',
    lastUpdated: '09 Jun 2025',
    updatedBy: 'Sanjay Kapoor',
    description: 'Defines the expected standards of behaviour for all employees.',
  },
  {
    id: 'pol-2',
    name: 'Data Privacy & Retention',
    code: 'SEC-DSP-002',
    status: 'Active',
    lastUpdated: '15 May 2025',
    updatedBy: 'Kabir Khan',
    description: 'Governs the collection, storage and disposal of personal data.',
  },
  {
    id: 'pol-3',
    name: 'Remote Work & Connectivity',
    code: 'ENG-RWP-003',
    status: 'Draft',
    lastUpdated: '02 Jun 2025',
    updatedBy: 'Rahul Verma',
    description: 'Outlines eligibility and expectations for remote work arrangements.',
  },
  {
    id: 'pol-4',
    name: 'Leave & Attendance',
    code: 'HR-LAP-004',
    status: 'Active',
    lastUpdated: '28 May 2025',
    updatedBy: 'Priya Nair',
    description: 'Covers leave entitlements, accrual and attendance tracking.',
  },
]

type PolicyView = 'list' | 'add' | 'edit' | 'view'

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

function formatToday() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function PolicyCard({
  policy,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  menuRef,
  menuOpen,
  onToggleMenu,
}: {
  policy: Policy
  onView: (policy: Policy) => void
  onEdit: (policy: Policy) => void
  onDuplicate: (policy: Policy) => void
  onDelete: (policy: Policy) => void
  menuRef: (el: HTMLDivElement | null) => void
  menuOpen: boolean
  onToggleMenu: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ScrollText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{policy.name}</h3>
            <StatusBadge status={policy.status} size="sm" />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{policy.code}</p>
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <IconButton
            label={`More options for ${policy.name}`}
            icon={<MoreVertical className="size-4" />}
            onClick={onToggleMenu}
          />
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => onView(policy)}
              >
                <Eye className="size-4" />
                View policy
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => onEdit(policy)}
              >
                <Pencil className="size-4" />
                Edit policy
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => onDuplicate(policy)}
              >
                <Copy className="size-4" />
                Duplicate
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(policy)}
              >
                <Trash2 className="size-4" />
                Delete policy
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" />
          Last updated {policy.lastUpdated}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <User className="size-3.5" />
          Updated by {policy.updatedBy}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1"
          onClick={() => onView(policy)}
        >
          <Eye className="size-4" aria-hidden="true" />
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1"
          onClick={() => onEdit(policy)}
        >
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </Button>
      </div>
    </div>
  )
}

function PolicyForm({
  policy,
  onSubmit,
  onCancel,
}: {
  policy?: Policy
  onSubmit: (policy: Policy) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(policy?.name ?? '')
  const [code, setCode] = useState(policy?.code ?? '')
  const [status, setStatus] = useState(policy?.status ?? 'Draft')
  const [description, setDescription] = useState(policy?.description ?? '')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit({
      id: policy?.id ?? `pol-${Date.now()}`,
      name: name.trim(),
      code: (code.trim() || 'POL-NEW').toUpperCase(),
      status,
      lastUpdated: formatToday(),
      updatedBy: 'You',
      description: description.trim(),
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label htmlFor="policy-name" className="text-sm font-medium text-foreground">
          Policy Name
        </label>
        <Input
          id="policy-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Code of Conduct"
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="policy-code" className="text-sm font-medium text-foreground">
          Policy Code
        </label>
        <Input
          id="policy-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="e.g. HR-COD-001"
          className="h-10 font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="policy-status" className="text-sm font-medium text-foreground">
          Status
        </label>
        <SelectInput
          id="policy-status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'Active', label: 'Active' },
            { value: 'Draft', label: 'Draft' },
          ]}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="policy-description" className="text-sm font-medium text-foreground">
          Description
        </label>
        <Textarea
          id="policy-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Brief summary of this policy"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {policy ? 'Save Changes' : 'Create Policy'}
        </Button>
      </div>
    </form>
  )
}

function PolicyDetail({
  policy,
  onEdit,
  onBack,
}: {
  policy: Policy
  onEdit: (policy: Policy) => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ScrollText className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{policy.name}</h3>
            <StatusBadge status={policy.status} size="sm" />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{policy.code}</p>
        </div>
      </div>

      <dl className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium text-foreground">{policy.status}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Last updated</dt>
          <dd className="font-medium text-foreground">{policy.lastUpdated}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Updated by</dt>
          <dd className="font-medium text-foreground">{policy.updatedBy}</dd>
        </div>
      </dl>

      {policy.description && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Description</p>
          <p className="text-sm leading-6 text-muted-foreground">{policy.description}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={() => onEdit(policy)}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit Policy
        </Button>
      </div>
    </div>
  )
}

export function PoliciesTab({ department }: { department: Department }) {
  const [policies, setPolicies] = useState<Policy[]>(MOCK_POLICIES)
  const [view, setView] = useState<PolicyView>('list')
  const [selected, setSelected] = useState<Policy | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Policy | null>(null)
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

  const goToList = () => {
    setView('list')
    setSelected(null)
    setPendingDelete(null)
  }

  const handleAdd = (policy: Policy) => {
    setPolicies((current) => [policy, ...current])
    goToList()
  }

  const handleUpdate = (updated: Policy) => {
    setPolicies((current) =>
      current.map((policy) => (policy.id === updated.id ? updated : policy)),
    )
    goToList()
  }

  const handleDuplicate = (policy: Policy) => {
    const copy: Policy = {
      ...policy,
      id: `pol-${Date.now()}`,
      name: `${policy.name} (Copy)`,
      status: 'Draft',
      lastUpdated: formatToday(),
      updatedBy: 'You',
    }
    setPolicies((current) => [copy, ...current])
    setOpenMenu(null)
  }

  const confirmDelete = () => {
    if (pendingDelete) {
      setPolicies((current) => current.filter((policy) => policy.id !== pendingDelete.id))
      setPendingDelete(null)
    }
  }

  if (view === 'add' || view === 'edit') {
    const isEdit = view === 'edit'
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <IconButton label="Back to policies" icon={<ArrowLeft className="size-4" />} onClick={goToList} />
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isEdit ? 'Edit Policy' : 'Add Policy'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? 'Update the details for this policy.'
                : `Create a new policy for ${department.name}.`}
            </p>
          </div>
        </div>
        <PolicyForm
          policy={isEdit ? selected ?? undefined : undefined}
          onSubmit={isEdit ? handleUpdate : handleAdd}
          onCancel={goToList}
        />
      </div>
    )
  }

  if (view === 'view' && selected) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <IconButton label="Back to policies" icon={<ArrowLeft className="size-4" />} onClick={goToList} />
          <h3 className="text-base font-semibold text-foreground">Policy Details</h3>
        </div>
        <PolicyDetail
          policy={selected}
          onEdit={(policy) => {
            setSelected(policy)
            setView('edit')
          }}
          onBack={goToList}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">
          Policies ({policies.length})
        </h3>
        <Button size="sm" className="h-9 shrink-0" onClick={() => setView('add')}>
          <Plus className="size-4" aria-hidden="true" />
          Add Policy
        </Button>
      </div>

      {pendingDelete && (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">
            Delete <span className="font-medium">{pendingDelete.name}</span>? This action
            cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={confirmDelete}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {policies.map((policy) => (
          <PolicyCard
            key={policy.id}
            policy={policy}
            onView={(policy) => {
              setSelected(policy)
              setView('view')
            }}
            onEdit={(policy) => {
              setSelected(policy)
              setView('edit')
            }}
            onDuplicate={handleDuplicate}
            onDelete={(policy) => {
              setOpenMenu(null)
              setPendingDelete(policy)
            }}
            menuRef={(el) => {
              menuRefs.current[policy.id] = el
            }}
            menuOpen={openMenu === policy.id}
            onToggleMenu={() =>
              setOpenMenu((current) => (current === policy.id ? null : policy.id))
            }
          />
        ))}
      </div>
    </div>
  )
}
