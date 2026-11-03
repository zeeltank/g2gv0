'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { availableActions } from '@/lib/org-accounts/display'
import type { OwnerOption } from '@/lib/org-accounts/edit-model'
import { classifyLoadFailure, linkFailureText, type LoadFailure } from '@/lib/org-accounts/failure'
import { buildLinks, type OrgLinks } from '@/lib/org-accounts/links'
import type { OldAccount360 } from '@/lib/org-accounts/old-sections'
import { confirmCopy, decidedNotice, linkRequest, type LinkAction } from '@/lib/org-accounts/suggestions'
import { crmService } from '@/services/crm'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import { orgAccountsService } from '@/services/org-accounts/org-accounts-service'
import type { Org360, OrgMeta, OrgSuggestion } from '@/services/org-accounts/types'
import { FactEvidenceSection } from './fact-evidence-section'
import { useAssignableEmployees } from './lead-employees'
import { ContactsSection, DealsSection, LinkedRecordsCard, OldSections, SignalsSection, WhyNowStrip, type OldSectionsState } from './org-account-360-parts'
import { OrgAccountEditForm } from './org-account-edit-form'
import { returnFocusTo } from './org-account-focus'
import { NoticeBar, type ScreenNotice } from './org-account-parts'
import { OrgAgentPanel } from './org-agent-panel'

/** What the tab says to a person whose role cannot read the sections that follow the Market Signals right. */
export const OLD_SECTIONS_FORBIDDEN_TEXT = 'Campaigns, knowledge sources, relationships and the signal inbox follow the Market Signals right, which your role does not have. Everything above is unaffected.'

type IdentityState = { kind: 'loading' } | { kind: 'ready'; org: Org360 } | { kind: 'problem'; problem: LoadFailure }

/** What the tab hands to whatever it shows as the organisation's agent: who it is about, and the two ways the agent tells the tab that things changed. */
export interface AgentSlot {
  /** The Organisation 360 identity of this organization (g2g_org_accounts.id): what the agent works on. */
  identityId: number
  /** The agent added a note or a task, or a person accepted one: the tab reads the organization again and the page reads its Comments and History. */
  onRecordsChanged: () => void
  /** Accepting a link made this organization part of another one: the tab asks again for this CRM organization and lands on the identity that holds it now. */
  onOrganisationChanged: (identityId: number) => void
}

/** What the tab hands to whatever it shows as the organization's Evidence section: which organization, and (only when the page can use it) what to do when an accepted fact wrote the organization's own field. */
export interface EvidenceSlot {
  /** The CRM organization (crm_organizations.id): the facts API is keyed by the record the fact is about. */
  organizationId: string
  onWroteRecord?: () => void
}

/**
 * The Account 360 tab of an organization: the identity-based 360 (why now, the linked records with the reason for each link, the signals, the contacts
 * and the open deals) and, below it, the sections only the old Account 360 had (campaigns, knowledge sources, relationships, signal inbox). It replaces
 * the old tab AND the name-matched GTM & Signals tab: the CRM, GTM and Signals records are shown as one organisation, linked on exact evidence or by a person.
 *
 * Opening the tab ensures the organization has an identity (it makes one on the spot, from an exact name or website only, when a CRM organization made after
 * the last backfill has none). `service`, `loadOld`, `links` and `owners` are for tests and for the wiring below; the tab itself is `Account360`.
 */
export function Account360View({ organizationId, service, loadOld, links, owners = [], onOpenTab, onEditOpen, onRecordsChanged, onRecordWritten, agent: Agent, evidence: Evidence }: {
  organizationId: string
  service: OrgAccountsApi
  loadOld: () => Promise<OldAccount360>
  links: OrgLinks
  /** The people an owner can be chosen from. */
  owners?: readonly OwnerOption[]
  onOpenTab?: (tab: 'opportunities') => void
  /** The Edit drawer is about to open: a good moment to read the people. */
  onEditOpen?: () => void
  /** The agent changed the organization's notes or tasks: the page reads its Comments and History again. */
  onRecordsChanged?: () => void
  /**
   * An accepted fact in the Evidence section wrote the organization's own field (its website, its email): the page must show the new value, or editing
   * the organization would start from the old one. Leave it out and the Evidence section tells the person to reload the page instead.
   */
  onRecordWritten?: () => void
  /** The organization's agent, a component shown between "why now" and the linked records (nothing when absent: the tab's own tests need no agent). */
  agent?: ComponentType<AgentSlot>
  /** The organization's Evidence section, shown right after the linked records (nothing when absent: the tab's own tests need no facts). */
  evidence?: ComponentType<EvidenceSlot>
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const { confirm, confirmDialog } = useConfirm()

  const [identity, setIdentity] = useState<IdentityState>({ kind: 'loading' })
  const [meta, setMeta] = useState<OrgMeta | null>(null)
  const [matches, setMatches] = useState<OrgSuggestion[] | null>(null)
  const [matchesError, setMatchesError] = useState('')
  const [oldState, setOldState] = useState<OldSectionsState>({ kind: 'loading' })
  const [notice, setNotice] = useState<ScreenNotice | null>(null)
  const [busy, setBusy] = useState<{ key: string; action: LinkAction } | null>(null)
  const [failure, setFailure] = useState('')
  const [drawer, setDrawer] = useState({ open: false, version: 0 })

  const noticeBar = useRef<HTMLDivElement>(null)
  const focusNotice = useRef(false)
  const editTrigger = useRef<HTMLElement | null>(null)
  // Only the newest request may change what is shown.
  const latestIdentity = useRef(0)
  const latestMatches = useRef(0)
  const latestOld = useRef(0)

  /** `quiet` reads the 360 again behind the page, without the loading state; a failure then leaves what is on screen alone. */
  const loadIdentity = useCallback(async (quiet = false): Promise<Org360 | null> => {
    if (!isLaravelContextReady(context)) {
      setIdentity({ kind: 'problem', problem: { kind: 'error', message: 'Your ERP session is unavailable. Please sign in again.' } })
      return null
    }
    const mine = ++latestIdentity.current
    if (!quiet) setIdentity({ kind: 'loading' })
    try {
      const response = await service.forCrm(organizationId)
      if (mine !== latestIdentity.current) return null
      setIdentity({ kind: 'ready', org: response.data })
      return response.data
    } catch (cause) {
      if (mine !== latestIdentity.current || quiet) return null
      setIdentity({ kind: 'problem', problem: classifyLoadFailure(cause, 'The linked records could not be loaded.') })
      return null
    }
  }, [context, service, organizationId])

  const loadMatches = useCallback(async (identityId: number) => {
    const mine = ++latestMatches.current
    setMatchesError('')
    try {
      const response = await service.suggestions(identityId)
      if (mine !== latestMatches.current) return
      setMatches(response.data)
    } catch (cause) {
      if (mine !== latestMatches.current) return
      setMatchesError(classifyLoadFailure(cause, 'The possible matches could not be loaded.').message)
    }
  }, [service])

  const loadOldSections = useCallback(async () => {
    const mine = ++latestOld.current
    setOldState({ kind: 'loading' })
    try {
      const data = await loadOld()
      if (mine !== latestOld.current) return
      setOldState({ kind: 'ready', data })
    } catch (cause) {
      if (mine !== latestOld.current) return
      const problem = classifyLoadFailure(cause, 'These sections could not be loaded.')
      setOldState(problem.kind === 'forbidden' ? { kind: 'forbidden', message: OLD_SECTIONS_FORBIDDEN_TEXT } : { kind: 'error', message: problem.message })
    }
  }, [loadOld])

  useEffect(() => {
    queueMicrotask(() => { void loadIdentity() })
  }, [loadIdentity])

  useEffect(() => {
    queueMicrotask(() => { void loadOldSections() })
  }, [loadOldSections])

  // What this person may do. If it cannot be read, nothing is offered.
  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    let cancelled = false
    service.meta().then((response) => { if (!cancelled) setMeta(response.data) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [context, service])

  const identityId = identity.kind === 'ready' ? identity.org.identity.id : null
  useEffect(() => {
    if (identityId !== null) queueMicrotask(() => { void loadMatches(identityId) })
  }, [identityId, loadMatches])

  // After the button that was pressed has left the page (its pair is settled), the focus goes to the notice instead of to nowhere.
  useEffect(() => {
    if (notice && focusNotice.current) {
      focusNotice.current = false
      noticeBar.current?.focus()
    }
  }, [notice])

  const can = availableActions(meta)

  /** A person's answer to one possible match: asked first, then done, then the 360 and the matches are read again (two records are now one organisation). */
  const decide = async (suggestion: OrgSuggestion, action: LinkAction, trigger: HTMLElement) => {
    if (busy) return
    if (!(await confirm(confirmCopy(suggestion, action)))) {
      returnFocusTo(trigger)
      return
    }
    setBusy({ key: suggestion.key, action })
    setFailure('')
    try {
      await service.link(linkRequest(suggestion, action))
      focusNotice.current = true
      setNotice({ tone: 'success', text: decidedNotice(suggestion, action) })
      const org = await loadIdentity(true)
      if (org) await loadMatches(org.identity.id)
    } catch (cause) {
      focusNotice.current = false
      setFailure(linkFailureText(cause))
      returnFocusTo(trigger)
    } finally {
      setBusy(null)
    }
  }

  const openEdit = (trigger: HTMLElement) => {
    editTrigger.current = trigger
    onEditOpen?.()
    setDrawer((d) => ({ open: true, version: d.version + 1 }))
  }
  const closeEdit = () => {
    setDrawer((d) => ({ ...d, open: false }))
    returnFocusTo(editTrigger.current)
  }
  const onSaved = async () => {
    closeEdit()
    const org = await loadIdentity(true)
    setNotice({ tone: 'success', text: org ? 'Saved.' : 'Saved. Reload the page to see the change here.' })
  }

  /** The agent (or a person accepting its proposal) added a note or a task: the 360 is read again (the "last activity" fact moved) and the page reads its tabs. */
  const recordsChanged = () => {
    void loadIdentity(true)
    onRecordsChanged?.()
  }
  /**
   * Accepting a link made this organization part of another one, and the identity this tab showed may be the one that was removed. The page is keyed by the CRM
   * organization, so asking again for it answers with the identity that holds it now (the survivor, never the removed one); its matches are read with it.
   */
  const organisationChanged = () => {
    void (async () => {
      const next = await loadIdentity(true)
      if (next) await loadMatches(next.identity.id)
    })()
  }

  const org = identity.kind === 'ready' ? identity.org : null

  return (
    <div className="space-y-4">
      {notice && <NoticeBar ref={noticeBar} notice={notice} onDismiss={() => setNotice(null)} />}

      {identity.kind === 'loading' && (
        <div role="status" aria-label="Loading the linked records" className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
        </div>
      )}

      {identity.kind === 'problem' && (
        <div role={identity.problem.kind === 'error' ? 'alert' : 'status'} data-identity-problem={identity.problem.kind} className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-border bg-card p-4 text-sm text-foreground">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{identity.problem.message}</span>
          {identity.problem.kind === 'error' && <Button variant="outline" size="sm" className="ml-auto" onClick={() => void loadIdentity()}>Retry</Button>}
        </div>
      )}

      {org && (
        <>
          <WhyNowStrip why={org.why_now} />

          {/* THE ORGANISATION AGENT (components/domain/crm/org-agent-panel.tsx), between "why now" and the linked records. `Account360` below renders it. */}
          {/* Keyed by the identity: after a merge the survivor is a different record, and the agent starts fresh on it. */}
          {Agent && <Agent key={org.identity.id} identityId={org.identity.id} onRecordsChanged={recordsChanged} onOrganisationChanged={organisationChanged} />}

          <LinkedRecordsCard
            org={org}
            links={links}
            matches={matches}
            matchesError={matchesError}
            canEdit={can.edit}
            canConfirm={can.confirmLinks}
            busy={busy}
            failure={failure}
            onEdit={openEdit}
            onDecide={(suggestion, action, trigger) => void decide(suggestion, action, trigger)}
            onRetryMatches={() => void loadMatches(org.identity.id)}
          />
          {/* The facts an agent or a source suggested about this organization, with their evidence (components/domain/crm/fact-evidence-section.tsx). `Account360` below renders it. */}
          {Evidence && <Evidence organizationId={organizationId} onWroteRecord={onRecordWritten ? () => { onRecordWritten(); void loadIdentity(true) } : undefined} />}
          <SignalsSection org={org} links={links} />
          <ContactsSection org={org} />
          <DealsSection org={org} links={links} onOpenTab={onOpenTab} />
        </>
      )}

      <OldSections state={oldState} organizationId={organizationId} onRetry={() => void loadOldSections()} />

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
    </div>
  )
}

/** The real agent of the tab: track Z's panel, working on the identity the tab hands it and telling the tab when it changed records or merged organisations. */
function OrgAgentSlot({ identityId, onRecordsChanged, onOrganisationChanged }: AgentSlot) {
  return <OrgAgentPanel orgAccountId={identityId} onRecordsChanged={onRecordsChanged} onOrganisationChanged={onOrganisationChanged} />
}

/** The real Evidence section of the tab: the facts about this CRM organization, and, when the page can use it, what to do after one wrote the organization's own field. */
function OrgEvidenceSlot({ organizationId, onWroteRecord }: EvidenceSlot) {
  return <FactEvidenceSection entityType="organization" entityId={organizationId} onWroteRecord={onWroteRecord} />
}

/** The Account 360 tab as the Organization detail page uses it: the real service, this person's menu for the links, and the people for the owner choice. */
export function Account360({ organizationId, context, onOpenTab, onRecordsChanged, onRecordWritten }: {
  organizationId: string
  context: LaravelContext
  onOpenTab?: (tab: 'opportunities') => void
  /** The agent changed the organization's notes or tasks: the page reads its Comments and History again. */
  onRecordsChanged?: () => void
  /** An accepted fact wrote the organization's own field: the page reads the organization again so it (and the Edit form) shows the new value. */
  onRecordWritten?: () => void
}) {
  const { resolveAccessLink } = useSidebarNavigation()
  const [wantOwners, setWantOwners] = useState(false)
  const employees = useAssignableEmployees(context, wantOwners)

  const loadOld = useCallback(async (): Promise<OldAccount360> => {
    const response = await crmService.getAccount360(context, organizationId)
    const { campaigns, knowledgeSources, relationships, signals } = response.data
    return { campaigns, knowledgeSources, relationships, signals }
  }, [context, organizationId])

  return (
    <Account360View
      organizationId={organizationId}
      service={orgAccountsService}
      loadOld={loadOld}
      links={buildLinks(resolveAccessLink)}
      owners={employees}
      onOpenTab={onOpenTab}
      onEditOpen={() => setWantOwners(true)}
      onRecordsChanged={onRecordsChanged}
      onRecordWritten={onRecordWritten}
      agent={OrgAgentSlot}
      evidence={OrgEvidenceSlot}
    />
  )
}
