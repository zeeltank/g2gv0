'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SectionCard } from '@/components/shared/business/shared'
import { FIELD_ERROR_TEXT } from '@/lib/org-accounts/tones'
import {
  describeChange, detailRows, docHref, DOC_KINDS, eventWord, formatMoney, icpStateLabel, latestDocs, STORE_WORD, usageCounts, whenWord, typeWord,
} from '@/lib/portfolio/page-model'
import { signalsHref } from '@/components/domain/crm/product-lines-model'
import type { IcpStates } from '@/lib/portfolio/icp-state'
import type { PmFullRecord, PmHistoryRow, PmPaging, PmSell, PmUsageFull } from '@/services/product-master/record-types'
import { IcpChip } from './portfolio-chips'
import { Fact } from './sub-product-overview'

const notice = (text: string, role: 'alert' | 'status' = 'status') => <p role={role} className={role === 'alert' ? `text-sm ${FIELD_ERROR_TEXT}` : 'text-sm text-muted-foreground'}>{text}</p>

// ============================================================================================================================ Details

/** The Details tab: every field of the old Products page, bundle-aware, with the picture beside it. A Service hides stock, demand, reorder level, vendor and weight. */
export function DetailsTab({ sell, name, assignee, inBin }: { sell: PmSell; name: string; assignee: string | null; inBin: boolean }) {
  const rows = detailRows(sell, assignee)
  return (
    <div className="space-y-4">
      {inBin && <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">This entry is in the Recycle Bin: it is not offered on new documents, and old documents still show it. Switch Sell in CRM on in Edit to bring it back.</p>}
      <SectionCard title={typeWord(sell.type) === 'Service' ? 'Service details' : 'Sub-product details'}>
        <div className="flex flex-wrap items-start gap-4">
          {sell.imageUrl && <img src={sell.imageUrl} alt={`${name} picture`} className="size-20 rounded-xl border border-border object-cover" />}
          <dl className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
            <Fact label="Number" value={sell.productNo && <span className="font-mono text-xs">{sell.productNo}</span>} />
            <Fact label="Type" value={typeWord(sell.type)} />
            {rows.map((row) => <Fact key={row.label} label={row.label} value={row.value} />)}
          </dl>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">The unit price is its base price. A price book can set another price on a quote.</p>
      </SectionCard>
    </div>
  )
}

// ============================================================================================================================ Usage

export function UsageTab({ usage, error, hrefs }: {
  usage: PmUsageFull | null
  error: string
  hrefs: { quotes: string; salesOrders: string; invoices: string; priceBooks: string }
}) {
  if (error) return notice(error, 'alert')
  if (!usage) return notice('Loading…')
  const counts = usageCounts(usage)
  const docHrefs = { quotes: hrefs.quotes, salesOrders: hrefs.salesOrders, invoices: hrefs.invoices }

  return (
    <div className="space-y-4">
      <SectionCard title="Where it is used">
        {counts.length === 0
          ? <p className="text-sm text-muted-foreground">Nothing counts its use on this server.</p>
          : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {counts.map((c) => (
                <div key={c.label} className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{c.label}</dt>
                  <dd className="text-lg font-semibold text-foreground">{String(c.value)}</dd>
                </div>
              ))}
            </dl>
          )}
        <p className="mt-3 text-xs text-muted-foreground">A document is counted once however many of its lines hold this sub-product. A document in the Recycle Bin is not counted.</p>
      </SectionCard>

      {DOC_KINDS.map(({ key, title, singular }) => {
        const docs = latestDocs(usage, key)
        return (
          <SectionCard key={key} title={title}>
            {docs.length === 0
              ? <p className="text-sm text-muted-foreground">No {singular} holds it yet.</p>
              : (
                <ul aria-label={title} className="divide-y divide-border/60 text-sm">
                  {docs.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                      <Link href={docHref(docHrefs[key], d.id)} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">{d.number ?? `#${d.id}`}</Link>
                      <span className="text-muted-foreground">{[d.date, d.status].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              )}
          </SectionCard>
        )
      })}

      {usage.priceBooks.length === 0
        ? (
          <EmptyState
            title="Not in any price book yet"
            description={`Add it to a price book to give it a quotable price. Until then a quote line uses its base price${usage.basePrice === null ? ', which is empty' : `, ${formatMoney(usage.basePrice, usage.currency)}`}.`}
            action={<Button variant="outline" asChild><Link href={hrefs.priceBooks}>Open Price Books</Link></Button>}
          />
        )
        : (
          <SectionCard title="Price books" description="A quote is priced from the price book it uses. Prices are edited in Price Books, not here." actions={<Button variant="outline" size="sm" asChild><Link href={hrefs.priceBooks}>Open Price Books</Link></Button>}>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Price book</TableHead><TableHead>Number</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                <TableBody>
                  {usage.priceBooks.map((b) => (
                    <TableRow key={b.priceBookId}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="font-mono text-xs">{b.priceBookNo ?? '—'}</TableCell>
                      <TableCell>{b.active ? 'Active' : 'Inactive'}</TableCell>
                      <TableCell className="text-right">{formatMoney(b.listPrice, b.currency) ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        )}
    </div>
  )
}

// ============================================================================================================================ History

export function HistoryTab({ rows, paging, error, loading, onPage }: {
  rows: PmHistoryRow[] | null
  paging: PmPaging | null
  error: string
  loading: boolean
  onPage: (page: number) => void
}) {
  if (error) return notice(error, 'alert')
  if (rows === null) return notice('Loading…')
  if (rows.length === 0) return <EmptyState title="No changes recorded yet" description="Every change to its About and its Sell in CRM details is listed here, with who made it and when." />

  return (
    <SectionCard title="History" description="Every change, newest first, with who made it and when.">
      <ol aria-label="Changes" aria-busy={loading} className="divide-y divide-border/60">
        {rows.map((row, i) => (
          <li key={`${row.at}-${row.type}-${i}`} className="space-y-1 py-3 text-sm">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-foreground">{eventWord(row)}</span>
              <span className="text-muted-foreground">{STORE_WORD[row.store]} · {row.by ?? 'The system'} · {whenWord(row.at)}</span>
            </p>
            {row.changes.length > 0 && (
              <ul className="space-y-0.5 text-foreground">
                {row.changes.map((c, j) => <li key={j} className="min-w-0 break-words">{describeChange(c)}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {paging && paging.lastPage > 1 && (
        <nav aria-label="History pages" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Page {paging.page} of {paging.lastPage}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" disabled={loading || paging.page <= 1} onClick={() => onPage(paging.page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={loading || paging.page >= paging.lastPage} onClick={() => onPage(paging.page + 1)}>Next</Button>
          </span>
        </nav>
      )}
    </SectionCard>
  )
}

// ============================================================================================================================ Signals & ICP

const MODEL_WORDS: Array<{ key: 'b2b' | 'b2g' | 'b2c'; label: string }> = [
  { key: 'b2b', label: 'B2B Customer Acquisition' },
  { key: 'b2g', label: 'B2G ICP' },
  { key: 'b2c', label: 'B2B Partner Acquisition' },
]

export function SignalsIcpTab({ record, signals, icpStates, icpError, canEdit, onEdit }: {
  record: PmFullRecord
  /** The signals found for it; null when Signals has no value for it, or it has not been counted. */
  signals: number | null
  /** The stored ideal customers, read from the Portfolio; null while loading. */
  icpStates: IcpStates | null
  icpError: string
  canEdit: boolean
  onEdit: () => void
}) {
  const lineKey = record.parent?.key ?? null
  const link = signalsHref(lineKey, record.offer?.offerId ?? null)

  return (
    <div className="space-y-4">
      <SectionCard title="Signals" description="Companies Signals found where this sub-product is the best match.">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Signals found" value={signals === null ? <span className="text-muted-foreground">Not counted: Signals has no value for this.</span> : (
            <span className="flex flex-wrap items-center gap-3"><span>{String(signals)}</span>{link && <Link href={link} className="font-normal text-foreground underline underline-offset-2 hover:no-underline">See these signals</Link>}</span>
          )} />
        </dl>
      </SectionCard>

      <SectionCard
        title="Ideal customer"
        description="Who this is for, as Signals uses it to score companies."
        actions={canEdit && record.offer ? <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 size-3.5" aria-hidden="true" />Edit</Button> : undefined}
      >
        {!record.offer
          ? <p className="text-sm text-muted-foreground">An ideal customer belongs to the About of a sub-product, and this one has no About yet.</p>
          : (
            <div className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2"><Fact label="State" value={<IcpChip state={record.icp} />} /></dl>
              {icpError && notice(icpError, 'alert')}
              {icpStates && (
                <ul aria-label="Customer models" className="space-y-3">
                  {MODEL_WORDS.map(({ key, label }) => {
                    const s = icpStates[key]
                    const filled = s.form.label.trim() !== '' || s.form.industry_label.trim() !== ''
                    return (
                      <li key={key} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        {filled
                          ? <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">{s.form.industry_label.trim() || s.form.label}</p>
                          : <p className="mt-1 text-sm text-muted-foreground">Not configured.</p>}
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">State: {icpStateLabel(record.icp)}. Edit the ideal customer in the form: one Save writes it with the rest.</p>
            </div>
          )}
      </SectionCard>
    </div>
  )
}
