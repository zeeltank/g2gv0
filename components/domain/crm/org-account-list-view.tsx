'use client'

import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { buildLinks } from '@/lib/org-accounts/links'
import { OrgAccountList } from './org-account-list'

// The list itself is in org-account-list.tsx, which takes its links and its service as props so a test can hand it fakes. This one only asks the app's
// own menu where the other screens are, and is what the content map (hooks/content-map-crm.ts) shows for /module/crm/organisation-360.
export function OrgAccountListView() {
  const { resolveAccessLink } = useSidebarNavigation()
  return <OrgAccountList links={buildLinks(resolveAccessLink)} />
}
