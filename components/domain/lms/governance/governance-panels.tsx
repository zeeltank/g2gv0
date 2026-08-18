'use client'

import React, { useState } from 'react'
import { Plus, Trash2, Edit2, Loader2, ShieldCheck, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { GovernanceState } from '@/hooks/use-governance'
import type {
  ContractState,
  Integration,
  IntegrationStatus,
  Trainer,
  TrainerType,
  Vendor,
} from '@/services/lms'

/* ─── Shared bits ──────────────────────────────────────────────────────────── */

/** A row of labelled inputs used by the inline add/edit forms. */
export function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

const CONTRACT_VARIANT: Record<ContractState, 'active' | 'pending' | 'error' | 'inactive'> = {
  open: 'inactive',
  active: 'active',
  expiring: 'pending',
  expired: 'error',
}

const INTEGRATION_VARIANT: Record<IntegrationStatus, 'active' | 'inactive' | 'error'> = {
  connected: 'active',
  disconnected: 'inactive',
  error: 'error',
}

/* ─── Roles & permission matrix ────────────────────────────────────────────── */

export function RolesPanel({ governance }: { governance: GovernanceState }) {
  const {
    roles, canAdminister, saving,
    matrixProfileId, matrix, matrixLoading, matrixDirty,
    loadMatrix, togglePermission, savePermissions,
    saveRole, removeRole,
  } = governance

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', description: '' })
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/10 p-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Roles</h3>
            <p className="text-xs text-muted-foreground">
              {roles.length} role{roles.length === 1 ? '' : 's'} in this institute
            </p>
          </div>
          {canAdminister && (
            <Button size="sm" className="gap-2" onClick={() => setAdding((v) => !v)}>
              <Plus className="size-4" /> Add Role
            </Button>
          )}
        </div>

        {adding && (
          <div className="flex flex-col gap-3 border-b border-border/60 bg-primary/5 p-4">
            <FormRow>
              <Field label="Role name">
                <Input
                  className="h-9"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Input
                  className="h-9"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>
            </FormRow>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={saving || !draft.name.trim()}
                onClick={() =>
                  void saveRole({ name: draft.name.trim(), description: draft.description }).then(
                    (r) => {
                      if (r.ok) {
                        setAdding(false)
                        setDraft({ name: '', description: '' })
                      }
                    },
                  )
                }
              >
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="font-semibold">Users</TableHead>
                <TableHead className="font-semibold">Menus visible</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="pr-4 text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow
                  key={role.id}
                  className={cn(
                    'hover:bg-muted/30',
                    matrixProfileId === role.id && 'bg-primary/5',
                  )}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{role.name}</span>
                      {role.description && (
                        <span className="text-xs text-muted-foreground">{role.description}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{role.user_count}</TableCell>
                  <TableCell>{role.permission_count}</TableCell>
                  <TableCell>
                    <StatusBadge variant={role.status ? 'active' : 'inactive'}>
                      {role.status ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => void loadMatrix(role.id)}
                      >
                        <ShieldCheck className="size-3.5" /> Permissions
                      </Button>
                      {canAdminister &&
                        (confirmDelete === role.id ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-destructive"
                              disabled={saving}
                              onClick={() =>
                                void removeRole(role.id).then(() => setConfirmDelete(null))
                              }
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => setConfirmDelete(null)}
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${role.name}`}
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDelete(role.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Permission matrix for the selected role */}
      {matrixProfileId !== null && (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/10 p-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Permission Matrix — {roles.find((r) => r.id === matrixProfileId)?.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Clearing &quot;View&quot; also clears add, edit and delete for that menu.
              </p>
            </div>
            {canAdminister && (
              <Button
                size="sm"
                className="gap-2"
                disabled={saving || !matrixDirty}
                onClick={() => void savePermissions()}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {matrixDirty ? 'Save Changes' : 'Saved'}
              </Button>
            )}
          </div>

          {matrixLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading menus…
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow className="hover:bg-muted">
                    <TableHead className="font-semibold">Menu</TableHead>
                    {(['View', 'Add', 'Edit', 'Delete'] as const).map((label) => (
                      <TableHead key={label} className="w-20 text-center font-semibold">
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell>
                        <span
                          className={cn(
                            'text-sm',
                            row.parent_id ? 'pl-4 text-muted-foreground' : 'font-semibold text-foreground',
                          )}
                        >
                          {row.menu_name}
                        </span>
                      </TableCell>
                      {(['can_view', 'can_add', 'can_edit', 'can_delete'] as const).map((field) => (
                        <TableCell key={field} className="text-center">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input accent-primary"
                            aria-label={`${row.menu_name} ${field}`}
                            checked={row[field]}
                            disabled={!canAdminister || (field !== 'can_view' && !row.can_view)}
                            onChange={() => togglePermission(row.id, field)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Trainers ─────────────────────────────────────────────────────────────── */

const EMPTY_TRAINER = {
  name: '', email: '', phone: '', trainer_type: 'internal' as TrainerType,
  vendor_id: '', specialisation: '', hourly_rate: '', currency: 'INR',
}

export function TrainersPanel({ governance }: { governance: GovernanceState }) {
  const { trainers, vendors, canAdminister, saving, saveTrainer, removeTrainer } = governance
  const [editing, setEditing] = useState<Trainer | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_TRAINER)

  const open = (trainer?: Trainer) => {
    if (trainer) {
      setEditing(trainer)
      setDraft({
        name: trainer.name,
        email: trainer.email ?? '',
        phone: trainer.phone ?? '',
        trainer_type: (trainer.trainer_type as TrainerType) ?? 'internal',
        vendor_id: trainer.vendor_id ? String(trainer.vendor_id) : '',
        specialisation: trainer.specialisation ?? '',
        hourly_rate: trainer.hourly_rate ? String(trainer.hourly_rate) : '',
        currency: trainer.currency ?? 'INR',
      })
    } else {
      setEditing(null)
      setDraft(EMPTY_TRAINER)
    }
    setAdding(true)
  }

  const submit = () =>
    void saveTrainer(
      {
        name: draft.name.trim(),
        email: draft.email || null,
        phone: draft.phone || null,
        trainer_type: draft.trainer_type,
        vendor_id: draft.vendor_id ? Number(draft.vendor_id) : null,
        specialisation: draft.specialisation || null,
        hourly_rate: draft.hourly_rate ? Number(draft.hourly_rate) : null,
        currency: draft.currency || null,
        status: true,
      },
      editing?.id,
    ).then((r) => {
      if (r.ok) {
        setAdding(false)
        setEditing(null)
      }
    })

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/10 p-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">Trainers</h3>
          <p className="text-xs text-muted-foreground">
            Internal staff and contracted external trainers
          </p>
        </div>
        {canAdminister && (
          <Button size="sm" className="gap-2" onClick={() => open()}>
            <Plus className="size-4" /> Add Trainer
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-3 border-b border-border/60 bg-primary/5 p-4">
          <FormRow>
            <Field label="Name">
              <Input className="h-9" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input className="h-9" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input className="h-9" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select
                options={[
                  { label: 'Internal', value: 'internal' },
                  { label: 'External', value: 'external' },
                ]}
                value={draft.trainer_type}
                onChange={(v) => setDraft({ ...draft, trainer_type: String(v) as TrainerType })}
              />
            </Field>
            <Field label="Vendor">
              <Select
                options={vendors.map((v) => ({ label: v.name, value: String(v.id) }))}
                value={draft.vendor_id}
                onChange={(v) => setDraft({ ...draft, vendor_id: String(v) })}
                placeholder="None"
              />
            </Field>
            <Field label="Specialisation">
              <Input className="h-9" value={draft.specialisation} onChange={(e) => setDraft({ ...draft, specialisation: e.target.value })} />
            </Field>
            <Field label="Hourly rate">
              <Input className="h-9" type="number" value={draft.hourly_rate} onChange={(e) => setDraft({ ...draft, hourly_rate: e.target.value })} />
            </Field>
          </FormRow>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving || !draft.name.trim()} onClick={submit}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? 'Update' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setEditing(null) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {trainers.length === 0 ? (
        <EmptyState
          title="No trainers yet"
          description="Add the people who deliver your sessions and courses."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">Trainer</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Vendor</TableHead>
                <TableHead className="font-semibold">Specialisation</TableHead>
                <TableHead className="font-semibold">Sessions</TableHead>
                <TableHead className="font-semibold">Rate</TableHead>
                <TableHead className="pr-4 text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainers.map((trainer) => (
                <TableRow key={trainer.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{trainer.name}</span>
                      <span className="text-xs text-muted-foreground">{trainer.email ?? '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={trainer.trainer_type === 'internal' ? 'active' : 'processing'}>
                      {trainer.trainer_type}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{trainer.vendor_name ?? '—'}</TableCell>
                  <TableCell>{trainer.specialisation ?? '—'}</TableCell>
                  <TableCell>{trainer.session_count}</TableCell>
                  <TableCell>
                    {trainer.hourly_rate ? `${trainer.currency ?? ''} ${trainer.hourly_rate}` : '—'}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {canAdminister && (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${trainer.name}`} className="size-8" onClick={() => open(trainer)}>
                          <Edit2 className="size-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${trainer.name}`}
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={saving}
                          onClick={() => void removeTrainer(trainer.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/* ─── Vendors ──────────────────────────────────────────────────────────────── */

const EMPTY_VENDOR = {
  name: '', vendor_code: '', contact_person: '', email: '', phone: '',
  service_type: '', contract_start: '', contract_end: '', contract_value: '', currency: 'INR',
}

export function VendorsPanel({ governance }: { governance: GovernanceState }) {
  const { vendors, canAdminister, saving, saveVendor, removeVendor } = governance
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_VENDOR)

  const open = (vendor?: Vendor) => {
    if (vendor) {
      setEditing(vendor)
      setDraft({
        name: vendor.name,
        vendor_code: vendor.vendor_code ?? '',
        contact_person: vendor.contact_person ?? '',
        email: vendor.email ?? '',
        phone: vendor.phone ?? '',
        service_type: vendor.service_type ?? '',
        contract_start: vendor.contract_start?.slice(0, 10) ?? '',
        contract_end: vendor.contract_end?.slice(0, 10) ?? '',
        contract_value: vendor.contract_value ? String(vendor.contract_value) : '',
        currency: vendor.currency ?? 'INR',
      })
    } else {
      setEditing(null)
      setDraft(EMPTY_VENDOR)
    }
    setAdding(true)
  }

  const submit = () =>
    void saveVendor(
      {
        name: draft.name.trim(),
        vendor_code: draft.vendor_code || null,
        contact_person: draft.contact_person || null,
        email: draft.email || null,
        phone: draft.phone || null,
        service_type: draft.service_type || null,
        contract_start: draft.contract_start || null,
        contract_end: draft.contract_end || null,
        contract_value: draft.contract_value ? Number(draft.contract_value) : null,
        currency: draft.currency || null,
        status: true,
      },
      editing?.id,
    ).then((r) => {
      if (r.ok) {
        setAdding(false)
        setEditing(null)
      }
    })

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/10 p-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">Vendors</h3>
          <p className="text-xs text-muted-foreground">Content and training suppliers</p>
        </div>
        {canAdminister && (
          <Button size="sm" className="gap-2" onClick={() => open()}>
            <Plus className="size-4" /> Add Vendor
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-3 border-b border-border/60 bg-primary/5 p-4">
          <FormRow>
            <Field label="Name">
              <Input className="h-9" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Vendor code">
              <Input className="h-9" value={draft.vendor_code} onChange={(e) => setDraft({ ...draft, vendor_code: e.target.value })} />
            </Field>
            <Field label="Contact person">
              <Input className="h-9" value={draft.contact_person} onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input className="h-9" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </Field>
            <Field label="Service type">
              <Select
                options={[
                  { label: 'Content', value: 'content' },
                  { label: 'Trainers', value: 'trainers' },
                  { label: 'Platform', value: 'platform' },
                  { label: 'Mixed', value: 'mixed' },
                ]}
                value={draft.service_type}
                onChange={(v) => setDraft({ ...draft, service_type: String(v) })}
                placeholder="Select"
              />
            </Field>
            <Field label="Contract value">
              <Input className="h-9" type="number" value={draft.contract_value} onChange={(e) => setDraft({ ...draft, contract_value: e.target.value })} />
            </Field>
            <Field label="Contract start">
              <Input className="h-9" type="date" value={draft.contract_start} onChange={(e) => setDraft({ ...draft, contract_start: e.target.value })} />
            </Field>
            <Field label="Contract end">
              <Input className="h-9" type="date" value={draft.contract_end} onChange={(e) => setDraft({ ...draft, contract_end: e.target.value })} />
            </Field>
          </FormRow>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving || !draft.name.trim()} onClick={submit}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? 'Update' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setEditing(null) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {vendors.length === 0 ? (
        <EmptyState title="No vendors yet" description="Add the suppliers you buy training from." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">Vendor</TableHead>
                <TableHead className="font-semibold">Service</TableHead>
                <TableHead className="font-semibold">Trainers</TableHead>
                <TableHead className="font-semibold">Contract</TableHead>
                <TableHead className="font-semibold">Value</TableHead>
                <TableHead className="pr-4 text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{vendor.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {vendor.contact_person ?? vendor.email ?? '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{vendor.service_type ?? '—'}</TableCell>
                  <TableCell>{vendor.trainer_count}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <StatusBadge variant={CONTRACT_VARIANT[vendor.contract_state] ?? 'inactive'}>
                        {vendor.contract_state}
                      </StatusBadge>
                      {vendor.days_to_expiry !== null && (
                        <span className="text-[11px] text-muted-foreground">
                          {vendor.days_to_expiry < 0
                            ? `${Math.abs(vendor.days_to_expiry)}d overdue`
                            : `${vendor.days_to_expiry}d left`}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {vendor.contract_value ? `${vendor.currency ?? ''} ${vendor.contract_value}` : '—'}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {canAdminister && (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${vendor.name}`} className="size-8" onClick={() => open(vendor)}>
                          <Edit2 className="size-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${vendor.name}`}
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={saving}
                          onClick={() => void removeVendor(vendor.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/* ─── Integrations ─────────────────────────────────────────────────────────── */

/**
 * Providers offered in the add form. This is a UI list, not seeded data: the
 * table stays empty until an admin actually configures one, so the page never
 * claims a connection that does not exist.
 */
const PROVIDERS = [
  { label: 'Google Workspace', value: 'google', category: 'sso' },
  { label: 'Microsoft Azure AD', value: 'azure', category: 'sso' },
  { label: 'Okta', value: 'okta', category: 'sso' },
  { label: 'Zoom', value: 'zoom', category: 'conferencing' },
  { label: 'Microsoft Teams', value: 'teams', category: 'conferencing' },
  { label: 'SCORM Cloud', value: 'scorm_cloud', category: 'content' },
]

export function IntegrationsPanel({ governance }: { governance: GovernanceState }) {
  const { integrations, canAdminister, saving, saveIntegration, removeIntegration } = governance
  const [adding, setAdding] = useState(false)
  const [provider, setProvider] = useState('')

  const available = PROVIDERS.filter((p) => !integrations.some((i) => i.provider === p.value))

  const toggleStatus = (integration: Integration) =>
    void saveIntegration(
      {
        provider: integration.provider,
        display_name: integration.display_name,
        category: integration.category,
        description: integration.description,
        status: integration.status === 'connected' ? 'disconnected' : 'connected',
      },
      integration.id,
    )

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/10 p-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">Integrations</h3>
          <p className="text-xs text-muted-foreground">
            Connection records only — no access tokens or API keys are stored here.
          </p>
        </div>
        {canAdminister && available.length > 0 && (
          <Button size="sm" className="gap-2" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-4" /> Add Integration
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex items-end gap-3 border-b border-border/60 bg-primary/5 p-4">
          <div className="flex-1">
            <Field label="Provider">
              <Select
                options={available.map((p) => ({ label: p.label, value: p.value }))}
                value={provider}
                onChange={(v) => setProvider(String(v))}
                placeholder="Select a provider"
              />
            </Field>
          </div>
          <Button
            size="sm"
            disabled={saving || !provider}
            onClick={() => {
              const picked = PROVIDERS.find((p) => p.value === provider)
              if (!picked) return
              void saveIntegration({
                provider: picked.value,
                display_name: picked.label,
                category: picked.category,
                status: 'disconnected',
              }).then((r) => {
                if (r.ok) {
                  setAdding(false)
                  setProvider('')
                }
              })
            }}
          >
            Add
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}

      {integrations.length === 0 ? (
        <EmptyState
          title="No integrations configured"
          description="Connect an identity provider, conferencing tool or content source."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-bold text-foreground">
                    {integration.display_name}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {integration.category ?? integration.provider}
                  </span>
                </div>
                <StatusBadge
                  variant={INTEGRATION_VARIANT[integration.status as IntegrationStatus] ?? 'inactive'}
                >
                  {integration.status}
                </StatusBadge>
              </div>

              {integration.last_error && (
                <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                  {integration.last_error}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                {integration.connected_at
                  ? `Connected ${new Date(integration.connected_at).toLocaleDateString()}`
                  : 'Never connected'}
              </p>

              {canAdminister && (
                <div className="mt-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    disabled={saving}
                    onClick={() => toggleStatus(integration)}
                  >
                    {integration.status === 'connected' ? 'Disconnect' : 'Connect'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${integration.display_name}`}
                    className="size-8 text-muted-foreground hover:text-destructive"
                    disabled={saving}
                    onClick={() => void removeIntegration(integration.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Audit logs ───────────────────────────────────────────────────────────── */

export function AuditPanel({ governance }: { governance: GovernanceState }) {
  const {
    auditLogs, auditMeta, auditFilters, auditAction, setAuditAction, auditPage, setAuditPage,
  } = governance

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/10 p-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">Audit Logs</h3>
          <p className="text-xs text-muted-foreground">
            {auditMeta.total} audit event{auditMeta.total === 1 ? '' : 's'} ·{' '}
            {auditMeta.journey_events} navigation event
            {auditMeta.journey_events === 1 ? '' : 's'}
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select
            options={[
              { label: 'All actions', value: '' },
              ...auditFilters.actions.map((a) => ({ label: a, value: a })),
            ]}
            value={auditAction}
            onChange={(v) => setAuditAction(String(v))}
          />
        </div>
      </div>

      {auditLogs.length === 0 ? (
        <EmptyState
          title="No audit events"
          description="Structured audit entries for this institute will appear here as changes are made."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">When</TableHead>
                  <TableHead className="font-semibold">Action</TableHead>
                  <TableHead className="font-semibold">Entity</TableHead>
                  <TableHead className="font-semibold">Actor</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="font-medium">{log.action ?? '—'}</TableCell>
                    <TableCell>
                      {log.entity_type ?? '—'}
                      {log.entity_id ? ` #${log.entity_id}` : ''}
                    </TableCell>
                    <TableCell>{log.actor_name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{log.source ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge variant={log.status === 'success' ? 'active' : 'inactive'}>
                        {log.status ?? 'n/a'}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 bg-muted/10 px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Page {auditMeta.current_page} of {auditMeta.last_page}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={auditPage <= 1}
                onClick={() => setAuditPage(auditPage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={auditPage >= auditMeta.last_page}
                onClick={() => setAuditPage(auditPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
