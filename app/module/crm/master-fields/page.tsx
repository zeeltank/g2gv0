'use client'

/**
 * CRM's "Master Fields" menu row (id 202, reactivated from the abandoned
 * scaffolding this migration reused) - a real GtgPageShell route, not a
 * content-map entry (no menu row is scoped by access_link for it beyond
 * this one, same as the 4 detail routes). Two tabs:
 *  - Picklist Values: a real admin screen, built here (CrmPicklistAdmin).
 *  - Custom Fields: the existing, already table-agnostic Fields
 *    Configuration console lives at a different route entirely
 *    (/platform-services/fields-configuration) - this tab links out to it
 *    scoped to ?module=crm rather than duplicating that console.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { resolveBreadcrumb } from '@/lib/gtg-navigation'
import { Button } from '@/components/ui/button'
import { CrmLeadCaptureAdmin } from '@/domain/crm/crm-lead-capture-admin'
import { CrmLeadRoutingAdmin } from '@/domain/crm/crm-lead-routing-admin'
import { CrmPicklistAdmin } from '@/domain/crm/crm-picklist-admin'
import { CrmSlaPolicyAdmin } from '@/domain/crm/crm-sla-policy-admin'
import { CrmTaxRateAdmin } from '@/domain/crm/crm-tax-rate-admin'

// Menu row 202 ("Master Fields") is a direct child of 199 ("Sales & Marketing"),
// not nested under Marketing/Leads - confirmed against tblmenumaster_g2g.
const MASTER_FIELDS_ACTIVE_NAV = { moduleId: '199', menuId: '202', submenuId: '' }

type Tab = 'picklists' | 'tax-rates' | 'lead-routing' | 'lead-capture' | 'sla-policies' | 'custom'

export default function CrmMasterFieldsRoute() {
  const [tab, setTab] = useState<Tab>('picklists')
  const { modules } = useSidebarNavigation()
  const breadcrumbItems = resolveBreadcrumb(MASTER_FIELDS_ACTIVE_NAV, modules)

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={MASTER_FIELDS_ACTIVE_NAV}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />

          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Master Fields</h1>
              <p className="text-sm text-muted-foreground">Picklist values, tax rates, and custom fields shared across every CRM module.</p>
            </div>

            <div className="flex gap-1 border-b border-border">
              {([
                { id: 'picklists' as const, label: 'Picklist Values' },
                { id: 'tax-rates' as const, label: 'Tax Rates' },
                { id: 'lead-routing' as const, label: 'Lead Scoring & Assignment' },
                { id: 'lead-capture' as const, label: 'Web-to-Lead' },
                { id: 'sla-policies' as const, label: 'SLA Policies' },
                { id: 'custom' as const, label: 'Custom Fields' },
              ]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'picklists' && <CrmPicklistAdmin />}

            {tab === 'tax-rates' && <CrmTaxRateAdmin />}

            {tab === 'lead-routing' && <CrmLeadRoutingAdmin />}

            {tab === 'lead-capture' && <CrmLeadCaptureAdmin />}

            {tab === 'sla-policies' && <CrmSlaPolicyAdmin />}

            {tab === 'custom' && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Admin-added fields (beyond the stock set) are managed on the shared Fields Configuration console, scoped to CRM.
                </p>
                <Button asChild>
                  <Link href="/platform-services/fields-configuration?module=crm">
                    Open Fields Configuration
                    <ArrowUpRight className="ml-1.5 size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
