'use client'

/**
 * Communication Console — Platform Services.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MULTI-CHANNEL COMMUNICATION & DELIVERY AUDIT CONSOLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reuses the existing G2G Email (SMTP), SMS Gateway, and WhatsApp Business
 * (Meta Cloud API) integrations implemented in G2G:
 *
 * 1. SEND NOTICE (`broadcast-notice`):
 *    Interactive notice composer supporting channel selection (WhatsApp, SMS, Email),
 *    quick templates, audience selection (custom direct entry and organization records),
 *    live preview for each channel, variable insertion, and direct dispatch through
 *    configured gateways.
 *
 * 2. DELIVERY LOG (`delivery-log`):
 *    Real-time delivery audit trail and KPI metrics (Total Dispatched, Delivered,
 *    Pending, Errors) with search, channel filter, status filter, and detailed modal inspection.
 *
 * Supports module scoping (?module=hrms, etc.) as well as central platform use.
 */

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { History, Send } from 'lucide-react'

import { isDecentralizedModule } from '@/lib/platform/access-links'
import { ServiceShell } from '../_components/ServiceShell'
import { CommunicationBroadcastNotice } from '@/components/domain/communication/communication-broadcast-notice'
import { CommunicationDeliveryLog } from '@/components/domain/communication/communication-delivery-log'
import { cn } from '@/lib/utils'

type TabKey = 'broadcast-notice' | 'delivery-log'

const TABS: { id: TabKey; label: string; icon: typeof Send }[] = [
  { id: 'broadcast-notice', label: 'Send notice', icon: Send },
  { id: 'delivery-log', label: 'Delivery log', icon: History },
]

export default function CommunicationPage() {
  return (
    <Suspense fallback={null}>
      <CommunicationConsole />
    </Suspense>
  )
}

function CommunicationConsole() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawModuleKey = searchParams.get('module')
  const moduleKey = isDecentralizedModule(rawModuleKey) ? rawModuleKey : null

  const initialTab = (searchParams.get('tab') as TabKey) || 'broadcast-notice'
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)

  const handleTabChange = (tabId: TabKey) => {
    setActiveTab(tabId)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tabId)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <ServiceShell slug="communication">
      <div className="mt-6 space-y-6">
        {/* LMS K-12 Styled Tab Switcher */}
        <div role="tablist" className="flex items-center gap-2 border-b border-border">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'relative -mb-px flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150 outline-none cursor-pointer',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('size-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span>{tab.label}</span>
                {isActive && (
                  <span
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Tab Contents */}
        {activeTab === 'broadcast-notice' && (
          <CommunicationBroadcastNotice moduleKey={moduleKey} />
        )}

        {activeTab === 'delivery-log' && (
          <CommunicationDeliveryLog moduleKey={moduleKey} />
        )}
      </div>
    </ServiceShell>
  )
}
