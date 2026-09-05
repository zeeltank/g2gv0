'use client'

import { useEffect, useState, use } from 'react'
import {
  Building2, MapPin, Clock, CalendarDays, IndianRupee, CheckCircle2, XCircle, Link2Off,
} from 'lucide-react'
import { offerApi, CareersError, formatDeadline, type OfferResponse } from '@/lib/careers-api'

/**
 * A candidate answering their own offer. Public: no account, no login.
 *
 * `/offer` is a top-level segment, so `proxy.ts`'s protected-route list never
 * guards it, and the page mounts neither GtgAppShell nor GtgPageShell — both
 * require a Laravel token a candidate does not have.
 *
 * The whole page is one decision, so it is laid out as one: what you are being
 * offered, then two buttons. Declining asks for an optional reason because that
 * is useful to the hiring team and costs the candidate nothing.
 */
export default function OfferResponsePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [offer, setOffer] = useState<OfferResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [choice, setChoice] = useState<'accepted' | 'declined' | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null)

  useEffect(() => {
    let cancelled = false
    offerApi
      .show(token)
      .then((data) => {
        if (cancelled) return
        setOffer(data)
        setLoadError(null)
        if (data.already_decided === 'accepted' || data.already_decided === 'declined') {
          setDone(data.already_decided)
        }
      })
      .catch((cause) => {
        if (cancelled) return
        setLoadError(cause instanceof Error ? cause.message : 'This link could not be opened.')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [token])

  async function submit() {
    if (!choice) {
      setFormError('Please choose whether you are accepting or declining.')
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      await offerApi.respond(token, choice, note.trim() || undefined)
      setDone(choice)
    } catch (cause) {
      setFormError(
        cause instanceof CareersError
          ? cause.message
          : 'Your response could not be recorded. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="@container/offer mx-auto w-full max-w-2xl px-4 py-10 @2xl/offer:px-6 @2xl/offer:py-16">
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-40 rounded-xl bg-muted/50" />
          <div className="h-32 rounded-xl bg-muted/40" />
        </div>
      ) : loadError ? (
        <section className="rounded-xl border border-border bg-card p-8 text-center" role="alert">
          <Link2Off className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-foreground">This link cannot be opened</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{loadError}</p>
        </section>
      ) : offer ? (
        <>
          <header className="rounded-xl border border-border bg-card p-6 @2xl/offer:p-8">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Your offer
            </span>
            <h1 className="mt-1.5 text-2xl font-bold text-foreground @2xl/offer:text-3xl">
              {offer.position}
            </h1>
            {offer.organisation && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="size-3.5" aria-hidden="true" />
                {offer.organisation}
              </p>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
              <Fact icon={IndianRupee} label="Salary" value={offer.salary} numeric />
              <Fact icon={CalendarDays} label="Start date" value={formatDeadline(offer.start_date)} numeric />
              <Fact icon={MapPin} label="Location" value={offer.location} />
              <Fact icon={Clock} label="Type" value={offer.employment_type} />
            </dl>

            {offer.expires_at && !done && (
              <p className="mt-6 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
                Please reply by{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatDeadline(offer.expires_at)}
                </span>
                . This link works once.
              </p>
            )}
          </header>

          {done ? (
            <section
              className={`mt-4 rounded-xl border p-8 text-center ${
                done === 'accepted' ? 'border-success/30 bg-success/5' : 'border-border bg-card'
              }`}
              role="status"
            >
              {done === 'accepted' ? (
                <CheckCircle2 className="mx-auto mb-3 size-8 text-success" aria-hidden="true" />
              ) : (
                <XCircle className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
              )}
              <h2 className="text-base font-semibold text-foreground">
                {done === 'accepted' ? 'You have accepted this offer' : 'You have declined this offer'}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                {done === 'accepted'
                  ? `Thank you${offer.candidate_name ? `, ${offer.candidate_name}` : ''}. The hiring team has been notified and will be in touch about your first day.`
                  : 'Thank you for letting us know. The hiring team has been notified.'}
              </p>
            </section>
          ) : (
            <section className="mt-4 rounded-xl border border-border bg-card p-6 @2xl/offer:p-8">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Your response
              </h2>

              {/* Inside the form, above the choices. Never a toast. */}
              {formError && (
                <div
                  className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 @md/offer:grid-cols-2">
                <ChoiceButton
                  selected={choice === 'accepted'}
                  onClick={() => setChoice('accepted')}
                  tone="success"
                  icon={CheckCircle2}
                  title="Accept the offer"
                  description="You are happy to join on the start date above."
                />
                <ChoiceButton
                  selected={choice === 'declined'}
                  onClick={() => setChoice('declined')}
                  tone="muted"
                  icon={XCircle}
                  title="Decline the offer"
                  description="You will not be taking this role."
                />
              </div>

              {choice === 'declined' && (
                <div className="mt-4">
                  <span className="mb-1.5 block text-xs font-medium text-foreground">
                    Anything you would like to add? <span className="text-muted-foreground">(optional)</span>
                  </span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="It helps the team to know why, but you do not have to say."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={submitting || !choice}
                className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send my response'}
              </button>
              <p className="mt-2.5 text-center text-xs text-muted-foreground">
                This cannot be undone here — contact the hiring team if you change your mind.
              </p>
            </section>
          )}
        </>
      ) : null}
    </div>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
  numeric = false,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  value: string | null
  numeric?: boolean
}) {
  if (!value) return null
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden={true} />
        <span className={numeric ? 'tabular-nums' : undefined}>{value}</span>
      </dd>
    </div>
  )
}

function ChoiceButton({
  selected,
  onClick,
  tone,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  tone: 'success' | 'muted'
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'flex flex-col items-start rounded-lg border p-4 text-left transition-colors',
        selected
          ? tone === 'success'
            ? 'border-success/50 bg-success/5'
            : 'border-foreground/30 bg-muted/50'
          : 'border-border hover:bg-muted/30',
      ].join(' ')}
    >
      <Icon
        className={`mb-2 size-5 ${selected && tone === 'success' ? 'text-success' : 'text-muted-foreground'}`}
        aria-hidden={true}
      />
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="mt-0.5 text-xs text-muted-foreground">{description}</span>
    </button>
  )
}
