'use client'

/**
 * Create/Edit dialog for one email sender profile - same shape as
 * create-email-template-modal.tsx (a null `profile` prop means "Create", a
 * real one means "Edit", same seeded-form-state pattern).
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'

type ModuleOption = { key: string; label: string }

type SenderProfile = {
  id: string
  label: string
  moduleKey: string
  moduleLabel: string
  fromAddress: string
  fromName: string | null
  server: string
  port: number | null
  hasPassword: boolean
  updatedAt: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  profile: SenderProfile | null
  modules: ModuleOption[]
  /** Modules already taken by another profile - excluded from the picker, except the one this profile already owns while editing. */
  usedModuleKeys: Set<string>
}

type Form = {
  label: string
  moduleKey: string
  fromAddress: string
  fromName: string
  server: string
  port: string
  password: string
}

const EMPTY: Form = { label: '', moduleKey: '', fromAddress: '', fromName: '', server: '', port: '587', password: '' }

export function SenderProfileModal({ isOpen, onClose, onSaved, profile, modules, usedModuleKeys }: Props) {
  const resolveContext = useLaravelContext()

  const [seededFrom, setSeededFrom] = useState<SenderProfile | null | 'unset'>('unset')
  const [form, setForm] = useState<Form>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== profile) {
    setSeededFrom(profile)
    setForm(profile
      ? {
          label: profile.label, moduleKey: profile.moduleKey, fromAddress: profile.fromAddress,
          fromName: profile.fromName ?? '', server: profile.server, port: profile.port !== null ? String(profile.port) : '587',
          password: '',
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const availableModules = modules.filter((m) => !usedModuleKeys.has(m.key) || m.key === profile?.moduleKey)

  const portNumber = Number(form.port)
  const valid = form.label.trim() !== ''
    && form.moduleKey !== ''
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.fromAddress.trim())
    && form.server.trim() !== ''
    && Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535
    && (profile?.hasPassword || form.password.trim() !== '')

  const submit = async () => {
    if (!valid) {
      setError('Fill in the required fields - a label, a module, a valid address, a server and a port.')
      return
    }

    const context = resolveContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const body = {
        type: 'api',
        token: context.token,
        label: form.label.trim(),
        module_key: form.moduleKey,
        from_address: form.fromAddress.trim(),
        from_name: form.fromName.trim() || undefined,
        server: form.server.trim(),
        port: portNumber,
        // Omitted entirely when blank on an edit, which the server reads as "keep it".
        ...(form.password ? { password: form.password } : {}),
      }

      const response = profile
        ? await apiClient.put<{ status: number; message: string }>(`/organization/delivery/profiles/${profile.id}`, body)
        : await apiClient.post<{ status: number; message: string }>('/organization/delivery/profiles', body)

      onSaved(response.message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That sender profile could not be saved.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{profile ? 'Edit Sender Profile' : 'New Sender Profile'}</DialogTitle>
          <DialogDescription>
            {profile
              ? 'Update which mailbox this module sends through.'
              : 'Give one module its own mailbox, or add an organisation-wide default.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="sp-label">Label *</Label>
            <Input id="sp-label" value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Hiring mailbox" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label>Module *</Label>
            <SearchableSelect
              value={form.moduleKey}
              onChange={(v) => set('moduleKey', v)}
              options={availableModules.map((m) => ({ value: m.key, label: m.label }))}
              placeholder={availableModules.length > 0 ? 'Choose a module…' : 'No modules left to assign'}
              disabled={availableModules.length === 0}
            />
            {availableModules.length === 0 ? (
              <p className="text-xs text-warning">
                Every module already has its own profile. Edit one of them instead, or remove one first.
              </p>
            ) : form.moduleKey === 'default' ? (
              <p className="text-xs text-muted-foreground">
                This becomes the organisation-wide fallback: every module with no profile of its own sends through it.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Every email that module sends will go through this mailbox. Each module can have at most one profile.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sp-from-address">Send from *</Label>
              <Input
                id="sp-from-address" type="email" value={form.fromAddress}
                onChange={(e) => set('fromAddress', e.target.value)} placeholder="hiring@yourcompany.com"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sp-from-name">Display name</Label>
              <Input id="sp-from-name" value={form.fromName} onChange={(e) => set('fromName', e.target.value)} placeholder="Optional - shown instead of the address" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sp-server">Server *</Label>
              <Input id="sp-server" value={form.server} onChange={(e) => set('server', e.target.value)} placeholder="smtp.gmail.com" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sp-port">Port *</Label>
              <Input id="sp-port" inputMode="numeric" value={form.port} onChange={(e) => set('port', e.target.value.replace(/\D/g, ''))} placeholder="587" />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sp-password">Password {profile?.hasPassword ? '' : '*'}</Label>
              <Input
                id="sp-password" type="password" autoComplete="new-password" value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={profile?.hasPassword ? '••••••••  (unchanged)' : 'For Gmail and most providers this is an app password'}
              />
              {profile?.hasPassword && (
                <p className="text-xs text-muted-foreground">Leave blank to keep the password already saved.</p>
              )}
            </div>
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !valid}>
            {submitting ? 'Saving…' : profile ? 'Save Changes' : 'Create Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
