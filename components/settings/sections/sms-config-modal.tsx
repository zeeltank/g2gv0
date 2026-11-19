'use client'

/**
 * SMS Gateway Configuration Modal.
 *
 * Configures the institute/organisation SMS gateway (URL template parameters),
 * matching LMS K-12's `manage_sms_api` functionality and backed by G2G's
 * encrypted integration credentials vault (`g2g_integration_credentials`, provider_key = 'sms').
 */

import { useState } from 'react'
import { Loader2, RadioTower } from 'lucide-react'
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

export interface SmsConfig {
  id?: string
  url: string
  pram: string
  mobile_var: string
  text_var: string
  last_var: string
  test_mobile_number?: string
  is_active?: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  initialConfig?: SmsConfig | null
}

const EMPTY_CONFIG: SmsConfig = {
  url: '',
  pram: '',
  mobile_var: '',
  text_var: '',
  last_var: '',
  test_mobile_number: '',
}

export function SmsConfigModal({ isOpen, onClose, onSaved, initialConfig }: Props) {
  const resolveContext = useLaravelContext()

  const [seededFrom, setSeededFrom] = useState<SmsConfig | null | 'unset'>('unset')
  const [form, setForm] = useState<SmsConfig>(EMPTY_CONFIG)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== initialConfig) {
    setSeededFrom(initialConfig ?? null)
    setForm(initialConfig ? { ...EMPTY_CONFIG, ...initialConfig } : EMPTY_CONFIG)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof SmsConfig>(key: K, value: SmsConfig[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const isValidUrl = (val: string) => {
    try {
      const parsed = new URL(val)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  const valid =
    form.url.trim() !== '' &&
    isValidUrl(form.url.trim()) &&
    form.pram.trim() !== '' &&
    form.mobile_var.trim() !== '' &&
    form.text_var.trim() !== ''

  const submit = async () => {
    if (!valid) {
      setError('Please fill in the required fields: URL, Parameter, Mobile variable, and Text variable.')
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
      const response = await apiClient.post<{ status: number; message: string }>('/organization/delivery/sms', {
        type: 'api',
        token: context.token,
        url: form.url.trim(),
        pram: form.pram.trim(),
        mobile_var: form.mobile_var.trim(),
        text_var: form.text_var.trim(),
        last_var: form.last_var.trim(),
        test_mobile_number: form.test_mobile_number?.trim() ?? '',
        is_active: form.is_active === false ? 0 : 1,
      })

      onSaved(response.message || 'SMS gateway configuration saved successfully.')
      onClose()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to save SMS gateway settings.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RadioTower className="size-4" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>{initialConfig ? 'Edit SMS Gateway' : 'Configure SMS Gateway'}</DialogTitle>
              <DialogDescription>
                Configure the institute SMS gateway URL and its request parameters.
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
            <Label htmlFor="sms-url">
              URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sms-url"
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://sms.provider.com/API/SendSMS.aspx?"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Gateway endpoint, e.g. https://sms.provider.com/API/SendSMS.aspx?
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sms-pram">
              Parameter <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sms-pram"
              value={form.pram}
              onChange={(e) => set('pram', e.target.value)}
              placeholder="UserID=user&pwd=password&senderid=SCHOLL"
            />
            <p className="text-xs text-muted-foreground">
              Static query string: credentials, sender id, message type.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sms-mobile-var">
                Mobile variable <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sms-mobile-var"
                value={form.mobile_var}
                onChange={(e) => set('mobile_var', e.target.value)}
                placeholder="&PhoneNumber="
              />
              <p className="text-xs text-muted-foreground">e.g. &PhoneNumber=</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sms-text-var">
                Text variable <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sms-text-var"
                value={form.text_var}
                onChange={(e) => set('text_var', e.target.value)}
                placeholder="&Text="
              />
              <p className="text-xs text-muted-foreground">e.g. &Text=</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sms-last-var">Last variable</Label>
            <Input
              id="sms-last-var"
              value={form.last_var}
              onChange={(e) => set('last_var', e.target.value)}
              placeholder="&templateid=…"
            />
            <p className="text-xs text-muted-foreground">
              Appended last, e.g. &templateid=…
            </p>
          </div>

          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <Label htmlFor="sms-test-mobile">Test mobile number (optional)</Label>
            <Input
              id="sms-test-mobile"
              value={form.test_mobile_number ?? ''}
              onChange={(e) => set('test_mobile_number', e.target.value)}
              placeholder="+919876543210"
            />
            <p className="text-xs text-muted-foreground">
              When set, &ldquo;Test connection&rdquo; will dispatch an actual test SMS to this number. When left blank, only a safe gateway reachability check is made.
            </p>
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
