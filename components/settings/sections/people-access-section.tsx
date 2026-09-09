'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  ClipboardCopy,
  Clock,
  Loader2,
  Mail,
  MailWarning,
  RefreshCw,
  UserCheck,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'
import { SectionBlock } from './section-primitives'

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

  const [busyId, setBusyId] = useState<number | null>(null)
  const [result, setResult] = useState<{
    id: number
    message: string
    link: string | null
    error: string | null
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
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
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function invite(person: PendingPerson) {
    setBusyId(person.id)
    setResult(null)
    setCopied(false)
    setError(null)

    try {
      const context = resolveContext()
      const response = await apiClient.post<InviteResponse>(
        `/employees-management/${person.id}/invite`,
        { type: 'api', token: context.token },
      )

      setResult({
        id: person.id,
        message: response.message,
        link: response.data.link,
        error: response.data.error,
      })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The invite could not be sent.')
    } finally {
      setBusyId(null)
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Clipboard blocked (an insecure origin, or a permissions policy). The
      // link is on screen in a selectable field, so this is not a dead end.
      setCopied(false)
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
        description="Everybody with an active account in this organisation who has not once logged in."
      >
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        )}

        {!loading && people.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
            <UserCheck className="mx-auto size-5 text-success" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-foreground">Everybody has signed in</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nobody in this organisation is holding an account they have never opened.
            </p>
          </div>
        )}

        {!loading && people.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {people.map((person) => (
              <li key={person.id} className="bg-background px-4 py-3">
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
                    disabled={busyId !== null || !person.email}
                    className="shrink-0"
                  >
                    {busyId === person.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : person.state === 'never_invited' ? (
                      <Mail className="size-4" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="size-4" aria-hidden="true" />
                    )}
                    {person.state === 'never_invited' ? 'Send invite' : 'Send again'}
                  </Button>
                </div>

                {result?.id === person.id && (
                  <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      {result.message}
                    </p>

                    {result.error && (
                      <p className="mt-2 flex items-start gap-2 text-xs text-destructive">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {result.error}
                      </p>
                    )}

                    {result.link && (
                      <>
                        <div className="mt-3 flex gap-2">
                          <Input
                            readOnly
                            value={result.link}
                            onFocus={(event) => event.currentTarget.select()}
                            className="font-mono text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(result.link!)}
                            className="shrink-0"
                          >
                            {copied ? (
                              <Check className="size-4" aria-hidden="true" />
                            ) : (
                              <ClipboardCopy className="size-4" aria-hidden="true" />
                            )}
                            {copied ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                          <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          This link works once and expires in {expiresHours} hours. Send it to them
                          yourself — it is shown here only because your organisation has no email
                          set up.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
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

      <Alert>
        <MailWarning className="size-4" aria-hidden="true" />
        <AlertDescription>
          Invites are emailed only where your organisation has email configured. Everywhere else
          the product hands you a link to pass on, rather than claiming to have sent something it
          did not.
        </AlertDescription>
      </Alert>
    </div>
  )
}

function StateBadge({ state }: { state: PendingPerson['state'] }) {
  const map = {
    never_invited: { label: 'Never invited', tone: 'bg-destructive/10 text-destructive' },
    invited: { label: 'Invite sent', tone: 'bg-primary/10 text-primary' },
    expired: { label: 'Invite expired', tone: 'bg-warning/15 text-warning' },
  } as const

  const badge = map[state]

  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        badge.tone,
      )}
    >
      {badge.label}
    </span>
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
    <div className="rounded-xl border border-border bg-background p-4">
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
