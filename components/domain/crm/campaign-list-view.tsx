'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { Campaign, CrmPicklistValue } from '@/types/crm'
import { CreateCampaignModal } from './create-campaign-modal'

type SortKey = 'name' | 'campaign_type' | 'campaign_status' | 'expected_revenue' | 'closing_date'

const PAGE_SIZE = 20

/** Same exact-match-with-fallback convention as lead-list-view.tsx's STATUS_VARIANT - campaign statuses are free-form picklist values, not a fixed enum. */
export const CAMPAIGN_STATUS_VARIANT: Record<string, 'success' | 'active' | 'inactive' | 'default'> = {
  Active: 'active', Planning: 'active',
  Completed: 'success',
  Cancelled: 'inactive', Inactive: 'inactive',
}

function SortHead({ label, sortKey, activeKey, asc, onSort, className }: {
  label: string; sortKey: SortKey; activeKey: SortKey; asc: boolean
  onSort: (key: SortKey) => void; className?: string
}) {
  return (
    <TableHead className={className}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 normal-case text-foreground">
        {label}
        {activeKey === sortKey && <ChevronDown className={cn('size-3.5 transition-transform', asc && 'rotate-180')} />}
      </button>
    </TableHead>
  )
}

export function CampaignListView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [picklists, setPicklists] = useState<{ campaignType: CrmPicklistValue[]; campaignStatus: CrmPicklistValue[]; expectedResponse: CrmPicklistValue[] }>({ campaignType: [], campaignStatus: [], expectedResponse: [] })

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getCampaigns(context, {
        page, perPage: PAGE_SIZE, search: search || undefined,
        sortBy: sortKey, sortDir: sortAsc ? 'asc' : 'desc',
      })
      setCampaigns(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load campaigns.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page, search, sortKey, sortAsc])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'campaigns')
      .then((response) => {
        const c = response.data.campaigns ?? {}
        setPicklists({ campaignType: c.campaign_type ?? [], campaignStatus: c.campaign_status ?? [], expectedResponse: c.expected_response ?? [] })
      })
      .catch(() => { /* the form still works with empty dropdowns */ })
  }, [context])

  const onSort = (key: SortKey) => {
    if (key === sortKey) { setSortAsc((a) => !a) } else { setSortKey(key); setSortAsc(true) }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Marketing efforts you target leads, contacts, and organizations with.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-1.5 size-4" aria-hidden="true" />
          Add Campaign
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search name or sponsor…" className="pl-9" />
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="@container/campaigns overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Name" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Type" sortKey="campaign_type" activeKey={sortKey} asc={sortAsc} onSort={onSort} className="hidden @md/campaigns:table-cell" />
              <SortHead label="Status" sortKey="campaign_status" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
              <SortHead label="Expected Revenue" sortKey="expected_revenue" activeKey={sortKey} asc={sortAsc} onSort={onSort} className="hidden @md/campaigns:table-cell" />
              <SortHead label="Closing Date" sortKey="closing_date" activeKey={sortKey} asc={sortAsc} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading campaigns…
              </TableCell></TableRow>
            )}
            {!isLoading && campaigns.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                No campaigns yet. Click “Add Campaign” to create one.
              </TableCell></TableRow>
            )}
            {!isLoading && campaigns.map((campaign) => (
              <TableRow key={campaign.id} className="cursor-pointer" onClick={() => router.push(resolveAccessLink('/module/crm/marketing/campaigns') + `/${campaign.id}`)}>
                <TableCell className="font-medium text-foreground">{campaign.name}</TableCell>
                <TableCell className="hidden @md/campaigns:table-cell">{campaign.campaignType || '—'}</TableCell>
                <TableCell>
                  {campaign.campaignStatus
                    ? <StatusBadge variant={CAMPAIGN_STATUS_VARIANT[campaign.campaignStatus] ?? 'default'}>{campaign.campaignStatus}</StatusBadge>
                    : '—'}
                </TableCell>
                <TableCell className="hidden @md/campaigns:table-cell">{campaign.expectedRevenue ?? '—'}</TableCell>
                <TableCell>{campaign.closingDate || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} campaign{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CreateCampaignModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { setNotice(message); void load() }}
        campaign={null}
        picklists={picklists}
      />
    </div>
  )
}
