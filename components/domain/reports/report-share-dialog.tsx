'use client'

/**
 * The report page's actual Share action — previously wired to the same
 * handler as "Customize" (opened the builder wizard instead of any sharing
 * UI at all, a real bug reported live). Three genuinely different ways to
 * share a report, each backed by something that already exists elsewhere in
 * this codebase rather than a new concept per option:
 *
 * - "Share with a teammate" — per-person internal sharing
 *   (report_shares/ReportShareController), already fully built server-side
 *   since Phase 0; this dialog is its first-ever UI, modeled on
 *   document-share-dialog.tsx's own person-picker + role + remove pattern.
 * - "Email this report" — an ad hoc send-now
 *   (ReportEmailController::send/ReportAdHocMailer), reusing the exact CSV
 *   + mailer this app already sends scheduled report deliveries with
 *   (ScheduledReportMail) — "we already have email set up" meant this.
 * - "Share via WhatsApp or other apps" — there is no WhatsApp Business API
 *   in this project (confirmed: no integration exists, and
 *   config/platform_services.php explicitly excludes it) and the CSV export
 *   URL requires this user's own auth token, so it can't be handed to
 *   someone outside the ERP as a working link. What's real and always
 *   available without a vendor account: the OS-level share sheet
 *   (`navigator.share`, which DOES include WhatsApp as a target on a phone
 *   or any app that registered as a share target) when the browser supports
 *   it, a `wa.me` prefilled-text link as a universal fallback, and a
 *   copy-to-clipboard summary for pasting into literally anything else.
 */

import { useState } from 'react'
import { Check, Copy, Download, Loader2, Mail, MessageCircle, Share, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { reportBuilderService, type ReportDetail, type ReportShare } from '@/services/reports'
import { taskService } from '@/services/task'

const ROLE_OPTIONS = [
  { value: 'view', label: 'Viewer' },
  { value: 'edit', label: 'Editor' },
]

export function ReportShareDialog({ report, onClose }: { report: ReportDetail; onClose: () => void }) {
  const context = getLaravelContext()

  const [shares, setShares] = useState<ReportShare[]>([])
  const [sharesLoaded, setSharesLoaded] = useState(false)
  const [people, setPeople] = useState<SearchableOption[]>([])
  const [pickerUserId, setPickerUserId] = useState('')
  const [pickerRole, setPickerRole] = useState<'view' | 'edit'>('view')
  const [sharing, setSharing] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [peopleError, setPeopleError] = useState('')

  const [emailRecipients, setEmailRecipients] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailResult, setEmailResult] = useState<{ ok: boolean; text: string } | null>(null)

  const [copied, setCopied] = useState(false)
  const [nativeSharing, setNativeSharing] = useState(false)
  const [nativeShareError, setNativeShareError] = useState('')

  const loadPeople = () => {
    if (!isLaravelContextReady(context) || sharesLoaded) return

    Promise.all([
      reportBuilderService.listShares(context, report.id),
      taskService.getAssignmentUsers(context),
    ]).then(([sharesResponse, users]) => {
      setShares(sharesResponse.data.shares)
      setPeople(users.map((user) => ({
        value: String(user.id),
        label: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
      })))
      setSharesLoaded(true)
    }).catch((reason) => {
      setPeopleError(reason instanceof Error ? reason.message : 'Unable to load sharing for this report.')
    })
  }

  // Runs once on mount — this dialog is only ever mounted while `open`, so
  // there is no separate open/close transition to key a reset effect off.
  useState(() => { loadPeople() })

  const refreshShares = async () => {
    try {
      const response = await reportBuilderService.listShares(context, report.id)
      setShares(response.data.shares)
    } catch { /* the action that just ran still succeeded; the list just won't reflect it until reopened */ }
  }

  async function addShare() {
    if (!pickerUserId) return
    setSharing(true); setPeopleError('')
    try {
      await reportBuilderService.share(context, report.id, Number(pickerUserId), pickerRole === 'edit')
      setPickerUserId(''); setPickerRole('view')
      await refreshShares()
    } catch (reason) {
      setPeopleError(reason instanceof Error ? reason.message : 'Unable to share this report.')
    } finally {
      setSharing(false)
    }
  }

  async function changeRole(share: ReportShare, canEdit: boolean) {
    setPeopleError('')
    try {
      await reportBuilderService.share(context, report.id, share.viewer_user_id, canEdit)
      await refreshShares()
    } catch (reason) {
      setPeopleError(reason instanceof Error ? reason.message : 'Unable to change that role.')
    }
  }

  async function removeShare(share: ReportShare) {
    setRemovingId(share.id); setPeopleError('')
    try {
      await reportBuilderService.unshare(context, report.id, share.id)
      await refreshShares()
    } catch (reason) {
      setPeopleError(reason instanceof Error ? reason.message : 'Unable to remove that share.')
    } finally {
      setRemovingId(null)
    }
  }

  async function sendEmail() {
    const recipients = emailRecipients.split(/[,\n]/).map((r) => r.trim()).filter(Boolean)

    if (recipients.length === 0) {
      setEmailResult({ ok: false, text: 'Add at least one recipient email address.' })
      return
    }

    setSendingEmail(true); setEmailResult(null)
    try {
      const response = await reportBuilderService.sendEmail(context, report.id, recipients)
      setEmailResult({ ok: true, text: response.message || 'Sent.' })
      setEmailRecipients('')
    } catch (reason) {
      setEmailResult({ ok: false, text: reason instanceof Error ? reason.message : 'This report could not be emailed.' })
    } finally {
      setSendingEmail(false)
    }
  }

  const shareText = `${report.title}${report.description ? ` — ${report.description}` : ''} (open it in the ERP's Reports section to view the latest data)`

  async function shareNatively() {
    setNativeShareError('')

    if (typeof navigator === 'undefined' || !navigator.share) {
      setNativeShareError('Your browser does not support the native share sheet — try WhatsApp, copy, or download below instead.')
      return
    }

    setNativeSharing(true)
    try {
      // The export endpoint is this user's own authenticated fetch (the URL
      // carries their own token) — fine for attaching a file to THEIR OWN
      // share sheet, unlike handing the same URL to an external recipient
      // as a link, which would 401 for them.
      const canAttachFile = typeof navigator.canShare === 'function'
      let file: File | null = null

      if (canAttachFile) {
        const csvResponse = await fetch(reportBuilderService.exportUrl(context, report.id))
        const blob = await csvResponse.blob()
        const filename = `${report.title.replace(/[^A-Za-z0-9_-]+/g, '-')}.csv`
        const candidate = new File([blob], filename, { type: 'text/csv' })
        if (navigator.canShare({ files: [candidate] })) file = candidate
      }

      await navigator.share(file
        ? { title: report.title, text: shareText, files: [file] }
        : { title: report.title, text: shareText })
    } catch (reason) {
      // AbortError is the user dismissing the OS share sheet — not a failure.
      if (reason instanceof Error && reason.name !== 'AbortError') {
        setNativeShareError('Sharing was not completed.')
      }
    } finally {
      setNativeSharing(false)
    }
  }

  function shareViaWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard permission denied — the text is still visible on screen to select by hand */ }
  }

  const alreadySharedIds = new Set(shares.map((share) => share.viewer_user_id))
  const pickerOptions = people.filter((person) => !alreadySharedIds.has(Number(person.value)))

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate pr-6">Share &quot;{report.title}&quot;</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Share with a teammate</p>

            {peopleError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{peopleError}</p>}

            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  value={pickerUserId}
                  onChange={setPickerUserId}
                  options={pickerOptions}
                  placeholder="Add a person…"
                  searchPlaceholder="Search people…"
                  disabled={sharing}
                />
              </div>
              <div className="w-28 shrink-0">
                <Select value={pickerRole} onChange={(value) => setPickerRole(value as 'view' | 'edit')} options={ROLE_OPTIONS} disabled={sharing} />
              </div>
              <Button size="sm" disabled={!pickerUserId || sharing} onClick={() => void addShare()}>
                {sharing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : 'Add'}
              </Button>
            </div>

            {shares.length === 0 && sharesLoaded && (
              <p className="px-1 text-xs text-muted-foreground">Not shared with anyone else yet.</p>
            )}

            <div className="max-h-36 space-y-1 overflow-y-auto">
              {shares.map((share) => (
                <div key={share.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                  <span className="min-w-0 flex-1 truncate text-sm">{share.viewer_name}</span>
                  <div className="w-24 shrink-0">
                    <Select
                      value={share.can_edit ? 'edit' : 'view'}
                      onChange={(value) => void changeRole(share, value === 'edit')}
                      options={ROLE_OPTIONS}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Stop sharing with ${share.viewer_name}`}
                    onClick={() => void removeShare(share)}
                    disabled={removingId === share.id}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2 border-t border-border pt-3">
            <Label className="text-xs font-medium text-muted-foreground">Email this report (sends a CSV copy now)</Label>
            <textarea
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="someone@example.com, another@example.com"
            />
            {emailResult && (
              <Alert variant={emailResult.ok ? 'default' : 'destructive'}>
                <AlertDescription>{emailResult.text}</AlertDescription>
              </Alert>
            )}
            <Button size="sm" variant="outline" disabled={sendingEmail} onClick={() => void sendEmail()}>
              {sendingEmail ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Mail className="mr-1.5 size-4" aria-hidden="true" />}
              Send now
            </Button>
          </section>

          <section className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Share via WhatsApp or other apps</p>
            {nativeShareError && <p className="text-xs text-destructive">{nativeShareError}</p>}
            <div className="flex flex-wrap gap-2">
              {typeof navigator !== 'undefined' && !!navigator.share && (
                <Button size="sm" variant="outline" disabled={nativeSharing} onClick={() => void shareNatively()}>
                  {nativeSharing ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Share className="mr-1.5 size-4" aria-hidden="true" />}
                  Share…
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={shareViaWhatsApp}>
                <MessageCircle className="mr-1.5 size-4" aria-hidden="true" />
                WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => void copySummary()}>
                {copied ? <Check className="mr-1.5 size-4" aria-hidden="true" /> : <Copy className="mr-1.5 size-4" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy summary'}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={reportBuilderService.exportUrl(context, report.id)}>
                  <Download className="mr-1.5 size-4" aria-hidden="true" />
                  Download CSV
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A recipient needs their own ERP sign-in to open a shared report link — WhatsApp/copy share a text summary, not a clickable report.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
