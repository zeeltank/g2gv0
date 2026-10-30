'use client'

/**
 * Unified Sales & Marketing Reports Shell.
 *
 * Combines:
 * 1. Revenue & Pipeline Intelligence Reports (pre-built GTM analytics: Pipeline Funnel,
 *    Forecast Projections, Closed Won/Lost reasons, BANT/MEDDPICC scores, SDR Outreach,
 *    Campaign Reach, Customer Health, and AI Agent usage).
 * 2. Custom CRM Query Builder (generic multi-entity report generator across Leads, Organizations,
 *    Contacts, Opportunities, Quotes, Orders, and Invoices).
 */

import { useState } from 'react'
import { BarChart3, SlidersHorizontal } from 'lucide-react'
import { ReportsShell } from '@/domain/reports/reports-shell'
import { ReportsView } from '@/components/domain/gtm/reports-view'

type ReportTab = 'gtm-intelligence' | 'custom-builder'

export function CrmReportsShell() {
  const [activeTab, setActiveTab] = useState<ReportTab>('gtm-intelligence')

  return (
    <div className="space-y-4">
      {/* Top Tab Bar */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('gtm-intelligence')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'gtm-intelligence'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="size-4" />
          Revenue & Pipeline Intelligence (Pre-built)
        </button>
        <button
          onClick={() => setActiveTab('custom-builder')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'custom-builder'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <SlidersHorizontal className="size-4" />
          Custom CRM Query & BI Builder
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'gtm-intelligence' ? (
        <ReportsView />
      ) : (
        <ReportsShell
          scope="crm"
          title="Custom CRM Report Builder"
          description="Build custom reports from Leads, Organizations, Contacts, Opportunities, Quotes, Orders, and Invoices — tabular, summary, pivot or chart."
        />
      )}
    </div>
  )
}
