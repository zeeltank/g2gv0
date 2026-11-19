'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  RadioTower,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
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
import { SmsConfigModal, type SmsConfig } from './sms-config-modal'
import { SmsTestDialog } from './sms-test-dialog'
import { WhatsAppConfigModal, type WhatsAppConfig } from './whatsapp-config-modal'

/**
 * DELIVERY CHANNELS — Email, SMS & WhatsApp.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONSOLIDATED MULTI-CHANNEL DELIVERY MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. EMAIL SENDER PROFILES
 *    One mailbox per module (Hiring, CRM, GTM, HR, AI Reports, etc.) or a
 *    tenant-wide default mailbox stored in `smtp_details`. Supports real SMTP test
 *    sends to any address.
 *
 * 2. SMS GATEWAY
 *    Configures the HTTP SMS gateway URL template and parameters, matching LMS K-12's
 *    manage_sms_api setup. Persisted in `sms_api_details` with fallback / sync to
 *    `g2g_integration_credentials`. Provides full Add, Edit, Delete, Test, and Active/Inactive toggle.
 *
 * 3. WHATSAPP BUSINESS (CLOUD API)
 *    Configures Meta WhatsApp Cloud API credentials (phone number ID, token,
 *    API version), matching LMS K-12's whatsapp_api setup. Persisted in `whatapp_user_details`
 *    with fallback / sync to `g2g_integration_credentials`. Provides full Add, Edit, Delete,
 *    Test, and Active/Inactive toggle.
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

export type SmsConfigRecord = {
  id?: string
  configured: boolean
  url: string
  pram: string
  mobile_var: string
  text_var: string
  last_var: string
  test_mobile_number?: string
  is_active: boolean
  updated_at?: string | null
}

export type WhatsAppConfigRecord = {
  id?: string
  configured: boolean
  user_whatsapp_no: string
  phone_number_id: string
  has_access_token: boolean
  api_version: string
  is_active: boolean
  created_by_name?: string | null
  updated_at?: string | null
}

type OptionsResponse = { modules: ModuleOption[]; allowed: boolean; blocked_reason: string | null }
type ProfilesResponse = {
  profiles: SenderProfile[]
  sms: SmsConfigRecord | null
  whatsapp: WhatsAppConfigRecord | null
}

type DirtyReporter = {
  onDirtyChange?: (id: 'profile' | 'delivery' | 'organization' | 'policy', label: string, dirty: boolean) => void
}

export function DeliverySection({ onDirtyChange }: DirtyReporter = {}) {
  const resolveContext = useLaravelContext()

  const [options, setOptions] = useState<OptionsResponse | null>(null)
  const [profiles, setProfiles] = useState<SenderProfile[]>([])
  const [smsConfig, setSmsConfig] = useState<SmsConfigRecord | null>(null)
  const [waConfig, setWaConfig] = useState<WhatsAppConfigRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Email Profile state ───────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SenderProfile | null>(null)
  const [testingIds, setTestingIds] = useState<ReadonlySet<string>>(() => new Set())
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [testDialogProfile, setTestDialogProfile] = useState<SenderProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SenderProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── SMS state ─────────────────────────────────────────────────────────────
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [smsTestDialogOpen, setSmsTestDialogOpen] = useState(false)
  const [smsTesting, setSmsTesting] = useState(false)
  const [smsToggling, setSmsToggling] = useState(false)
  const [smsTestResult, setSmsTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [smsDeleting, setSmsDeleting] = useState(false)
  const [deleteSmsConfirmOpen, setDeleteSmsConfirmOpen] = useState(false)

  // ── WhatsApp state ────────────────────────────────────────────────────────
  const [waModalOpen, setWaModalOpen] = useState(false)
  const [waTesting, setWaTesting] = useState(false)
  const [waToggling, setWaToggling] = useState(false)
  const [waTestResult, setWaTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [waDeleting, setWaDeleting] = useState(false)
  const [deleteWaConfirmOpen, setDeleteWaConfirmOpen] = useState(false)

  useUnsavedGuard(false)
  useEffect(() => {
    onDirtyChange?.('delivery', 'Email, SMS & WhatsApp', false)
    return () => onDirtyChange?.('delivery', 'Email, SMS & WhatsApp', false)
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
          sub_institute_id: context.subInstituteId,
        }),
        apiClient.get<{ status: number; data: ProfilesResponse }>('/organization/delivery/profiles', {
          type: 'api',
          token: context.token,
          sub_institute_id: context.subInstituteId,
        }),
      ])

      setOptions(optionsResponse.data)
      setProfiles(profilesResponse.data.profiles || [])
      setSmsConfig(profilesResponse.data.sms && profilesResponse.data.sms.configured ? profilesResponse.data.sms : null)
      setWaConfig(profilesResponse.data.whatsapp && profilesResponse.data.whatsapp.configured ? profilesResponse.data.whatsapp : null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'These delivery settings could not be loaded. They are available to administrators and HR.',
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

  // ── Email Handlers ────────────────────────────────────────────────────────
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

  // ── SMS Handlers ──────────────────────────────────────────────────────────
  const isSmsConfigured = Boolean(smsConfig?.configured && smsConfig.url)

  const initialSmsConfig = useMemo<SmsConfig | null>(() => {
    if (!smsConfig) return null
    return {
      url: smsConfig.url || '',
      pram: smsConfig.pram || '',
      mobile_var: smsConfig.mobile_var || '',
      text_var: smsConfig.text_var || '',
      last_var: smsConfig.last_var || '',
      test_mobile_number: smsConfig.test_mobile_number || '',
      is_active: smsConfig.is_active,
    }
  }, [smsConfig])

  async function toggleSmsStatus() {
    if (!smsConfig) return
    const nextActive = !smsConfig.is_active
    setSmsToggling(true)
    setError(null)
    try {
      const context = resolveContext()
      await apiClient.put<{ status: number; message: string }>(
        '/organization/delivery/sms/status',
        {
          type: 'api',
          token: context.token,
          is_active: nextActive ? 1 : 0,
        },
      )
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update SMS gateway status.')
    } finally {
      setSmsToggling(false)
    }
  }

  async function runSmsTest(testMobile: string) {
    setSmsTesting(true)
    setSmsTestResult(null)
    setSmsTestDialogOpen(false)

    try {
      const context = resolveContext()
      const response = await apiClient.post<{ status: number; message: string }>(
        '/organization/delivery/sms/test',
        {
          type: 'api',
          token: context.token,
          test_mobile: testMobile,
          test_mobile_number: testMobile,
        },
      )
      setSmsTestResult({
        ok: response.status === 1,
        message: response.message,
      })
    } catch (cause: unknown) {
      setSmsTestResult({
        ok: false,
        message: cause instanceof Error ? cause.message : 'SMS test request failed.',
      })
    } finally {
      setSmsTesting(false)
    }
  }

  async function removeSms() {
    setSmsDeleting(true)
    try {
      const context = resolveContext()
      await apiClient.delete<{ status: number; message: string }>(
        '/organization/delivery/sms',
        { type: 'api', token: context.token },
      )
      setDeleteSmsConfirmOpen(false)
      setSmsTestResult(null)
      await load()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove SMS configuration.')
    } finally {
      setSmsDeleting(false)
    }
  }

  // ── WhatsApp Handlers ─────────────────────────────────────────────────────
  const isWaConfigured = Boolean(waConfig?.configured && (waConfig.phone_number_id || waConfig.user_whatsapp_no))

  const initialWaConfig = useMemo<WhatsAppConfig | null>(() => {
    if (!waConfig) return null
    return {
      user_whatsapp_no: waConfig.user_whatsapp_no || '',
      phone_number_id: waConfig.phone_number_id || '',
      has_access_token: waConfig.has_access_token,
      api_version: waConfig.api_version || 'v25.0',
      is_active: waConfig.is_active,
    }
  }, [waConfig])

  async function toggleWaStatus() {
    if (!waConfig) return
    const nextActive = !waConfig.is_active
    setWaToggling(true)
    setError(null)
    try {
      const context = resolveContext()
      await apiClient.put<{ status: number; message: string }>(
        '/organization/delivery/whatsapp/status',
        {
          type: 'api',
          token: context.token,
          is_active: nextActive ? 1 : 0,
        },
      )
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update WhatsApp API status.')
    } finally {
      setWaToggling(false)
    }
  }

  async function runWaTest() {
    setWaTesting(true)
    setWaTestResult(null)

    try {
      const context = resolveContext()
      const response = await apiClient.post<{ status: number; message: string }>(
        '/organization/delivery/whatsapp/test',
        {
          type: 'api',
          token: context.token,
        },
      )
      setWaTestResult({
        ok: response.status === 1,
        message: response.message,
      })
    } catch (cause: unknown) {
      setWaTestResult({
        ok: false,
        message: cause instanceof Error ? cause.message : 'WhatsApp test request failed.',
      })
    } finally {
      setWaTesting(false)
    }
  }

  async function removeWa() {
    setWaDeleting(true)
    try {
      const context = resolveContext()
      await apiClient.delete<{ status: number; message: string }>(
        '/organization/delivery/whatsapp',
        { type: 'api', token: context.token },
      )
      setDeleteWaConfirmOpen(false)
      setWaTestResult(null)
      await load()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove WhatsApp configuration.')
    } finally {
      setWaDeleting(false)
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

      {/* Operator Sending Gate */}
      {options && !options.allowed && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" aria-hidden="true" />
          <AlertDescription>
            <strong>Sending is switched off for this organisation.</strong> You can add and edit
            sender profiles and gateways below, but nothing will be dispatched until the
            platform operator enables sending.
            {options.blocked_reason && (
              <span className="mt-1 block text-xs opacity-80">{options.blocked_reason}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ── 1. EMAIL SENDER PROFILES ───────────────────────────────────────── */}
      <SectionBlock
        title="Email sender profiles"
        description="Give each module its own dedicated mailbox (Hiring, CRM, Sales Outreach) or configure an organisation-wide default."
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

      {/* ── 2. SMS GATEWAY ─────────────────────────────────────────────────── */}
      <SectionBlock
        title="SMS Gateway"
        description="Configure your SMS HTTP gateway URL and query parameters. Powers CRM text notifications, AI report sends, and sign-in OTP codes."
        badge={!isSmsConfigured ? 'Not set up' : smsConfig?.is_active ? 'Active' : 'Inactive'}
        badgeTitle={
          !isSmsConfigured
            ? 'No SMS gateway configured. Add one to enable SMS notifications and OTP sign-in.'
            : smsConfig?.is_active
              ? 'Gateway configured and ready to send SMS.'
              : 'Gateway configured but currently inactive/paused.'
        }
        actions={
          <Button
            size="sm"
            onClick={() => setSmsModalOpen(true)}
          >
            {isSmsConfigured ? (
              <>
                <Pencil className="mr-1.5 size-4" aria-hidden="true" />
                Configure SMS
              </>
            ) : (
              <>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Configure SMS Gateway
              </>
            )}
          </Button>
        }
      >
        {!isSmsConfigured ? (
          <SectionEmpty
            icon={<RadioTower className="size-8 text-primary/70" aria-hidden="true" />}
            title="No SMS gateway configured yet"
            description="Configure your institute SMS gateway URL and request parameters (matching LMS K-12's SMS API Master setup) to enable SMS dispatches."
            action={
              <Button size="sm" onClick={() => setSmsModalOpen(true)}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Configure SMS Gateway
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Mobile variable</TableHead>
                    <TableHead>Text variable</TableHead>
                    <TableHead>Last variable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">
                      <span className="block font-medium text-foreground truncate max-w-xs" title={smsConfig?.url || ''}>
                        {smsConfig?.url || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[150px]" title={smsConfig?.pram || ''}>
                      {smsConfig?.pram || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{smsConfig?.mobile_var || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{smsConfig?.text_var || '—'}</TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[120px]" title={smsConfig?.last_var || ''}>
                      {smsConfig?.last_var || '—'}
                    </TableCell>
                    <TableCell>
                      {smsConfig?.is_active ? (
                        <StatusBadge
                          variant="active"
                          icon={<Check className="size-3" aria-hidden="true" />}
                          label="Active"
                        />
                      ) : (
                        <StatusBadge
                          variant="warning"
                          icon={<AlertCircle className="size-3" aria-hidden="true" />}
                          label="Inactive"
                          title="SMS gateway is deactivated. SMS dispatches are paused."
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={smsConfig?.is_active ? 'Deactivate SMS Gateway' : 'Activate SMS Gateway'}
                          title={smsConfig?.is_active ? 'Deactivate SMS Gateway' : 'Activate SMS Gateway'}
                          disabled={smsToggling}
                          onClick={() => void toggleSmsStatus()}
                        >
                          {smsToggling ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Power className={cn("size-4", smsConfig?.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Test SMS Gateway"
                          title="Test SMS connection / Send test SMS"
                          disabled={smsTesting}
                          onClick={() => setSmsTestDialogOpen(true)}
                        >
                          {smsTesting ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Send className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit SMS Gateway"
                          title="Edit SMS Gateway"
                          onClick={() => setSmsModalOpen(true)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove SMS Gateway"
                          title="Remove SMS Gateway"
                          onClick={() => setDeleteSmsConfirmOpen(true)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {smsTestResult && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg p-3 text-sm',
                  smsTestResult.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
                )}
              >
                {smsTestResult.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                )}
                <span>{smsTestResult.message}</span>
              </div>
            )}

            {smsConfig?.updated_at && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(smsConfig.updated_at).toLocaleString()}
              </p>
            )}

            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              Powers SMS notifications, AI report sends, and student/parent SMS communications via LMS K-12 SMS Gateway Master integration.
            </p>
          </div>
        )}
      </SectionBlock>

      {/* ── 3. WHATSAPP BUSINESS (CLOUD API) ───────────────────────────────── */}
      <SectionBlock
        title="WhatsApp Business (Cloud API)"
        description="Connect your organisation’s Meta WhatsApp Cloud API credentials to dispatch WhatsApp messages, automated template alerts, and AI reports."
        badge={!isWaConfigured ? 'Not set up' : waConfig?.is_active ? 'Active' : 'Inactive'}
        badgeTitle={
          !isWaConfigured
            ? 'No WhatsApp Business API credentials set up.'
            : waConfig?.is_active
              ? 'Connected to Meta WhatsApp Cloud API.'
              : 'WhatsApp Business API is configured but currently inactive/paused.'
        }
        actions={
          <Button
            size="sm"
            onClick={() => setWaModalOpen(true)}
          >
            {isWaConfigured ? (
              <>
                <Pencil className="mr-1.5 size-4" aria-hidden="true" />
                Configure WhatsApp
              </>
            ) : (
              <>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Configure WhatsApp
              </>
            )}
          </Button>
        }
      >
        {!isWaConfigured ? (
          <SectionEmpty
            icon={<MessageCircle className="size-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
            title="No WhatsApp Business API configured yet"
            description="Configure your WhatsApp Cloud API credentials (Phone Number ID and System User token) matching LMS K-12's setup to send template-approved messages directly from your WhatsApp number."
            action={
              <Button size="sm" onClick={() => setWaModalOpen(true)}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Configure WhatsApp
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WhatsApp number</TableHead>
                    <TableHead>Phone number ID</TableHead>
                    <TableHead>Access token</TableHead>
                    <TableHead>API Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-foreground">
                      {waConfig?.user_whatsapp_no || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {waConfig?.phone_number_id || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {waConfig?.has_access_token ? (
                        <span className="text-muted-foreground">••••••••</span>
                      ) : (
                        <span className="text-destructive">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {waConfig?.api_version || 'v25.0'}
                    </TableCell>
                    <TableCell>
                      {waConfig?.is_active ? (
                        <StatusBadge
                          variant="active"
                          icon={<Check className="size-3" aria-hidden="true" />}
                          label="Active"
                        />
                      ) : (
                        <StatusBadge
                          variant="warning"
                          icon={<AlertCircle className="size-3" aria-hidden="true" />}
                          label="Inactive"
                          title="WhatsApp Business API is deactivated. Messages will not be dispatched."
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={waConfig?.is_active ? 'Deactivate WhatsApp API' : 'Activate WhatsApp API'}
                          title={waConfig?.is_active ? 'Deactivate WhatsApp API' : 'Activate WhatsApp API'}
                          disabled={waToggling}
                          onClick={() => void toggleWaStatus()}
                        >
                          {waToggling ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Power className={cn("size-4", waConfig?.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Test WhatsApp connection"
                          title="Verify credentials with Meta"
                          disabled={waTesting}
                          onClick={() => void runWaTest()}
                        >
                          {waTesting ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Send className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit WhatsApp API"
                          title="Edit WhatsApp API"
                          onClick={() => setWaModalOpen(true)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove WhatsApp API"
                          title="Remove WhatsApp API"
                          onClick={() => setDeleteWaConfirmOpen(true)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {waTestResult && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg p-3 text-sm',
                  waTestResult.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
                )}
              >
                {waTestResult.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                )}
                <span>{waTestResult.message}</span>
              </div>
            )}

            {waConfig?.updated_at && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(waConfig.updated_at).toLocaleString()}
                {waConfig.created_by_name && ` — configured by ${waConfig.created_by_name}`}
              </p>
            )}

            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              Tokens are encrypted at rest in the credentials vault and never transmitted to the browser once configured.
            </p>
          </div>
        )}
      </SectionBlock>

      {/* ── Modals & Dialogs ─────────────────────────────────────────────────── */}
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

      <SmsConfigModal
        isOpen={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        onSaved={() => { void load() }}
        initialConfig={initialSmsConfig}
      />

      <SmsTestDialog
        isOpen={smsTestDialogOpen}
        onClose={() => setSmsTestDialogOpen(false)}
        onSend={(mobile) => void runSmsTest(mobile)}
        sending={smsTesting}
        defaultMobile={smsConfig?.test_mobile_number || ''}
      />

      <WhatsAppConfigModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        onSaved={() => { void load() }}
        initialConfig={initialWaConfig}
      />

      {/* Delete Email Profile Dialog */}
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

      {/* Delete SMS Gateway Dialog */}
      <ConfirmDialog
        open={deleteSmsConfirmOpen}
        onOpenChange={(open) => { if (!open) setDeleteSmsConfirmOpen(false) }}
        title="Remove SMS gateway configuration?"
        description="Removing this configuration will disable SMS alerts, CRM text notifications, and one-time sign-in code dispatches."
        confirmLabel="Remove SMS Gateway"
        busy={smsDeleting}
        onConfirm={() => void removeSms()}
      />

      {/* Delete WhatsApp API Dialog */}
      <ConfirmDialog
        open={deleteWaConfirmOpen}
        onOpenChange={(open) => { if (!open) setDeleteWaConfirmOpen(false) }}
        title="Remove WhatsApp configuration?"
        description="Removing this configuration will stop automated WhatsApp messages, AI report dispatches, and notification deliveries via Meta WhatsApp Cloud API."
        confirmLabel="Remove WhatsApp"
        busy={waDeleting}
        onConfirm={() => void removeWa()}
      />
    </div>
  )
}
