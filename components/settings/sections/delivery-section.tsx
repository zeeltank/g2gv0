'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, Mail, Pencil, Plus, Send, ShieldAlert, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLaravelContext } from '@/hooks/use-agentic'
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'
import { ConfirmDialog, SectionBlock, SectionEmpty, SectionError, SectionSkeleton } from './section-primitives'
import { SenderProfileModal } from './sender-profile-modal'

/**
 * EMAIL & SMS — one sender profile per module, instead of one mailbox for
 * the whole organisation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FROM ONE ROW TO ONE PER (ORGANISATION, MODULE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This screen used to edit a single `smtp_details` row directly. The
 * centralized, module-wise email sending work (gap-closure plan) turned that
 * into a list: Hiring can have its own mailbox, CRM its own, and anything
 * else falls back to the organisation's "default" profile - which itself
 * falls back to the platform's one shared account if nothing is configured
 * at all. See `App\Support\MailSender` (backend) for the resolution order.
 *
 * ── TWO SEPARATE REASONS EMAIL MIGHT NOT ARRIVE ─────────────────────────────
 *
 * Whether the platform PERMITS this organisation to send at all (the banner
 * below, from `/organization/delivery/options`), and whether a given module
 * has been told HOW (the profiles list). An administrator can only fix the
 * second one from here.
 *
 * ── THE TEST BUTTON SENDS TO YOU, THROUGH THAT EXACT PROFILE ───────────────
 *
 * No address field - same reasoning as before (mailing an arbitrary address
 * on demand from the organisation's mailbox is a relay with a login screen).
 * It now also proves the RIGHT thing: the backend resolves that one row's
 * own credentials rather than the platform's shared account, so Test
 * actually tells you whether that mailbox works.
 */

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

type OptionsResponse = { modules: ModuleOption[]; allowed: boolean; blocked_reason: string | null }
type ProfilesResponse = { profiles: SenderProfile[]; sms: { configured: boolean; endpoint: string | null; active: boolean } }

type DirtyReporter = {
  onDirtyChange?: (id: 'profile' | 'delivery' | 'organization' | 'policy', label: string, dirty: boolean) => void
}

export function DeliverySection({ onDirtyChange }: DirtyReporter = {}) {
  const resolveContext = useLaravelContext()

  const [options, setOptions] = useState<OptionsResponse | null>(null)
  const [profiles, setProfiles] = useState<SenderProfile[]>([])
  const [sms, setSms] = useState<ProfilesResponse['sms'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SenderProfile | null>(null)

  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<SenderProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  // This screen never leaves an unsaved draft on screen - every edit goes
  // through the modal's own Save, so there is nothing to guard here. Kept
  // for parity with every other section (always false) rather than removed,
  // so the shell's section-switch guard still has something to read.
  useUnsavedGuard(false)
  useEffect(() => {
    onDirtyChange?.('delivery', 'Email & SMS', false)
    return () => onDirtyChange?.('delivery', 'Email & SMS', false)
  }, [onDirtyChange])

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [optionsResponse, profilesResponse] = await Promise.all([
        apiClient.get<{ status: number; data: OptionsResponse }>('/organization/delivery/options', {
          type: 'api',
          token: context.token,
        }),
        apiClient.get<{ status: number; data: ProfilesResponse }>('/organization/delivery/profiles', {
          type: 'api',
          token: context.token,
        }),
      ])

      setOptions(optionsResponse.data)
      setProfiles(profilesResponse.data.profiles)
      setSms(profilesResponse.data.sms)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'These settings could not be loaded. They are available to administrators and HR.',
      )
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function sendTest(profile: SenderProfile) {
    setTestingId(profile.id)
    setTestResult(null)

    try {
      const context = resolveContext()
      const response = await apiClient.post<{ status: number; message: string }>(
        `/organization/delivery/profiles/${profile.id}/test`,
        { type: 'api', token: context.token },
      )

      setTestResult({ id: profile.id, ok: true, message: response.message })
    } catch (caught) {
      setTestResult({
        id: profile.id,
        ok: false,
        message: caught instanceof Error ? caught.message : 'The test could not be sent.',
      })
    } finally {
      setTestingId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const context = resolveContext()
      await apiClient.delete<{ status: number; message: string }>(
        `/organization/delivery/profiles/${deleteTarget.id}`,
        { type: 'api', token: context.token },
      )
      setDeleteTarget(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That sender profile could not be removed.')
    } finally {
      setDeleting(false)
    }
  }

  const usedModuleKeys = useMemo(() => new Set(profiles.map((p) => p.moduleKey)), [profiles])

  if (loading) {
    return <SectionSkeleton rows={3} />
  }

  if (error && profiles.length === 0 && !options) {
    return <SectionError title="These settings could not be loaded" description={error} onRetry={() => void load()} />
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* THE TWO REASONS, SEPARATELY. Only one of them is this administrator's to fix. */}
      {options && !options.allowed && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" aria-hidden="true" />
          <AlertDescription>
            <strong>Sending is switched off for this organisation.</strong> You can add and edit
            sender profiles below and they will be kept, but nothing will be sent until the
            platform operator enables it.
            {options.blocked_reason && (
              <span className="mt-1 block text-xs opacity-80">{options.blocked_reason}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <SectionBlock
        title="Email sender profiles"
        description="Give a module its own mailbox - Hiring, CRM, Sales Outreach - or leave everything on one organisation-wide default."
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add sender profile
          </Button>
        }
      >
        {profiles.length === 0 ? (
          <SectionEmpty
            icon={<Mail className="size-8" aria-hidden="true" />}
            title="No sender profiles yet"
            description="Until one is added, every module sends through the platform's own shared mailbox."
            action={
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Add sender profile
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Sends from</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium text-foreground">{profile.label}</TableCell>
                    <TableCell>
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {profile.moduleLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{profile.fromAddress}</TableCell>
                    <TableCell>
                      {profile.hasPassword ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <Check className="size-3.5" aria-hidden="true" />
                          Configured
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No password saved</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Send a test from ${profile.label}`}
                          title="Send myself a test"
                          disabled={testingId === profile.id}
                          onClick={() => void sendTest(profile)}
                        >
                          {testingId === profile.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Send className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${profile.label}`}
                          title="Edit"
                          onClick={() => { setEditing(profile); setModalOpen(true) }}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${profile.label}`}
                          title="Remove"
                          onClick={() => setDeleteTarget(profile)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {testResult && (
          <Alert variant={testResult.ok ? 'success' : 'destructive'} className="mt-4">
            {testResult.ok ? <Check className="size-4" aria-hidden="true" /> : <AlertCircle className="size-4" aria-hidden="true" />}
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          A password is never shown again once it is saved. Removing a profile returns that
          module to the organisation’s default sender.
        </p>
      </SectionBlock>

      <SectionBlock
        title="SMS"
        description="Used for one-time sign-in codes."
        badge={sms?.configured ? (sms.active ? 'Active' : 'Switched off') : 'Not set up'}
        badgeTitle={
          sms?.configured
            ? 'Configured by your platform operator.'
            : 'Sign-in by one-time code is unavailable until a provider is configured.'
        }
      >
        <p className="text-sm text-muted-foreground">
          {sms?.configured
            ? 'Your platform operator manages this. Sign-in by one-time code is available to this organisation.'
            : 'No provider is set up, so sign-in by one-time code is not available. Ask your platform operator to configure one — it cannot be edited here.'}
        </p>
      </SectionBlock>

      <SenderProfileModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); void load() }}
        profile={editing}
        modules={options?.modules ?? []}
        usedModuleKeys={usedModuleKeys}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Remove this sender profile?"
        description={
          deleteTarget
            ? `"${deleteTarget.label}" (${deleteTarget.moduleLabel}) will stop being used. That module falls back to the organisation’s default sender, or the platform’s shared mailbox if there is no default either.`
            : ''
        }
        confirmLabel="Remove"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
