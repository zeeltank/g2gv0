'use client'

import { useState } from 'react'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { useAuth } from '@/lib/gtg-auth'
import { Tabs } from '@/components/org/gtg-ui'
import { OrganizationInformation } from '@/components/org/organization-information'
import { AddOrganizationDetail } from '@/components/org/add-organization-detail'

export default function OrganizationSetupPage() {
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('org-info')

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-border border-t-brand" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const tabs = [
    { id: 'org-info', label: 'Organization Information' },
    { id: 'add-detail', label: 'Add Organization Detail' },
  ]

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[1200px] px-6 py-8">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Organization Setup</h1>
              <p className="mt-2 text-muted-foreground">
                Manage organization profile, details, and structure.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
              <div className="p-6">
                {activeTab === 'org-info' && (
                  <OrganizationInformation role={user.role} />
                )}
                {activeTab === 'add-detail' && (
                  <AddOrganizationDetail role={user.role} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  )
}
