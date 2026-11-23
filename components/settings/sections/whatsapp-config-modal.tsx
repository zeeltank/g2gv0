'use client'

/**
 * WhatsApp Business (Cloud API) Configuration Modal.
 *
 * Configures the organisation's Meta WhatsApp Cloud API credentials,
 * matching LMS K-12's `whatsapp_api` functionality and backed by G2G's
 * encrypted integration credentials vault (`g2g_integration_credentials`, provider_key = 'whatsapp').
 */

import { useState } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'

export interface WhatsAppConfig {
  id?: string
  user_whatsapp_no: string
  phone_number_id: string
  cloud_api_phone_number_id?: string
  access_token?: string
  cloud_api_access_token?: string
  has_access_token?: boolean
  api_version?: string
  webhook_verify_token?: string
  app_secret?: string
  is_active?: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  initialConfig?: WhatsAppConfig | null
}

const EMPTY_CONFIG: WhatsAppConfig = {
  user_whatsapp_no: '',
  phone_number_id: '',
  access_token: '',
  has_access_token: false,
  api_version: 'v25.0',
  webhook_verify_token: '',
  app_secret: '',
}

export function WhatsAppConfigModal({ isOpen, onClose, onSaved, initialConfig }: Props) {
  const resolveContext = useLaravelContext()

  const [seededFrom, setSeededFrom] = useState<WhatsAppConfig | null | 'unset'>('unset')
  const [form, setForm] = useState<WhatsAppConfig>(EMPTY_CONFIG)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== initialConfig) {
    setSeededFrom(initialConfig ?? null)
    setForm(
      initialConfig
        ? {
            ...EMPTY_CONFIG,
            ...initialConfig,
            phone_number_id: initialConfig.phone_number_id || initialConfig.cloud_api_phone_number_id || '',
            access_token: '',
          }
        : EMPTY_CONFIG,
    )
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof WhatsAppConfig>(key: K, value: WhatsAppConfig[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const isConfigured = Boolean(initialConfig?.has_access_token || initialConfig?.phone_number_id)

  const valid =
    form.user_whatsapp_no.trim() !== '' &&
    form.phone_number_id.trim() !== '' &&
    /^\d+$/.test(form.phone_number_id.trim()) &&
    (isConfigured || (form.access_token?.trim() ?? '') !== '')

  const submit = async () => {
    if (!valid) {
      setError('Please fill in the required fields: WhatsApp number, Phone number ID, and Access token.')
      return
    }

    const context = resolveContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')

    const payload: Record<string, string | number> = {
      type: 'api',
      token: context.token,
      user_whatsapp_no: form.user_whatsapp_no.trim(),
      phone_number_id: form.phone_number_id.trim(),
      api_version: form.api_version?.trim() || 'v25.0',
      is_active: form.is_active === false ? 0 : 1,
    }

    if (form.access_token?.trim()) {
      payload.access_token = form.access_token.trim()
    }

    try {
      const response = await apiClient.post<{ status: number; message: string }>('/organization/delivery/whatsapp', payload)
      onSaved(response.message || 'WhatsApp Business API configuration saved successfully.')
      onClose()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to save WhatsApp Business API settings.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="size-4" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>{initialConfig ? 'Edit WhatsApp Configuration' : 'Configure WhatsApp API'}</DialogTitle>
              <DialogDescription>
                Configure the WhatsApp Cloud API credentials used for messaging and dispatches.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="wa-business-num">
              WhatsApp number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wa-business-num"
              value={form.user_whatsapp_no}
              onChange={(e) => set('user_whatsapp_no', e.target.value)}
              placeholder="+919876543210"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Business number with country code.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wa-phone-id">
              Phone number ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wa-phone-id"
              value={form.phone_number_id}
              onChange={(e) => set('phone_number_id', e.target.value)}
              placeholder="e.g. 106950295847362"
            />
            <p className="text-xs text-muted-foreground">
              From your Meta App Dashboard &gt; WhatsApp &gt; API Setup &gt; Phone number ID (numeric).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wa-token">
              Access token {isConfigured ? '' : <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="wa-token"
              type="password"
              autoComplete="new-password"
              value={form.access_token ?? ''}
              onChange={(e) => set('access_token', e.target.value)}
              placeholder={
                initialConfig?.has_access_token
                  ? '••••••••  (unchanged)'
                  : 'Enter system user access token'
              }
            />
            {initialConfig?.has_access_token ? (
              <p className="text-xs text-muted-foreground">Leave blank to keep the token already saved.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Permanent System User token with <code className="rounded bg-muted px-1">whatsapp_business_messaging</code> permission.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wa-version">Graph API version</Label>
            <Input
              id="wa-version"
              value={form.api_version ?? 'v25.0'}
              onChange={(e) => set('api_version', e.target.value)}
              placeholder="v25.0"
            />
            <p className="text-xs text-muted-foreground">
              Meta Graph API version (default v25.0).
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-xs font-semibold text-foreground">Delivery Tracking &amp; Inbound Webhooks (Optional)</p>
            <div className="space-y-1.5">
              <Label htmlFor="wa-webhook-token">Webhook verify token</Label>
              <Input
                id="wa-webhook-token"
                type="password"
                value={form.webhook_verify_token ?? ''}
                onChange={(e) => set('webhook_verify_token', e.target.value)}
                placeholder="Choose a verify token for your Meta webhook"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-app-secret">Meta App Secret</Label>
              <Input
                id="wa-app-secret"
                type="password"
                value={form.app_secret ?? ''}
                onChange={(e) => set('app_secret', e.target.value)}
                placeholder="Meta App Secret for HMAC delivery signature checks"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || !valid}>
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : initialConfig ? (
              'Save changes'
            ) : (
              'Save configuration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
