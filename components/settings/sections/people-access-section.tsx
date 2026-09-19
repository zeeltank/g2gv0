'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, ClipboardCopy, Clock, Loader2, Mail, RefreshCw, UserCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'
import { SectionBlock, SectionEmpty, SectionSkeleton } from './section-primitives'

/**
 * PEOPLE & ACCESS — the tool that unstrands every account created so far.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PROBLEM THIS EXISTS FOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No employee created through Employee Directory could ever sign in.
 * `EmployeeFactory::create()` sets a random password nobody will ever know —
 * minted only because `tbluser.password` is NOT NULL — and the "invite" that
 * followed wrote a token to `password_reset_tokens` and returned
 * `['sent' => true]` with NO MAIL CALL IN IT. The add-employee sheet then told
 * the administrator "An invite was sent to {email}".
 *
 * Two things had to be true before this screen could be honest, and both now
 * are: the invite genuinely delivers, and when it cannot be emailed it hands
 * back a link to pass on by hand. Ten of eleven organisations have no SMTP
 * configured, so the link is not a fallback — it is the normal path.
 *
 * ── THE LINK IS SHOWN, NOT HIDDEN ───────────────────────────────────────────
 *
 * When an invite is emailed the server withholds the link deliberately: an
 * administrator who can read the reset link of somebody they emailed can take
 * that account. When email is not configured there is nobody to withhold it
 * from — the administrator IS the delivery mechanism — so it is returned and
 * shown here, once, to copy.
 */

type PendingPerson = {
  id: number
  name: string
  email: string | null
  employee_no: string | null
  created_at: string | null
  invited_at: string | null
  state: 'never_invited' | 'invited' | 'expired'
}

type PendingResponse = {
  status: number
  data: {
    people: PendingPerson[]
    /** How many rows are in `people` — the list is capped at 200. */
    listed: number
    /** True when the organisation has more stranded accounts than are listed. */
    truncated: boolean
    /*
     * `total` is counted across the WHOLE organisation, not from `people`. The
     * three state counts are of the listed rows only, because the state depends
     * on a per-row join.
     */
    counts: { total: number; never_invited: number; invited: number; expired: number }
    expires_hours: number
  }
}

type InviteResponse = {
  status: number
  message: string
  data: {
    invite: 'email' | 'link' | 'failed'
    link: string | null
    expires_hours: number
    /*
     * The only accurate explanation on the mail-failure path. `message` says
     * "Email is not set up for your organisation" whenever delivery is not
     * 'email', which is wrong when SMTP IS configured and the send threw - the
     * real reason is here and was being discarded.
     */
    error: string | null
  }
}

export function PeopleAccessSection() {
  const resolveContext = useLaravelContext()

  const [people, setPeople] = useState<PendingPerson[]>([])
  const [counts, setCounts] = useState<PendingResponse['data']['counts'] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [expiresHours, setExpiresHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * ONE INVITE USED TO FREEZE EVERY OTHER BUTTON ON THE PAGE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `busyId` was a single number and the button read `disabled={busyId !== null}`
   * — so inviting one person disabled the invite button of every person in the
   * list. On the live tenant this list runs to two hundred rows, and somebody
   * onboarding a department has to wait out each network round trip before they
   * can click the next name. Nothing about the request required that; it was a
   * single-valued piece of state used for a per-row decision.
   *
   * A Set instead, so each row is independently busy and three people can be
   * invited without waiting on each other.
   */
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set())

  /*
   * And the outcome is per person too. It was one `result`, so a second invite
   * erased the first one's panel — including its copyable link, which for the
   * eleven tenants with no mailbox is the ONLY way to invite anybody. Sending
   * two invites in a row silently destroyed the first link.
   */
  const [results, setResults] = useState<
    Record<
      number,
      { message: string; link: string | null; error: string | null; emailed: boolean }
    >
  >({})

  /** Which row's link was last copied — not a single boolean shared by all. */
  const [copied, setCopied] = useState<number | null>(null)

  /*
   * `quiet` exists because of what the loud version did after an invite.
   *
   * `invite()` ends with `await load()` to refresh the row's state, and `load()`
   * set `loading = true`, which renders the whole section as a skeleton. So the
   * panel holding the freshly minted invite link — the thing the person is
   * reaching for — disappeared for the length of a round trip and then came back.
   * On a slow connection that is seconds of the link simply not being there.
   *
   * A quiet reload updates the list in place and leaves what is on screen alone.
   */
  const load = useCallback(async (quiet = false) => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    if (!quiet) setLoading(true)
    setError(null)

    try {
      const response = await apiClient.get<PendingResponse>(
        '/employees-management/pending-access',
        { type: 'api', token: context.token },
      )

      setPeople(response.data.people)
      setCounts(response.data.counts)
      setTruncated(Boolean(response.data.truncated))
      setExpiresHours(response.data.expires_hours)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'This list could not be loaded. It is available to administrators and HR.',
      )
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function invite(person: PendingPerson) {
    // A double click should not send two invites — each one mints a fresh token
    // and invalidates the previous link, so the copy somebody already pasted
    // into a message would quietly stop working.
    if (busy.has(person.id)) return

    setBusy((current) => new Set(current).add(person.id))
    setCopied(null)
    setError(null)

    try {
      const context = resolveContext()
      const response = await apiClient.post<InviteResponse>(
        `/employees-management/${person.id}/invite`,
        { type: 'api', token: context.token },
      )

      setResults((current) => ({
        ...current,
        [person.id]: {
          message: response.message,
          link: response.data.link,
          error: response.data.error,
          emailed: response.data.invite === 'email',
        },
      }))

      // Quietly: see `load`. The link that just appeared must stay on screen.
      await load(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The invite could not be sent.')
    } finally {
      setBusy((current) => {
        const next = new Set(current)
        next.delete(person.id)
        return next
      })
    }
  }

  async function copyLink(personId: number, link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(personId)
    } catch {
      // Clipboard blocked (an insecure origin, or a permissions policy). The
      // link is on screen in a selectable field, so this is not a dead end.
      setCopied(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {counts && counts.total > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Cannot sign in"
            value={counts.total}
            tone="destructive"
            hint="Everybody in this organisation who has never once signed in."
          />
          <Stat
            label="Never invited"
            value={counts.never_invited}
            tone="destructive"
            hint={
              truncated
                ? 'Of those listed below.'
                : 'They have an account and no way to reach it.'
            }
          />
          <Stat
            label="Invite expired"
            value={counts.expired}
            tone="warning"
            hint={
              truncated ? 'Of those listed below.' : 'The link they hold no longer works.'
            }
          />
        </div>
      )}

      <SectionBlock
        title="Has never signed in"
        description="Everybody with an active account in this organisation who has not once logged in. Where your organisation has no mailbox set up, inviting somebody hands you a link to pass on instead of sending one."
      >
        {loading && (
          <SectionSkeleton rows={3} />
        )}

        {!loading && people.length === 0 && !error && (
          <SectionEmpty
            icon={<UserCheck className="size-6 text-success" aria-hidden="true" />}
            title="Everybody has signed in"
            description="Nobody in this organisation is holding an account they have never opened."
          />
        )}

        {!loading && people.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {people.map((person) => {
              // This person's own outcome, so a second invite elsewhere in the
              // list cannot take their link away.
              const outcome = results[person.id]

              return (
                /*
                 * SURFACE, NOT `bg-background`.
                 * ────────────────────────────────────────────────────────────
                 * These rows were `bg-background` inside a `bg-card` block, and
                 * the two tokens disagree about which way is up:
                 *
                 *     light:  --card 100%   --background 98%   (barely visible)
                 *     dark:   --card  7%    --background  4%   (much DARKER)
                 *
                 * So in light mode the rows were faint grey on white - the
                 * inverted hierarchy that made Settings look washed out - and in
                 * dark mode they punched a hole straight through the card.
                 *
                 * Inheriting the card is correct: `divide-y` already separates
                 * the rows, and `surface-muted` on hover is recessed in light and
                 * raised in dark, so it reads as a hover in both.
                 *
                 * A `/* *\/` comment and not the JSX `{/* *\/}` form: this sits
                 * at the head of a `return (`, where a braced JSX comment is a
                 * second sibling node and will not compile.
                 */
                <li
                  key={person.id}
                  className="px-4 py-3 transition-colors hover:bg-surface-muted"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        <span className="truncate">{person.name || person.email}</span>
                        <StateBadge state={person.state} />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {person.email ?? 'No email address on record'}
                        {person.employee_no && ` · ${person.employee_no}`}
                        {person.invited_at &&
                          ` · Invited ${new Date(person.invited_at).toLocaleDateString()}`}
                      </p>
                    </div>

                    <Button
                      variant={person.state === 'never_invited' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => invite(person)}
                      // Only THIS row, not all two hundred.
                      disabled={busy.has(person.id) || !person.email}
                      className="shrink-0"
                    >
                      {busy.has(person.id) ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : person.state === 'never_invited' ? (
                        <Mail className="size-4" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="size-4" aria-hidden="true" />
                      )}
                      {person.state === 'never_invited' ? 'Send invite' : 'Send again'}
                    </Button>
                  </div>

                  {outcome && (
                    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        {outcome.message}
                      </p>

                      {outcome.error && (
                        <p className="mt-2 flex items-start gap-2 text-xs text-destructive">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          {outcome.error}
                        </p>
                      )}

                      {outcome.link && (
                        <>
                          <div className="mt-3 flex gap-2">
                            <Input
                              readOnly
                              value={outcome.link}
                              onFocus={(event) => event.currentTarget.select()}
                              className="font-mono text-xs"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyLink(person.id, outcome.link!)}
                              className="shrink-0"
                            >
                              {copied === person.id ? (
                                <Check className="size-4" aria-hidden="true" />
                              ) : (
                                <ClipboardCopy className="size-4" aria-hidden="true" />
                              )}
                              {copied === person.id ? 'Copied' : 'Copy'}
                            </Button>
                          </div>
                          <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            {/*
                              * The link is now shown whether or not the email went.
                              *
                              * It used to be hidden on the email path, and that was
                              * the whole "send invite is not working" complaint: a
                              * mail send that returns without throwing is not proof
                              * of delivery, so the screen said "emailed" and gave
                              * the administrator nothing to fall back on when it
                              * never arrived.
                              */}
                            This link works once and expires in {expiresHours} hours.{' '}
                            {outcome.emailed
                              ? 'The email has gone as well — use this if it does not arrive.'
                              : 'Send it to them yourself: your organisation has no email set up.'}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/*
          * SAY WHEN THE LIST IS CAPPED.
          *
          * The counts used to be derived from this truncated list, so on an
          * organisation with more than 200 stranded accounts the screen reported
          * "200" as an absolute figure and the number never moved however many
          * invites were sent. `total` is now counted across the organisation and
          * the cap is stated, so the two can never be confused again.
          */}
        {!loading && truncated && counts && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the {people.length} most recently added of {counts.total}. Send these invites
            and the next batch will appear here.
          </p>
        )}
      </SectionBlock>

      {/*
        THIS BANNER IS GONE, AND WHAT IT SAID IS SAID BETTER ELSEWHERE.

        Forty-five words in a full-width Alert, at the BOTTOM of the section,
        on every single visit, explaining that invites are emailed only where
        email is configured.

        Two things were wrong with it. It was unconditional, so the majority of
        readers were being told about a state that did not apply to them. And the
        per-invite result panel above already says exactly this, at the only
        moment it matters and about the specific person just invited — either
        "The email has gone as well" or "Send it to them yourself: your
        organisation has no email set up."

        What the banner uniquely offered was setting the expectation BEFORE the
        first click, so that survives as one clause in the block description,
        where somebody reads it on the way to the button rather than after
        scrolling past it.
      */}
    </div>
  )
}

/**
 * The invite state, using the product's own badge.
 *
 * This was a private `{label, tone}` map with hand-written Tailwind — one of two
 * such maps in the settings area, while `ui/status-badge.tsx` already carried
 * `error` / `warning` / `pending` variants and was used nowhere here. Two badge
 * implementations means two things to restyle and two chances to drift.
 */
function StateBadge({ state }: { state: PendingPerson['state'] }) {
  const MAP = {
    never_invited: { variant: 'error', label: 'Never invited' },
    invited: { variant: 'processing', label: 'Invite sent' },
    expired: { variant: 'warning', label: 'Invite expired' },
  } as const

  const badge = MAP[state]

  return (
    <StatusBadge variant={badge.variant} size="sm" className="shrink-0">
      {badge.label}
    </StatusBadge>
  )
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint: string
  tone: 'default' | 'warning' | 'destructive'
}) {
  return (
    /*
     * `surface-muted`, because these tiles sit ON the pane, which is `bg-card`.
     *
     * `bg-background` is 98% in light against a 100% card - a 2% difference, so
     * the tiles were all but invisible - and 4% in dark against a 7% card, so
     * they were darker than the surface they sat on. `surface-muted` is recessed
     * in light and raised in dark, which is what a tile on a card should be in
     * each theme. It is also the token the house Table uses for its header, so
     * the two now agree.
     */
    <div className="rounded-xl border border-border bg-surface-muted p-4">
      <p
        className={cn(
          'text-2xl font-semibold tabular-nums',
          value === 0
            ? 'text-muted-foreground'
            : tone === 'destructive'
              ? 'text-destructive'
              : tone === 'warning'
                ? 'text-warning'
                : 'text-foreground',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
