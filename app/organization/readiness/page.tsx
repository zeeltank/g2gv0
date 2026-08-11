'use client'

/**
 * X-07d — READINESS GATES, the admin surface.
 *
 * ── FIRST OF ITS KIND ───────────────────────────────────────────────────────
 *
 * No other page under app/organization/ calls the Laravel API directly. There
 * was no fetch pattern to copy, so this one establishes it: the per-user Laravel
 * bundle comes from readLaravelSession() (written at login), and `token` plus
 * `sub_institute_id` travel as query parameters the way the API expects.
 *
 * The NEXT_PUBLIC_HP_* fallbacks that used to serve this purpose were removed
 * because they pinned every browser to sub_institute_id=1 behind one shared
 * bearer token. DO NOT REINTRODUCE THEM. If the session is absent the screen
 * says so and refuses; it never falls back to a tenant.
 *
 * ── THE CONFIRM DIALOG IS THE REQUIREMENT ───────────────────────────────────
 *
 * Acknowledging is the only action in this product that turns a working
 * capability OFF. The dialog therefore carries THE LOSS, THE DAYS REMAINING and
 * THE REASON. A generic "are you sure?" would be asking for consent to something
 * unstated, and an acknowledgement made without seeing the consequence is a
 * decision taken blind.
 *
 * `losing` arrives WITH each gate from the API, so this component cannot render
 * the button without it - the requirement is carried in the payload rather than
 * remembered from a document.
 */

import { useCallback, useEffect, useState } from 'react'
import { resolveApiBaseUrl } from '@/lib/api-config'
import { readLaravelSession } from '@/lib/laravel-session'

interface Gate {
  gate_key: string
  state: 'blocked' | 'at_risk' | 'ready'
  unit: 'percent' | 'count'
  value: number | null
  enable_threshold: number
  disable_threshold: number
  why: string | null
  days_remaining: number | null
  warning_days: number
  acknowledged_by: number | null
  acknowledged_at: string | null
  computed_at: string | null
  losing: string | null
  can_acknowledge: boolean
}

const LABEL: Record<string, string> = {
  reporting_coverage: 'Reporting coverage',
  task_hygiene: 'Task hygiene',
  capability_coverage: 'Capability coverage',
  jobrole_definition: 'Job roles defined',
  course_mapping: 'Course mapping',
}

/** NULL is NEVER COMPUTED. Rendering it as 0 would assert a measurement nobody took. */
function renderValue(g: Gate) {
  if (g.value === null) return 'not yet computed'
  return g.unit === 'count' ? `${g.value} roles` : `${g.value}%`
}

export default function ReadinessGatesPage() {
  const [gates, setGates] = useState<Gate[]>([])
  const [note, setNote] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<Gate | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const session = readLaravelSession()
    if (!session?.token) {
      // No fallback tenant. See the header comment.
      setError('No Laravel session. Sign in again to view readiness gates.')
      setLoading(false)
      return
    }

    try {
      const url = new URL(`${resolveApiBaseUrl()}/api/readiness/gates`)
      url.searchParams.set('token', session.token)
      url.searchParams.set('type', 'API')
      url.searchParams.set('user_profile_name', session.user_profile_name ?? '')

      const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
      const body = await res.json()

      if (res.status === 403) {
        setError('Readiness gates are visible to Admin and HR only.')
      } else if (!res.ok || !body.status) {
        setError(body.message || 'Could not load readiness gates.')
      } else {
        setGates(body.gates ?? [])
        setNote(body.note ?? '')
        setError(null)
      }
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function acknowledge(gate: Gate) {
    const session = readLaravelSession()
    if (!session?.token) return
    setBusy(true)
    try {
      const url = new URL(`${resolveApiBaseUrl()}/api/readiness/gates/acknowledge`)
      url.searchParams.set('token', session.token)
      url.searchParams.set('type', 'API')
      url.searchParams.set('user_profile_name', session.user_profile_name ?? '')
      url.searchParams.set('gate_key', gate.gate_key)

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const body = await res.json()
      if (!body.status) setError(body.message || 'The acknowledgement was refused.')
      setConfirming(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div data-testid="readiness-loading" className="p-8">Loading readiness gates…</div>

  return (
    <div className="p-8 space-y-6" data-testid="readiness-page">
      <header>
        <h1 className="text-2xl font-semibold">Readiness gates</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Each gate measures whether your data is complete enough for a capability to be
          worth switching on. A gate turns on by itself; it never turns off by itself.
        </p>
      </header>

      {note && (
        <p data-testid="readiness-note" className="text-xs text-muted-foreground border-l-2 pl-3">
          {note}
        </p>
      )}

      {error && (
        <div data-testid="readiness-error" className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {gates.map((g) => (
          <div key={g.gate_key} data-testid={`gate-${g.gate_key}`} className="rounded border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{LABEL[g.gate_key] ?? g.gate_key}</div>
                <div data-testid={`gate-${g.gate_key}-value`} className="text-sm text-muted-foreground">
                  {renderValue(g)}
                  {g.value !== null && (
                    <> · turns on at {g.enable_threshold}{g.unit === 'percent' ? '%' : ''} ·
                       at risk below {g.disable_threshold}{g.unit === 'percent' ? '%' : ''}</>
                  )}
                </div>
              </div>
              <span data-testid={`gate-${g.gate_key}-state`} className="text-xs uppercase tracking-wide">
                {g.state}
              </span>
            </div>

            {g.why && <p className="mt-2 text-sm">{g.why}</p>}

            {g.state === 'at_risk' && (
              <div className="mt-3 rounded bg-amber-50 p-3 text-sm">
                <strong>This capability is still on.</strong>{' '}
                {g.days_remaining !== null && g.days_remaining > 0
                  ? `It stays on for ${g.days_remaining} more day${g.days_remaining === 1 ? '' : 's'} unless you turn it off.`
                  : 'The warning period has ended. It stays on until you turn it off.'}
                <div className="mt-2">
                  <button
                    data-testid={`gate-${g.gate_key}-ack`}
                    disabled={!g.can_acknowledge}
                    onClick={() => setConfirming(g)}
                    className="rounded border px-3 py-1 disabled:opacity-40"
                  >
                    Turn this capability off
                  </button>
                </div>
              </div>
            )}

            {g.acknowledged_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                Turned off by user {g.acknowledged_by} on {g.acknowledged_at}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* THE CONFIRM DIALOG. Loss, days remaining, reason - never a bare "are you sure". */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div data-testid="readiness-confirm" className="max-w-lg rounded bg-white p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              Turn off {LABEL[confirming.gate_key] ?? confirming.gate_key}?
            </h2>

            <div data-testid="confirm-losing" className="rounded bg-red-50 p-3 text-sm">
              <strong>What you lose:</strong> {confirming.losing}
            </div>

            <p data-testid="confirm-reason" className="text-sm">
              <strong>Why it is at risk:</strong> {confirming.why}
            </p>

            <p data-testid="confirm-days" className="text-sm">
              <strong>Warning period:</strong>{' '}
              {confirming.days_remaining !== null && confirming.days_remaining > 0
                ? `${confirming.days_remaining} day(s) remaining of ${confirming.warning_days}`
                : `ended (${confirming.warning_days} day period)`}
            </p>

            <p className="text-xs text-muted-foreground">
              This is recorded against your name and the time you confirm it.
            </p>

            <div className="flex justify-end gap-2">
              <button data-testid="confirm-cancel" onClick={() => setConfirming(null)} className="rounded border px-3 py-1">
                Keep it on
              </button>
              <button
                data-testid="confirm-accept"
                disabled={busy}
                onClick={() => acknowledge(confirming)}
                className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-40"
              >
                {busy ? 'Turning off…' : 'Turn it off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
