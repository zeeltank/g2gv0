'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { checkSentence, classifyGateFailure, needsClaims, orderChecks, readReport, summarize, UNREADABLE_TEXT, verdict } from '@/lib/outreach/model'
import { CHECK_TONE, NOTE_TONE, SUMMARY_TONE } from '@/lib/outreach/tones'
import { GTM_MESSAGES, type GateFailure, type GateReport } from '@/lib/outreach/types'
import { gateService, type GateApi } from '@/services/outreach/gate-service'
import { fmtDate } from './gtm-shared'
import { OutreachClaims } from './outreach-claims'

/** A refused send, as the screen got it. `seq` changes with every refusal, so two refusals in a row both ask for a fresh list. */
export interface GateRefusal {
  seq: number
  message: string
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; report: GateReport; signature: string }
  | { kind: 'failed'; failure: GateFailure }

const BUTTON = 'rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50'

/**
 * The Checks section of a draft (slice 10b): whether the message passes the outreach checks and, for each one, Passed or Failed in words, the failing ones first.
 *
 * It READS. It asks the server to run the checks (a read-only evaluation that records a set and sends nothing) when the draft is opened, when the person presses
 * "Check again" and when a send was refused, and at no other time. It adds no control that sends, schedules or switches anything on.
 *
 * `signature` identifies what the checks read of the message (lib/outreach/model.ts messageSignature); when the message in the list has another one, the report
 * is shown as out of date. `dirty` says the person has unsaved edits, which the server cannot see, so a re-check would answer about the old text.
 */
export function OutreachChecks({
  messageId, signature, dirty, productId, refusal, api = gateService,
}: { messageId: number; signature: string; dirty: boolean; productId: number | null; refusal: GateRefusal | null; api?: GateApi }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [busy, setBusy] = useState(true)
  const asked = useRef(0)
  const current = useRef(signature)
  useEffect(() => { current.current = signature }, [signature])

  const check = useCallback(async () => {
    const seq = ++asked.current
    const readFor = current.current
    setBusy(true)
    try {
      const report = readReport(await api.checks(GTM_MESSAGES, messageId))
      if (seq === asked.current) setPhase(report ? { kind: 'ready', report, signature: readFor } : { kind: 'failed', failure: { kind: 'error', message: UNREADABLE_TEXT } })
    } catch (error) {
      if (seq === asked.current) setPhase({ kind: 'failed', failure: classifyGateFailure(error) })
    } finally {
      if (seq === asked.current) setBusy(false)
    }
  }, [api, messageId])

  // On open, and once more for each NEW refusal (its number goes up). Clearing a refusal asks nothing, and the guard also keeps React's development double-run
  // of effects from asking twice.
  const trigger = refusal?.seq ?? 0
  const ran = useRef<number | null>(null)
  useEffect(() => {
    if (ran.current !== null && trigger <= ran.current) return
    ran.current = trigger
    queueMicrotask(() => void check())
  }, [trigger, check])

  const report = phase.kind === 'ready' ? phase.report : null
  const summary = report ? summarize(report.checks, report.passed) : null
  const stale = phase.kind === 'ready' && phase.signature !== signature
  const retryable = phase.kind === 'failed' && phase.failure.kind !== 'unavailable'

  return (
    <section data-outreach-checks className="rounded-md border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Checks</h3>
        {(phase.kind === 'ready' || retryable) && (
          <button type="button" className={BUTTON} disabled={busy || (phase.kind === 'ready' && dirty)} onClick={() => void check()}>{phase.kind === 'ready' ? 'Check again' : 'Retry'}</button>
        )}
      </div>

      {refusal && (
        <div role="alert" data-checks-refusal className={`mb-2 rounded-md border p-2 text-sm ${SUMMARY_TONE.failed}`}>
          <p className="font-semibold">The send was refused.</p>
          <p className="break-words">{refusal.message}</p>
        </div>
      )}

      {phase.kind === 'loading' && <p role="status" data-checks-loading className="text-xs text-muted-foreground">Checking this message…</p>}

      {phase.kind === 'failed' && (
        <p data-checks-failed={phase.failure.kind} className={`rounded-md border p-2 text-sm ${NOTE_TONE}`}>{phase.failure.message}</p>
      )}

      {report && summary && (
        <>
          <p role="status" data-checks-summary={summary.passed ? 'passed' : 'failed'} className={`rounded-md border p-2 text-sm font-medium ${summary.passed ? SUMMARY_TONE.passed : summary.total === 0 ? SUMMARY_TONE.neutral : SUMMARY_TONE.failed}`}>
            {summary.line}
          </p>
          {report.checkedAt && <p className="mt-1 text-xs text-muted-foreground">Checked {fmtDate(report.checkedAt, true)}.</p>}
          {busy && <p role="status" data-checks-busy className="mt-1 text-xs text-muted-foreground">Checking again…</p>}
          {dirty && <p data-checks-unsaved className={`mt-2 rounded-md border p-2 text-sm ${NOTE_TONE}`}>You have unsaved changes. The checks read the saved message: save your changes, then press Check again.</p>}
          {!dirty && stale && <p data-checks-stale className={`mt-2 rounded-md border p-2 text-sm ${NOTE_TONE}`}>This message changed after these checks ran, so they may be out of date. Press Check again.</p>}
          {report.checks.length > 0 && (
            <ul className="mt-2 space-y-2">
              {orderChecks(report.checks).map((c, i) => (
                <li key={`${c.key}-${i}`} data-check-key={c.key} data-check-passed={c.passed ? 'true' : 'false'} className={`flex gap-2 rounded-md border p-2 text-sm ${c.passed ? CHECK_TONE.passed : CHECK_TONE.failed}`}>
                  {c.passed ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 flex-none" /> : <XCircle aria-hidden="true" className="mt-0.5 size-4 flex-none" />}
                  <div className="min-w-0">
                    <p className="break-words"><strong>{verdict(c)}:</strong> {checkSentence(c)}</p>
                    {c.detail !== '' && <p className="break-words text-xs text-muted-foreground">{c.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {needsClaims(report.checks) && <OutreachClaims key={productId ?? 'all'} productId={productId} api={api} />}
        </>
      )}
    </section>
  )
}
