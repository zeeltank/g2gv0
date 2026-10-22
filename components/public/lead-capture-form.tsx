'use client'

/**
 * Sales & Marketing gap-closure, Wave 3: the actual public page a prospect
 * fills in - genuinely unauthenticated, no ProtectedLayout/GtgPageShell, no
 * sidebar, same "just a component" shape app/login/page.tsx already uses
 * for the one other page in this app that is deliberately reachable with no
 * session at all.
 */

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { GtgBrandMark } from '@/components/shell/gtg-brand-mark'
import { publicLeadCaptureService } from '@/services/public/lead-capture'

type Status = 'checking' | 'unavailable' | 'ready' | 'submitting' | 'submitted'

export function LeadCaptureForm({ publicKey }: { publicKey: string }) {
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', message: '', website: '' })

  useEffect(() => {
    let active = true
    publicLeadCaptureService.checkForm(publicKey)
      .then((res) => { if (active) setStatus(res.data.available ? 'ready' : 'unavailable') })
      .catch(() => { if (active) setStatus('unavailable') })
    return () => { active = false }
  }, [publicKey])

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.lastName.trim()) {
      setError('Please enter your name.')
      return
    }
    setStatus('submitting')
    setError('')
    try {
      await publicLeadCaptureService.submit(publicKey, {
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        message: form.message.trim() || undefined,
        website: form.website, // honeypot - a real visitor never touches this
      })
      setStatus('submitted')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.')
      setStatus('ready')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <GtgBrandMark size="md" />

        {status === 'checking' && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        )}

        {status === 'unavailable' && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">This form is not available right now.</p>
          </div>
        )}

        {status === 'submitted' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Thanks{form.firstName ? `, ${form.firstName}` : ''}!</p>
              <p className="text-sm text-muted-foreground">We will be in touch soon.</p>
            </div>
          </div>
        )}

        {(status === 'ready' || status === 'submitting') && (
          <div className="space-y-4">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Get in touch</h1>
              <p className="text-sm text-muted-foreground">Tell us a bit about yourself and we&apos;ll reach out.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lc-first-name">First Name</Label>
                <Input id="lc-first-name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} disabled={status === 'submitting'} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lc-last-name">Last Name *</Label>
                <Input id="lc-last-name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} disabled={status === 'submitting'} autoFocus />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lc-email">Email</Label>
              <Input id="lc-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={status === 'submitting'} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lc-phone">Phone</Label>
                <Input id="lc-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} disabled={status === 'submitting'} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lc-company">Company</Label>
                <Input id="lc-company" value={form.company} onChange={(e) => set('company', e.target.value)} disabled={status === 'submitting'} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lc-message">How can we help?</Label>
              <Textarea id="lc-message" rows={3} value={form.message} onChange={(e) => set('message', e.target.value)} disabled={status === 'submitting'} />
            </div>

            {/* Honeypot - visually hidden, off-screen, never tab-focusable by a real visitor; a bot that fills every field it finds in the DOM fills this too. */}
            <div className="absolute -left-[9999px] top-auto size-px overflow-hidden" aria-hidden="true">
              <Label htmlFor="lc-website">Leave this field blank</Label>
              <Input id="lc-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
            </div>

            {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

            <Button className="w-full" disabled={status === 'submitting' || !form.lastName.trim()} onClick={() => void submit()}>
              {status === 'submitting' && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              Submit
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
