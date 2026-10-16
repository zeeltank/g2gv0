'use client'

/**
 * Sales & Marketing unification, Phase 7: shows this Organization's own
 * record in GTM (a real FK, `gtm_accounts.crm_organization_id`, wired by
 * Phase 3) and in Signals (matched by name against `g2g_companies` -
 * nothing links them directly). Addresses the "two Accounts, no visible
 * connection" confusion a CRM/GTM/Signals merge creates without actually
 * merging the underlying tables - see Docs/sales-marketing-merge/
 * DECISIONS.md.
 *
 * Neither GTM accounts nor Signals companies have a deep-linkable `/{id}`
 * detail route in this app (both are managed inline via dialogs, same gap
 * `crm-projects-tab.tsx` already documents for Task Management projects) -
 * a row here opens the owning LIST screen, same reasoning, same pattern.
 */

import { useRouter } from 'next/navigation'
import { Radar, Target } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

export interface CrossLinkedGtmAccount {
  id: string
  name: string
  stage: string
  deals_count: number
}

export interface CrossLinkedSignalsCompany {
  id: string
  name: string
  industry: string | null
  opportunities_count: number
}

export interface CrossLinkedCrmOrganization {
  id: string
  name: string
  account_no: string
}

export interface OrganizationCrossModuleLinks {
  gtm_account: CrossLinkedGtmAccount | null
  signals_company: CrossLinkedSignalsCompany | null
}

export interface AccountCrossModuleLinks {
  crm_organization: CrossLinkedCrmOrganization | null
  signals_company: CrossLinkedSignalsCompany | null
}

function LinkCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: typeof Radar
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  )
}

/** Organization detail page's tab: this org's GTM Account and Signals Company, if found. */
export function CrmOrganizationCrossLinksTab({ links, loading }: { links: OrganizationCrossModuleLinks | null; loading: boolean }) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Spinner className="size-4" aria-hidden="true" />
        Loading cross-module links…
      </div>
    )
  }

  const nothingFound = !links?.gtm_account && !links?.signals_company

  if (nothingFound) {
    return (
      <EmptyState
        icon={<Radar className="size-8" aria-hidden="true" />}
        title="Not found anywhere else yet"
        description="No GTM Account or Signals Company matches this organization's name."
      />
    )
  }

  return (
    <div className="space-y-3">
      {links?.gtm_account && (
        <LinkCard
          icon={Target}
          title={`Also in GTM Agents: ${links.gtm_account.name}`}
          subtitle={`Stage: ${links.gtm_account.stage} · ${links.gtm_account.deals_count} deal${links.gtm_account.deals_count === 1 ? '' : 's'}`}
          onClick={() => router.push(resolveAccessLink('/gtm/prospecting'))}
        />
      )}
      {links?.signals_company && (
        <LinkCard
          icon={Radar}
          title={`Found via Signals: ${links.signals_company.name}`}
          subtitle={`${links.signals_company.industry ?? 'Industry unknown'} · ${links.signals_company.opportunities_count} opportunit${links.signals_company.opportunities_count === 1 ? 'y' : 'ies'}`}
          onClick={() => router.push(resolveAccessLink('/signals'))}
        />
      )}
    </div>
  )
}

/**
 * `AccountCrossModuleLinks` is the GTM-side response shape
 * (`AccountController::crossModuleLinks()`); its two fields are consumed
 * directly where needed (`prospecting-view.tsx`'s compact "Also in CRM"
 * badge; the Signals half is already shown in depth by that dialog's own
 * "Buying signals" section, so no second rendering component is needed
 * here - exported purely as a type for `services/gtm/gtm.ts` to type its
 * response against.
 */
