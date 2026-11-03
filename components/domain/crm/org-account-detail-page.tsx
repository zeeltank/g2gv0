'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DetailPage, type DetailStatus } from '@/components/shared/scaffolds/detail-page'
import { PageTabs, TabPanel, type PageTab } from '@/components/shared/scaffolds/page-tabs'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { availableActions } from '@/lib/org-accounts/display'
import type { OwnerOption } from '@/lib/org-accounts/edit-model'
import { classifyCreateFailure, classifyLoadFailure, DELETED_NAME_QUESTION, FORBIDDEN_PAGE_TEXT } from '@/lib/org-accounts/failure'
import type { OrgLinks } from '@/lib/org-accounts/links'
import { formatDay } from '@/lib/signal-review/signal-display'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import { orgAccountsService } from '@/services/org-accounts/org-accounts-service'
import type { Org360, OrgCreateCrmResult, OrgMeta } from '@/services/org-accounts/types'
import { ActivityPanel, ContactsPanel, DealsPanel, OverviewPanel, SignalsPanel } from './org-account-detail-tabs'
import { OrgAccountEditForm } from './org-account-edit-form'
import { returnFocusTo } from './org-account-focus'
import { HeaderSources, LifecycleChip, NoticeBar, type ScreenNotice } from './org-account-parts'

// Defined once, outside the component: useUrlTab depends on it. The first is the tab a plain link opens.
const TAB_IDS = ['overview', 'signals', 'contacts', 'deals', 'activity'] as const
const TAB_LABELS: Record<(typeof TAB_IDS)[number], string> = { overview: 'Overview', signals: 'Signals', contacts: 'Contacts', deals: 'Deals', activity: 'Activity' }
const ID_PREFIX = 'org-360-detail'

type PageStatus = DetailStatus | 'forbidden'

/** What the page says after the CRM organisation was created, restored or already there. */
function createdText(result: OrgCreateCrmResult['data'], reloaded: boolean): string {
  const text = result.restored
    ? 'The deleted CRM organisation was restored and linked.'
    : result.created ? 'The CRM organisation was created and linked.' : 'This organisation already has a CRM organisation, so nothing new was created.'
  return reloaded ? text : `${text} Reload the page to see it here.`
}

/**
 * One organisation's 360 page: who it is, which sources know it and why they are linked, and tabs for what each source holds (Overview, Signals,
 * Contacts, Deals, Activity). Edit changes the lifecycle and owner; the Overview offers "Create CRM organisation" when there is none and the server says
 * this person may. `service`, `links` and `owners` are for tests and for the route around it; the route also adds the app shell and the breadcrumb.
 */
export function OrgAccountDetailPage({ id, onBack, onNameKnown, service = orgAccountsService, links, owners = [] }: {
  id: string
  onBack: () => void
  /** Reports the organisation's name once it is known, for the breadcrumb. */
  onNameKnown?: (name: string) => void
  service?: OrgAccountsApi
  links: OrgLinks
  /** The people an owner can be chosen from. */
  owners?: readonly OwnerOption[]
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const { confirm, confirmDialog } = useConfirm()
  const [tab, setTab] = useUrlTab(TAB_IDS)

  const [org, setOrg] = useState<Org360 | null>(null)
  const [status, setStatus] = useState<PageStatus>('loading')
  const [error, setError] = useState('')
  const [meta, setMeta] = useState<OrgMeta | null>(null)
  const [notice, setNotice] = useState<ScreenNotice | null>(null)
  const [busy, setBusy] = useState(false)
  const [drawer, setDrawer] = useState({ open: false, version: 0 })

  const noticeBar = useRef<HTMLDivElement>(null)
  const focusNotice = useRef(false)

  // Only the newest request may change what is shown: opening another organisation while the first is still loading must not let its answer replace it.
  const latest = useRef(0)

  /** `quiet` reads the organisation again behind the page, without the "Opening…" state. It answers whether it worked. */
  const load = useCallback(async (quiet = false): Promise<boolean> => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setStatus('error')
      return false
    }
    const mine = ++latest.current
    if (!quiet) setStatus('loading')
    try {
      const response = await service.get(id)
      if (mine !== latest.current) return false
      setOrg(response.data)
      setStatus('ready')
      return true
    } catch (cause) {
      if (mine !== latest.current || quiet) return false
      const problem = classifyLoadFailure(cause, 'This organisation could not be opened.')
      setError(problem.message)
      setStatus(problem.kind === 'error' ? 'error' : problem.kind)
      return false
    }
  }, [context, service, id])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  // What this person may do. If it cannot be read, nothing is offered.
  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    let cancelled = false
    service.meta().then((response) => { if (!cancelled) setMeta(response.data) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [context, service])

  const knownName = org?.identity.name
  useEffect(() => {
    if (knownName) onNameKnown?.(knownName)
  }, [knownName, onNameKnown])

  // After the button that was pressed has left the page (the CRM organisation now exists), the focus goes to the notice instead of to nowhere.
  useEffect(() => {
    if (notice && focusNotice.current) {
      focusNotice.current = false
      noticeBar.current?.focus()
    }
  }, [notice])

  const can = availableActions(meta, org)

  /** One try at creating (or, with `restore`, restoring) the CRM organisation. */
  const attempt = async (restore: boolean): Promise<'done' | 'deleted' | 'failed'> => {
    try {
      const response = await service.createCrmOrganisation(id, restore ? { restore_deleted: true } : {})
      const reloaded = await load(true)
      focusNotice.current = true
      setNotice({ tone: 'success', text: createdText(response.data, reloaded) })
      return 'done'
    } catch (cause) {
      const problem = classifyCreateFailure(cause)
      if (problem.kind === 'deleted_name_exists') return 'deleted'
      setNotice({ tone: 'error', text: problem.message })
      return 'failed'
    }
  }

  const createCrm = async (trigger: HTMLElement) => {
    if (!org || busy) return
    const agreed = await confirm({
      title: `Create a CRM organisation for ${org.identity.name}?`,
      description: 'A CRM organisation is created from this name and website and linked to this record. Nothing is sent to anyone.',
      confirmLabel: 'Create CRM organisation',
    })
    if (!agreed) {
      returnFocusTo(trigger)
      return
    }
    setNotice(null)
    setBusy(true)
    try {
      const first = await attempt(false)
      if (first === 'failed') returnFocusTo(trigger)
      if (first !== 'deleted') return
      // A deleted CRM organisation holds the name. Restoring brings its history back; the person decides.
      setBusy(false)
      const restore = await confirm({ title: 'Restore the deleted organisation?', description: DELETED_NAME_QUESTION, confirmLabel: 'Restore' })
      if (!restore) {
        setNotice({ tone: 'success', text: 'Nothing was created. The deleted organisation was left as it is.' })
        returnFocusTo(trigger)
        return
      }
      setBusy(true)
      if (await attempt(true) === 'failed') returnFocusTo(trigger)
    } finally {
      setBusy(false)
    }
  }

  const editTrigger = useRef<HTMLElement | null>(null)
  const openEdit = (trigger: HTMLElement) => {
    editTrigger.current = trigger
    setDrawer((d) => ({ open: true, version: d.version + 1 }))
  }
  const closeEdit = () => {
    setDrawer((d) => ({ ...d, open: false }))
    returnFocusTo(editTrigger.current)
  }
  const onSaved = async () => {
    closeEdit()
    const reloaded = await load(true)
    setNotice({ tone: 'success', text: reloaded ? 'Saved.' : 'Saved. Reload the page to see the change here.' })
  }

  const tabs: PageTab[] = TAB_IDS.map((tabId) => ({
    id: tabId,
    label: TAB_LABELS[tabId],
    count: !org ? undefined : tabId === 'signals' ? org.signals.total : tabId === 'contacts' ? org.totals.contacts : tabId === 'deals' ? org.totals.deals : tabId === 'activity' ? org.totals.activity : undefined,
  }))

  const subtitle = org
    ? [org.identity.domain, org.identity.owner_name ? `Owner: ${org.identity.owner_name}` : 'No owner', `Updated ${formatDay(org.identity.updated_at) ?? 'on an unknown day'}`].filter(Boolean).join(' · ')
    : undefined

  if (status === 'forbidden') {
    return <EmptyState title={FORBIDDEN_PAGE_TEXT} description="Ask an administrator to give you access." action={<Button variant="outline" size="sm" onClick={onBack}>Back to Organisation 360</Button>} />
  }

  return (
    <>
      <DetailPage
        title={org?.identity.name ?? ''}
        subtitle={subtitle}
        badge={org && <LifecycleChip lifecycle={org.identity.lifecycle} />}
        backLabel="Back to Organisation 360"
        onBack={onBack}
        status={status}
        error={error}
        onRetry={() => void load()}
        notFoundText="This organisation could not be found, or you do not have access to it."
        actions={org && can.edit && <Button onClick={(event) => openEdit(event.currentTarget)} disabled={busy}><Pencil className="mr-1.5 size-4" aria-hidden="true" />Edit</Button>}
        notice={notice && <NoticeBar ref={noticeBar} notice={notice} onDismiss={() => setNotice(null)} />}
        tabs={org && (
          <div className="space-y-3">
            <HeaderSources links={org.identity.links} />
            <PageTabs tabs={tabs} active={tab} onChange={setTab} label="Sections of this organisation" idPrefix={ID_PREFIX} />
          </div>
        )}
      >
        {org && (
          <>
            <TabPanel id="overview" active={tab} idPrefix={ID_PREFIX}>
              <OverviewPanel org={org} links={links} canCreateCrm={can.createCrm} busy={busy} onCreateCrm={(trigger) => void createCrm(trigger)} />
            </TabPanel>
            <TabPanel id="signals" active={tab} idPrefix={ID_PREFIX}><SignalsPanel org={org} links={links} /></TabPanel>
            <TabPanel id="contacts" active={tab} idPrefix={ID_PREFIX}><ContactsPanel org={org} links={links} /></TabPanel>
            <TabPanel id="deals" active={tab} idPrefix={ID_PREFIX}><DealsPanel org={org} links={links} /></TabPanel>
            <TabPanel id="activity" active={tab} idPrefix={ID_PREFIX}><ActivityPanel org={org} /></TabPanel>
          </>
        )}
      </DetailPage>

      {org && can.edit && (
        <OrgAccountEditForm
          key={drawer.version}
          open={drawer.open}
          identity={org.identity}
          lifecycles={meta?.lifecycles ?? []}
          owners={owners}
          service={service}
          onClose={closeEdit}
          onSaved={() => void onSaved()}
        />
      )}
      {confirmDialog}
    </>
  )
}
