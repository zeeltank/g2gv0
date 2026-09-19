'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Eye, EyeOff, Loader2, LogOut, Monitor, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DataTable } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { accountService, type AccountSession } from '@/services/account'
import { ConfirmDialog, Field, SectionBlock, SectionSkeleton } from './section-primitives'

/**
 * SIGN-IN & SECURITY.
 *
 * ── CHANGING YOUR PASSWORD NEEDS YOUR CURRENT ONE ───────────────────────────
 *
 * Even though you are already signed in. A token left behind on a shared machine
 * is exactly the case this guards: holding a session should not be enough to
 * take the account permanently.
 *
 * ── THE SESSION LIST IS REAL, AND IT IS LONGER THAN PEOPLE EXPECT ───────────
 *
 * These are Sanctum access tokens, and `sanctum.expiration` is null, so a token
 * issued at any point in this product's life is still valid. On live there are
 * 5,338 of them across 53 people; one account holds 2,140. Nobody has ever been
 * able to see that, let alone end one.
 *
 * "Sign out everywhere else" is therefore the single most useful control on this
 * screen, and it is why it is a button rather than a line of small print.
 */
export function SecuritySection() {
  const resolveContext = useLaravelContext()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reveal, setReveal] = useState(false)
  const [changing, setChanging] = useState(false)
  const [passwordDone, setPasswordDone] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [sessions, setSessions] = useState<AccountSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionBusy, setSessionBusy] = useState<number | 'all' | null>(null)
  const [sessionNote, setSessionNote] = useState<string | null>(null)
  /*
   * Both session actions are irreversible and neither asked. Signing out
   * everywhere else can end thousands of tokens on one account, with no undo and
   * no list of what went.
   */
  const [confirming, setConfirming] = useState<'all' | number | null>(null)

  const loadSessions = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setSessionsLoading(false)
      return
    }

    setSessionsLoading(true)

    try {
      const response = await accountService.sessions(context)
      setSessions(response.data.sessions)
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void loadSessions()
    })
  }, [loadSessions])

  const strength = scorePassword(next)
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !changing

  async function changePassword() {
    setChanging(true)
    setPasswordError(null)
    setPasswordDone(null)

    try {
      const response = await accountService.changePassword(resolveContext(), current, next, confirm)

      setPasswordDone(response.message)
      setCurrent('')
      setNext('')
      setConfirm('')
      await loadSessions()
    } catch (caught) {
      setPasswordError(
        caught instanceof Error ? caught.message : 'Your password could not be changed.',
      )
    } finally {
      setChanging(false)
    }
  }

  async function endSession(id: number) {
    setSessionBusy(id)
    setSessionNote(null)

    try {
      const response = await accountService.endSession(resolveContext(), id)
      setSessionNote(response.message)
      await loadSessions()
    } catch (caught) {
      setSessionNote(caught instanceof Error ? caught.message : 'That device could not be signed out.')
    } finally {
      setSessionBusy(null)
    }
  }

  async function endOthers() {
    setSessionBusy('all')
    setSessionNote(null)

    try {
      const response = await accountService.endOtherSessions(resolveContext())
      setSessionNote(response.message)
      await loadSessions()
    } catch (caught) {
      setSessionNote(caught instanceof Error ? caught.message : 'Those devices could not be signed out.')
    } finally {
      setSessionBusy(null)
    }
  }

  const others = sessions.filter((session) => !session.current).length

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * THE SESSION LIST IS THE ONE THE COMPLAINT WAS ABOUT
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * "In the login history show the laptop name and device information rather
   * than api." Every one of the 4,955 live tokens was named `api-token`, which
   * the backend work fixed at the three minting sites. This is the other half:
   * making the names readable once they are there.
   *
   * It was three lines of prose per row — the device name on one, then "Last used
   * <date> · Signed in <date>" joined by a middot on the next, ragged left. The
   * question somebody brings to this screen is "which of these is old and not
   * mine", and answering it meant reading both dates out of a sentence, on every
   * row, with nothing aligned.
   *
   * As columns the dates line up under each other with `tabular-nums`, so a stale
   * session is visible without reading anything.
   *
   * ── AND THE SAME LIST-WIDE DISABLE BUG AS THE INVITE LIST ───────────────────
   *
   * `disabled={sessionBusy !== null}` disabled the Sign out button on all 25
   * rows while any one of them was in flight. Per row now — except while "Sign
   * out everywhere else" is running, when disabling them all IS correct, because
   * every one of those sessions is about to end anyway.
   */
  const sessionColumns = useMemo(
    () => [
      {
        id: 'name' as const,
        header: 'Device',
        render: (_value: unknown, session: AccountSession) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <Monitor className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {session.name || 'Unnamed device'}
              </span>
              {session.current && (
                <StatusBadge variant="processing" size="sm" className="shrink-0">
                  This device
                </StatusBadge>
              )}
            </span>
          </div>
        ),
      },
      {
        id: 'last_used_at' as const,
        header: 'Last used',
        render: (_value: unknown, session: AccountSession) => (
          <span className="block whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {session.last_used_at
              ? new Date(session.last_used_at).toLocaleString()
              : 'Never since it was created'}
          </span>
        ),
      },
      {
        id: 'created_at' as const,
        header: 'Signed in',
        render: (_value: unknown, session: AccountSession) => (
          <span className="block whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {session.created_at ? new Date(session.created_at).toLocaleDateString() : '—'}
          </span>
        ),
      },
      {
        id: 'expires_at' as const,
        // Borrowed field name for an action column: `Column.id` is `keyof T` and
        // this renders a button, never `expires_at`.
        header: 'End it',
        render: (_value: unknown, session: AccountSession) =>
          session.current ? (
            <span
              className="block whitespace-nowrap text-xs text-muted-foreground"
              title="You are using this one. Use Sign out in the menu to end it."
            >
              In use
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(session.id)}
              // Per row. `'all'` still disables everything, on purpose.
              disabled={sessionBusy === session.id || sessionBusy === 'all'}
              className="whitespace-nowrap text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {sessionBusy === session.id ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="size-4" aria-hidden="true" />
              )}
              Sign out
            </Button>
          ),
      },
    ],
    [sessionBusy],
  )

  return (
    <div className="space-y-6">
      <SectionBlock
        title="Change your password"
        description="You need your current password, even though you are already signed in."
      >
        {passwordError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertDescription>{passwordError}</AlertDescription>
          </Alert>
        )}

        {passwordDone && (
          <Alert variant="success" className="mb-4">
            <Check className="size-4" aria-hidden="true" />
            <AlertDescription>{passwordDone}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:max-w-md">
          <Field label="Current password" required>
            <Input
              type={reveal ? 'text' : 'password'}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>

          <Field label="New password" required hint="At least 8 characters, with letters and numbers.">
            <div className="relative">
              <Input
                type={reveal ? 'text' : 'password'}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setReveal((value) => !value)}
                aria-label={reveal ? 'Hide passwords' : 'Show passwords'}
                className="absolute inset-y-0 right-0 grid w-10 cursor-pointer place-items-center text-muted-foreground hover:text-foreground"
              >
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          {next.length > 0 && (
            <div className="flex items-center gap-3">
              <ProgressBar
                value={strength.percent}
                variant={strength.variant}
                size="md"
                className="flex-1"
                aria-label="How strong this password is"
              />
              <span className="w-24 shrink-0 text-xs text-muted-foreground">{strength.label}</span>
            </div>
          )}

          <Field label="Confirm new password" required>
            <Input
              type={reveal ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
            />
            {mismatch && (
              <p className="mt-1 text-xs text-destructive">Those two do not match.</p>
            )}
          </Field>

          <div>
            <Button onClick={changePassword} disabled={!canSubmit}>
              {changing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {changing ? 'Changing…' : 'Change password'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Every other signed-in device will be signed out. This one stays signed in.
          </p>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Where you are signed in"
        description="Each row is a device or browser holding a live session for your account."
      >
        {sessionNote && (
          <Alert className="mb-4">
            <Check className="size-4" aria-hidden="true" />
            <AlertDescription>{sessionNote}</AlertDescription>
          </Alert>
        )}

        {sessionsLoading && (
          <SectionSkeleton rows={3} />
        )}

        {!sessionsLoading && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">No sessions could be listed.</p>
        )}

        {!sessionsLoading && sessions.length > 0 && (
          <>
            {sessions.length > 20 && (
              <Alert className="mb-4">
                <ShieldAlert className="size-4" aria-hidden="true" />
                <AlertDescription>
                  You have {sessions.length} live sessions. Sessions in this product do not expire
                  on their own, so old ones from devices you no longer use stay valid. Signing out
                  everywhere else is a good idea.
                </AlertDescription>
              </Alert>
            )}

            {/*
              The overflow container is here: `DataTable` renders a bare table
              inside a bordered div with no overflow of its own, and four columns
              with two timestamps do not fit a narrow pane.
            */}
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <DataTable
                columns={sessionColumns}
                data={sessions.slice(0, 25)}
                getRowId={(session: AccountSession) => String(session.id)}
                density="compact"
                className="min-w-[38rem]"
              />
            </div>

            {sessions.length > 25 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing the 25 most recently used of {sessions.length}. &ldquo;Sign out everywhere
                else&rdquo; ends all of them.
              </p>
            )}

            {others > 0 && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setConfirming('all')}
                  disabled={sessionBusy !== null}
                >
                  {sessionBusy === 'all' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <LogOut className="size-4" aria-hidden="true" />
                  )}
                  Sign out everywhere else ({others})
                </Button>
              </div>
            )}
          </>
        )}
      </SectionBlock>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming === 'all' ? 'Sign out everywhere else?' : 'Sign out this device?'}
        description={
          confirming === 'all'
            ? `${others} other ${others === 1 ? 'device' : 'devices'} will be signed out immediately and will need to sign in again. This device stays signed in. It cannot be undone.`
            : 'That device will be signed out immediately and will need to sign in again. It cannot be undone.'
        }
        confirmLabel={confirming === 'all' ? `Sign out ${others}` : 'Sign out'}
        busy={sessionBusy !== null}
        onConfirm={() => {
          const target = confirming
          setConfirming(null)

          if (target === 'all') void endOthers()
          else if (typeof target === 'number') void endSession(target)
        }}
      />
    </div>
  )
}

/**
 * A hint, not a gate. The rule that decides is server-side and shared:
 * `PasswordController::rule()` — at least 8, with letters and numbers.
 */
/*
 * A VARIANT NAME, NOT A TAILWIND CLASS.
 *
 * This used to hand back `tone: 'bg-destructive'` for a hand-rolled bar whose
 * markup was character-for-character what `ui/progress-bar.tsx` already renders
 * — same `h-1.5` track, same `rounded-full transition-all duration-300` fill,
 * same three colours. Two implementations of one bar, and the local one had no
 * `role="progressbar"`, so a screen reader was told nothing about the strength
 * of the password being typed.
 */
function scorePassword(value: string): {
  percent: number
  label: string
  variant: 'default' | 'success' | 'warning' | 'destructive'
} {
  if (!value) return { percent: 0, label: '', variant: 'default' }

  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^\w\s]/.test(value)) score++

  if (score <= 2) return { percent: 33, label: 'Weak', variant: 'destructive' }
  if (score === 3) return { percent: 66, label: 'Reasonable', variant: 'warning' }

  return { percent: 100, label: 'Strong', variant: 'success' }
}
