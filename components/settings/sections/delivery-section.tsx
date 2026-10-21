'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, Mail, Pencil, Plus, Send, ShieldAlert, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLaravelContext } from '@/hooks/use-agentic'
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'
import { cn } from '@/lib/utils'
import { ConfirmDialog, SectionBlock, SectionEmpty, SectionError, SectionSkeleton } from './section-primitives'
import { SenderProfileModal } from './sender-profile-modal'
import { TestSendDialog } from './test-send-dialog'

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
 * ── THE TEST BUTTON ASKS WHERE, THROUGH THAT EXACT PROFILE ─────────────────
 *
 * `TestSendDialog` collects the address (blank defaults to the caller's own,
 * same as before this existed) - the message itself is still fixed server-
 * side, so this is a way to prove a mailbox works at a chosen address, not a
 * way to send arbitrary mail. It proves the RIGHT thing either way: the
 * backend resolves that one row's own credentials rather than the
 * platform's shared account, so Test actually tells you whether that
 * mailbox works.
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

  /*
   * EACH ROW'S OWN TEST, INDEPENDENTLY — same fix as People & Access's own
   * `busy`/`results` pair. A single `testingId`/`testResult` would freeze
   * every row's button behind whichever test is in flight, and a second
   * test would silently erase the first row's result before anyone read it.
   */
  const [testingIds, setTestingIds] = useState<ReadonlySet<string>>(() => new Set())
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [testDialogProfile, setTestDialogProfile] = useState<SenderProfile | null>(null)

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

  async function sendTest(profile: SenderProfile, address: string) {
    if (testingIds.has(profile.id)) return

    setTestingIds((current) => new Set(current).add(profile.id))
    setTestResults((current) => {
      const { [profile.id]: _dropped, ...rest } = current
      return rest
    })

    try {
      const context = resolveContext()
      const response = await apiClient.post<{ status: number; message: string }>(
        `/organization/delivery/profiles/${profile.id}/test`,
        { type: 'api', token: context.token, ...(address ? { to: address } : {}) },
      )

      setTestResults((current) => ({ ...current, [profile.id]: { ok: true, message: response.message } }))
    } catch (caught) {
      setTestResults((current) => ({
        ...current,
        [profile.id]: {
          ok: false,
          message: caught instanceof Error ? caught.message : 'The test could not be sent.',
        },
      }))
    } finally {
      setTestingIds((current) => {
        const next = new Set(current)
        next.delete(profile.id)
        return next
      })
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
      setTestResults((current) => {
        const { [deleteTarget.id]: _dropped, ...rest } = current
        return rest
      })
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
                {profiles.map((profile) => {
                  const result = testResults[profile.id]
                  const isTesting = testingIds.has(profile.id)

                  return (
                    <Fragment key={profile.id}>
                      <TableRow className={result ? 'border-b-0' : undefined}>
                        <TableCell className="font-medium text-foreground">{profile.label}</TableCell>
                        <TableCell>
                          {/*
                            * The organisation-wide default is structurally
                            * different from the rest - every module with no
                            * profile of its own falls back to this one - so
                            * it gets the one coloured badge instead of
                            * reading as just another row in the list.
                            */}
                          <Badge variant={profile.moduleKey === 'default' ? 'navy' : 'outline'}>
                            {profile.moduleLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="block text-foreground">{profile.fromAddress}</span>
                          <span className="block text-xs text-muted-foreground">
                            {profile.server}{profile.port !== null ? `:${profile.port}` : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          {profile.hasPassword ? (
                            <StatusBadge
                              variant="active"
                              icon={<Check className="size-3" aria-hidden="true" />}
                              label="Configured"
                            />
                          ) : (
                            <StatusBadge
                              variant="warning"
                              icon={<AlertCircle className="size-3" aria-hidden="true" />}
                              label="No password saved"
                              title="This profile cannot send until a password is added."
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Send a test from ${profile.label}`}
                              title="Send a test email"
                              disabled={isTesting}
                              onClick={() => setTestDialogProfile(profile)}
                            >
                              {isTesting ? (
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

                      {/*
                        * THIS PROFILE'S OWN RESULT, NOT A SHARED BANNER BELOW
                        * THE TABLE.
                        *
                        * A single result under the table only ever shows the
                        * LAST test sent - testing "Hiring" and then "CRM"
                        * silently replaced Hiring's answer before anyone had
                        * read it. Anchoring the message to its own row means
                        * testing two profiles in a row loses neither.
                        */}
                      {result && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="py-0 pb-3 pt-0">
                            <div
                              className={cn(
                                'flex items-start gap-2 rounded-lg p-3 text-sm',
                                result.ok
                                  ? 'bg-success/10 text-success'
                                  : 'bg-destructive/10 text-destructive',
                              )}
                            >
                              {result.ok ? (
                                <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                              ) : (
                                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                              )}
                              <span>{result.message}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
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

      <TestSendDialog
        isOpen={testDialogProfile !== null}
        onClose={() => setTestDialogProfile(null)}
        onSend={(address) => {
          const profile = testDialogProfile
          setTestDialogProfile(null)
          if (profile) void sendTest(profile, address)
        }}
        profileLabel={testDialogProfile?.label ?? ''}
        sending={testDialogProfile !== null && testingIds.has(testDialogProfile.id)}
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
