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
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectInput } from '../components'
import type { Department } from '@/lib/gtg-org-data'

export interface Rule {
  id: string
  name: string
  code: string
  category: string
  status: string
  lastUpdated: string
  updatedBy: string
  description?: string
}

export const MOCK_RULES: Rule[] = [
  {
    id: 'rul-1',
    name: 'Leave Approval Threshold',
    code: 'RUL-LAT-001',
    category: 'Leave',
    status: 'Active',
    lastUpdated: '03 Jun 2025',
    updatedBy: 'Meera Iyer',
    description: 'Leaves up to 3 days are auto-approved by the reporting manager.',
  },
  {
    id: 'rul-2',
    name: 'Overtime Cap',
    code: 'RUL-OTC-002',
    category: 'Attendance',
    status: 'Active',
    lastUpdated: '21 May 2025',
    updatedBy: 'Rahul Verma',
    description: 'Weekly overtime is capped at 10 hours without director approval.',
  },
  {
    id: 'rul-3',
    name: 'Expense Auto-Approve',
    code: 'RUL-EXP-003',
    category: 'Finance',
    status: 'Draft',
    lastUpdated: '09 Jun 2025',
    updatedBy: 'Kabir Khan',
    description: 'Expenses below ₹2,000 are auto-approved for verified vendors.',
  },
  {
    id: 'rul-4',
    name: 'Remote Check-in Window',
    code: 'RUL-RCW-004',
    category: 'Attendance',
    status: 'Active',
    lastUpdated: '28 May 2025',
    updatedBy: 'Priya Nair',
    description: 'Remote check-in allowed between 08:00 and 11:00 IST.',
  },
]

const RULE_CATEGORIES = ['Leave', 'Attendance', 'Approval', 'Finance', 'Security']

type RuleView = 'list' | 'add' | 'edit' | 'view'

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

function RuleCard({
  rule,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  menuRef,
  menuOpen,
  onToggleMenu,
}: {
  rule: Rule
  onView: (rule: Rule) => void
  onEdit: (rule: Rule) => void
  onDuplicate: (rule: Rule) => void
  onDelete: (rule: Rule) => void
  menuRef: (el: HTMLDivElement | null) => void
  menuOpen: boolean
  onToggleMenu: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{rule.name}</h3>
            <StatusBadge status={rule.status} size="sm" />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {rule.code} <span className="mx-1">·</span> {rule.category}
          </p>
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <IconButton
            label={`More options for ${rule.name}`}
            icon={<MoreVertical className="size-4" />}
            onClick={onToggleMenu}
          />
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => onView(rule)}
              >
                <Eye className="size-4" />
                View rule
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => onEdit(rule)}
              >
                <Pencil className="size-4" />
                Edit rule
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => onDuplicate(rule)}
              >
                <Copy className="size-4" />
                Duplicate
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(rule)}
              >
                <Trash2 className="size-4" />
                Delete rule
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" />
          Last updated {rule.lastUpdated}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <User className="size-3.5" />
          Updated by {rule.updatedBy}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1"
          onClick={() => onView(rule)}
        >
          <Eye className="size-4" aria-hidden="true" />
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1"
          onClick={() => onEdit(rule)}
        >
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </Button>
      </div>
    </div>
  )
}

function RuleForm({
  rule,
  onSubmit,
  onCancel,
}: {
  rule?: Rule
  onSubmit: (rule: Rule) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(rule?.name ?? '')
  const [code, setCode] = useState(rule?.code ?? '')
  const [category, setCategory] = useState(rule?.category ?? RULE_CATEGORIES[0])
  const [status, setStatus] = useState(rule?.status ?? 'Draft')
  const [description, setDescription] = useState(rule?.description ?? '')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit({
      id: rule?.id ?? `rul-${Date.now()}`,
      name: name.trim(),
      code: (code.trim() || 'RUL-NEW').toUpperCase(),
      category,
      status,
      lastUpdated: formatToday(),
      updatedBy: 'You',
      description: description.trim(),
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label htmlFor="rule-name" className="text-sm font-medium text-foreground">
          Rule Name
        </label>
        <Input
          id="rule-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Leave Approval Threshold"
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="rule-code" className="text-sm font-medium text-foreground">
          Rule Code
        </label>
        <Input
          id="rule-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="e.g. RUL-LAT-001"
          className="h-10 font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="rule-category" className="text-sm font-medium text-foreground">
            Category
          </label>
          <SelectInput
            id="rule-category"
            value={category}
            onChange={setCategory}
            options={RULE_CATEGORIES.map((value) => ({ value, label: value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rule-status" className="text-sm font-medium text-foreground">
            Status
          </label>
          <SelectInput
            id="rule-status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Draft', label: 'Draft' },
            ]}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="rule-description" className="text-sm font-medium text-foreground">
          Rule Logic
        </label>
        <Textarea
          id="rule-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the trigger condition and resulting action"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {rule ? 'Save Changes' : 'Create Rule'}
        </Button>
      </div>
    </form>
  )
}

function RuleDetail({
  rule,
  onEdit,
  onBack,
}: {
  rule: Rule
  onEdit: (rule: Rule) => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{rule.name}</h3>
            <StatusBadge status={rule.status} size="sm" />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {rule.code} <span className="mx-1">·</span> {rule.category}
          </p>
        </div>
      </div>

      <dl className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium text-foreground">{rule.status}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Category</dt>
          <dd className="font-medium text-foreground">{rule.category}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Last updated</dt>
          <dd className="font-medium text-foreground">{rule.lastUpdated}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Updated by</dt>
          <dd className="font-medium text-foreground">{rule.updatedBy}</dd>
        </div>
      </dl>

      {rule.description && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Rule Logic</p>
          <p className="text-sm leading-6 text-muted-foreground">{rule.description}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={() => onEdit(rule)}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit Rule
        </Button>
      </div>
    </div>
  )
}

export function RulesTab({ department }: { department: Department }) {
  const [rules, setRules] = useState<Rule[]>(MOCK_RULES)
  const [view, setView] = useState<RuleView>('list')
  const [selected, setSelected] = useState<Rule | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null)
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

  const handleAdd = (rule: Rule) => {
    setRules((current) => [rule, ...current])
    goToList()
  }

  const handleUpdate = (updated: Rule) => {
    setRules((current) => current.map((rule) => (rule.id === updated.id ? updated : rule)))
    goToList()
  }

  const handleDuplicate = (rule: Rule) => {
    const copy: Rule = {
      ...rule,
      id: `rul-${Date.now()}`,
      name: `${rule.name} (Copy)`,
      status: 'Draft',
      lastUpdated: formatToday(),
      updatedBy: 'You',
    }
    setRules((current) => [copy, ...current])
    setOpenMenu(null)
  }

  const confirmDelete = () => {
    if (pendingDelete) {
      setRules((current) => current.filter((rule) => rule.id !== pendingDelete.id))
      setPendingDelete(null)
    }
  }

  if (view === 'add' || view === 'edit') {
    const isEdit = view === 'edit'
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <IconButton label="Back to rules" icon={<ArrowLeft className="size-4" />} onClick={goToList} />
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isEdit ? 'Edit Rule' : 'Create Rule'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? 'Update the details for this rule.'
                : `Define a new operational rule for ${department.name}.`}
            </p>
          </div>
        </div>
        <RuleForm
          rule={isEdit ? selected ?? undefined : undefined}
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
          <IconButton label="Back to rules" icon={<ArrowLeft className="size-4" />} onClick={goToList} />
          <h3 className="text-base font-semibold text-foreground">Rule Details</h3>
        </div>
        <RuleDetail
          rule={selected}
          onEdit={(rule) => {
            setSelected(rule)
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
          Rules ({rules.length})
        </h3>
        <Button size="sm" className="h-9 shrink-0" onClick={() => setView('add')}>
          <Plus className="size-4" aria-hidden="true" />
          Create Rule
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
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onView={(rule) => {
              setSelected(rule)
              setView('view')
            }}
            onEdit={(rule) => {
              setSelected(rule)
              setView('edit')
            }}
            onDuplicate={handleDuplicate}
            onDelete={(rule) => {
              setOpenMenu(null)
              setPendingDelete(rule)
            }}
            menuRef={(el) => {
              menuRefs.current[rule.id] = el
            }}
            menuOpen={openMenu === rule.id}
            onToggleMenu={() =>
              setOpenMenu((current) => (current === rule.id ? null : rule.id))
            }
          />
        ))}
      </div>
    </div>
  )
}
