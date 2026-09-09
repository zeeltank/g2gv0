'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Eye, EyeOff, Loader2, LogOut, Monitor, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { accountService, type AccountSession } from '@/services/account'
import { Field, SectionBlock } from './section-primitives'

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
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.tone}`}
                  style={{ width: `${strength.percent}%` }}
                />
              </div>
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
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
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

            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {sessions.slice(0, 25).map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-background px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Monitor className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                        {session.name || 'Unnamed device'}
                        {session.current && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            This device
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.last_used_at
                          ? `Last used ${new Date(session.last_used_at).toLocaleString()}`
                          : 'Never used since it was created'}
                        {session.created_at &&
                          ` · Signed in ${new Date(session.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>

                  {!session.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => endSession(session.id)}
                      disabled={sessionBusy !== null}
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {sessionBusy === session.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <LogOut className="size-4" aria-hidden="true" />
                      )}
                      Sign out
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            {sessions.length > 25 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing the 25 most recently used of {sessions.length}. &ldquo;Sign out everywhere
                else&rdquo; ends all of them.
              </p>
            )}

            {others > 0 && (
              <div className="mt-4 flex justify-end">
                <Button variant="outline" onClick={endOthers} disabled={sessionBusy !== null}>
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
    </div>
  )
}

/**
 * A hint, not a gate. The rule that decides is server-side and shared:
 * `PasswordController::rule()` — at least 8, with letters and numbers.
 */
function scorePassword(value: string) {
  if (!value) return { percent: 0, label: '', tone: 'bg-muted' }

  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^\w\s]/.test(value)) score++

  if (score <= 2) return { percent: 33, label: 'Weak', tone: 'bg-destructive' }
  if (score === 3) return { percent: 66, label: 'Reasonable', tone: 'bg-warning' }

  return { percent: 100, label: 'Strong', tone: 'bg-success' }
}
