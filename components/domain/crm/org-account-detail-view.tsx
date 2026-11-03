'use client'

import { useMemo } from 'react'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext } from '@/lib/laravel-context'
import { buildLinks } from '@/lib/org-accounts/links'
import { useAssignableEmployees } from './lead-employees'
import { OrgAccountDetailPage } from './org-account-detail-page'

// The page itself is in org-account-detail-page.tsx, which takes its links, owners and service as props so a test can hand it fakes. This one asks the
// app's own menu where the other screens are, and reads the people an owner can be chosen from, the same way the CRM's other forms do.
export function OrgAccountDetailView({ id, onBack, onNameKnown }: { id: string; onBack: () => void; onNameKnown?: (name: string) => void }) {
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)
  return <OrgAccountDetailPage id={id} onBack={onBack} onNameKnown={onNameKnown} links={buildLinks(resolveAccessLink)} owners={employees} />
}
