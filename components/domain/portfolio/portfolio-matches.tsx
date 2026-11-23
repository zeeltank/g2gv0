'use client'

import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NativeSelect } from '@/components/shared/scaffolds/form-field'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { confirmSameText, decidedSummary, formatMoney, matchesBanner, matchesToReview, VERDICT_HINT } from '@/lib/portfolio-list/model'
import { chipClass, BANNER_TONE } from '@/lib/portfolio-list/tones'
import { ApiError } from '@/services/core'
import type { MatchDecisionBody, MatchDecisionResult, MatchRow, MatchesData } from '@/services/product-master/portfolio-list-types'

/** "N products may be the same as sub-products", for an administrator, with the way in. Nothing is drawn when nothing needs a decision. */
export function MatchesBanner({ count, onReview }: { count: number; onReview: () => void }) {
  const text = matchesBanner(count)
  if (text === null) return null
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${BANNER_TONE.info}`}>
      <span><strong>{text}.</strong> Nothing merges until you confirm each pair.</span>
      <Button type="button" variant="outline" size="sm" onClick={onReview}>Review matches</Button>
    </div>
  )
}

/** What a decision says, for the notice above the list. */
export function decisionNotice(result: MatchDecisionResult['data'], match: MatchRow, survivorName: string, keptName: string): string {
  if (result.decision === 'same') {
    if (result.result === 'merged') return `“${match.name}” and “${survivorName}” are now one Sub-product named “${result.name ?? keptName}”.`
    return 'These two were already joined. Nothing changed.'
  }
  if (result.result === 'recorded') return `Kept apart: “${match.name}” is a different product from “${survivorName}”. It will not be suggested again.`
  return 'That pair was already decided. Nothing changed.'
}

function MatchRowView({ match, busy, error, onDecide }: {
  match: MatchRow
  busy: boolean
  error: string | null
  onDecide: (match: MatchRow, survivorId: number, nameKept: 'portfolio' | 'catalogue', decision: 'same' | 'different') => void
}) {
  const survivorId = useId()
  const keepId = useId()
  const candidate = match.candidate
  // The Sub-product it looks like: the best one, and (when the suggester found other close ones) a choice among them.
  const options = match.alternatives.length > 1 ? match.alternatives : candidate ? [{ masterId: candidate.masterId, offerCode: candidate.offerCode, name: candidate.name, score: match.score }] : []
  const [survivor, setSurvivor] = useState<number>(candidate?.masterId ?? 0)
  const [kept, setKept] = useState<'portfolio' | 'catalogue'>('portfolio')
  const survivorName = options.find((o) => o.masterId === survivor)?.name ?? candidate?.name ?? ''
  const price = formatMoney(match.price, match.currency)

  return (
    <TableRow data-match={match.itemMasterId} aria-busy={busy}>
      <TableCell>
        <div className="font-medium text-foreground">{match.name}</div>
        <div className="text-xs text-muted-foreground">
          {[match.type === 'service' ? 'Service' : 'Sub-product', match.sku, price].filter(Boolean).join(' · ')}
        </div>
        <div className="text-xs text-muted-foreground">Used on {match.usage.total ?? 0} {(match.usage.total ?? 0) === 1 ? 'record' : 'records'}</div>
      </TableCell>
      <TableCell>
        {options.length > 1 ? (
          <>
            <label htmlFor={survivorId} className="sr-only">Sub-product that {match.name} looks like</label>
            <NativeSelect id={survivorId} value={String(survivor)} disabled={busy} onChange={(event) => setSurvivor(Number(event.target.value))}>
              {options.map((o) => <option key={o.masterId} value={o.masterId}>{o.name}{o.offerCode ? ` (${o.offerCode})` : ''}</option>)}
            </NativeSelect>
          </>
        ) : (
          <div>
            <div className="font-medium text-foreground">{candidate?.name}</div>
            {candidate?.offerCode && <div className="font-mono text-xs text-muted-foreground">{candidate.offerCode}</div>}
          </div>
        )}
      </TableCell>
      <TableCell>
        <span className={chipClass(match.verdict === 'MATCH-HIGH' ? 'success' : 'pending')} title={VERDICT_HINT[match.verdict]}>{match.verdict}</span>
        {VERDICT_HINT[match.verdict] && <span className="ml-2 text-xs text-muted-foreground">{VERDICT_HINT[match.verdict]}</span>}
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {match.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </TableCell>
      <TableCell>
        <label htmlFor={keepId} className="sr-only">Name to keep for {match.name}</label>
        <NativeSelect id={keepId} value={kept} disabled={busy} onChange={(event) => setKept(event.target.value === 'catalogue' ? 'catalogue' : 'portfolio')}>
          <option value="portfolio">Sub-product name: {survivorName}</option>
          <option value="catalogue">CRM name: {match.name}</option>
        </NativeSelect>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => onDecide(match, survivor, kept, 'same')}>Same product</Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onDecide(match, survivor, kept, 'different')}>Different</Button>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        </div>
        {error && <p role="alert" className={`mt-2 rounded border p-2 text-xs ${BANNER_TONE.error}`}>{error}</p>}
      </TableCell>
    </TableRow>
  )
}

/**
 * The pair review (mock-up view 5): each entry sold in CRM that may be the same product as a Sub-product, with the reasons, the name to keep (the Sub-product's by
 * default) and two answers. Same product asks first and makes the two ONE record; Different only records the answer and the pair is not offered again. The verdict
 * words are the API's own. Only an administrator ever reaches this (the screen around it does not draw it for anybody else, and the API answers 403).
 */
export function MatchesReview({ data, loading, error, onRetry, onBack, decide, onDecided }: {
  data: MatchesData | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onBack: () => void
  decide: (body: MatchDecisionBody) => Promise<MatchDecisionResult>
  /** A decision was recorded: the lists around this read again and a sentence says what happened. */
  onDecided: (text: string) => void
}) {
  const { confirm, confirmDialog } = useConfirm()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})
  const rows = matchesToReview(data)

  const run = async (match: MatchRow, survivorId: number, nameKept: 'portfolio' | 'catalogue', decision: 'same' | 'different') => {
    const survivor = match.alternatives.find((a) => a.masterId === survivorId)?.name ?? match.candidate?.name ?? ''
    const keptName = nameKept === 'catalogue' ? match.name : survivor
    if (decision === 'same') {
      const ok = await confirm({ title: 'Are these the same product?', description: confirmSameText(match, keptName), confirmLabel: 'Same product', tone: 'default' })
      if (!ok) return
    }
    setBusyId(match.itemMasterId)
    setErrors((e) => ({ ...e, [match.itemMasterId]: '' }))
    try {
      const body: MatchDecisionBody = { itemMasterId: match.itemMasterId, survivorMasterId: survivorId, decision, ...(decision === 'same' ? { nameKept } : {}) }
      const answer = await decide(body)
      onDecided(decisionNotice(answer.data, match, survivor, keptName))
    } catch (reason) {
      const text = reason instanceof ApiError || reason instanceof Error ? reason.message : 'That could not be saved.'
      setErrors((e) => ({ ...e, [match.itemMasterId]: text }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="matches-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="matches-title" className="text-lg font-semibold text-foreground">Possible matches</h2>
          <p className="text-sm text-muted-foreground">You decide each pair. Confirming a pair keeps the entry that quotes, orders and invoices use and joins it to the Sub-product. Each decision is logged.</p>
        </div>
        <Button type="button" variant="outline" onClick={onBack}>Back to the list</Button>
      </div>

      {error && data === null && <ErrorState title="The matches could not be loaded" description={error} retry={onRetry} />}
      {!error && loading && data === null && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">Loading…</div>
      )}
      {data !== null && rows.length === 0 && (
        <EmptyState title="Nothing to decide" description="No product looks like a sub-product that is not already joined to it." />
      )}
      {data !== null && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <caption className="sr-only">Products that may be the same as sub-products</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Sold in CRM as</TableHead>
                <TableHead>Looks like this Sub-product</TableHead>
                <TableHead>Why</TableHead>
                <TableHead>Name to keep</TableHead>
                <TableHead>Your decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((match) => (
                <MatchRowView key={match.itemMasterId} match={match} busy={busyId === match.itemMasterId} error={errors[match.itemMasterId] || null} onDecide={(m, s, k, d) => void run(m, s, k, d)} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data !== null && data.decisions.length > 0 && (
        <details className="rounded-lg border border-border bg-card p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Decisions already made ({data.decisions.length})</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {data.decisions.map((d) => <li key={d.id}>{decidedSummary(d)}{d.decidedAt ? ` · ${d.decidedAt}` : ''}</li>)}
          </ul>
        </details>
      )}
      {confirmDialog}
    </section>
  )
}
