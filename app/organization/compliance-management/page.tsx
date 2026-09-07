'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { COMPLIANCE_LIBRARY_ACCESS_LINK } from '@/lib/gtg-navigation'

/**
 * A redirect to the real Compliance Library, matching the shims at
 * app/organization/information and app/organization/add-detail.
 *
 * ── WHY THIS IS NO LONGER A SCREEN ──────────────────────────────────────────
 *
 * It mounted a second copy of ComplianceLibraryManagement outside the menu
 * system - a duplicate door to menu 206, which is already routed through
 * content-map-m1 - and it gated that copy on
 *
 *     ['employee', 'manager', 'hr'].includes(user.role)
 *
 * against a `Role` union whose members are 'employee', 'reporting_manager',
 * 'department_head', 'hr_executive', 'hr_manager', 'administrator',
 * 'executive', 'auditor' and 'recruiter'. Only 'employee' is a member, so the
 * guard let EMPLOYEES in and turned ADMINISTRATORS and HR MANAGERS away - the
 * exact inverse of the intent, on a screen about disciplinary and compliance
 * records.
 *
 * The same dead vocabulary made app/organization/setup unreachable for
 * everybody; both were written against role names that predate `role_key`.
 *
 * Redirecting rather than fixing the guard removes the duplicate door
 * altogether: there is one Compliance Library in the product, it hangs off menu
 * 206, and its permissions come from the rights matrix like every other screen -
 * not from a hardcoded list that has to be kept in step by hand.
 */
export default function ComplianceManagementRedirectPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const { resolveAccessLink, loading: navLoading } = useSidebarNavigation()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push('/login')
      return
    }

    // Wait for the navigation, or resolveAccessLink returns '/dashboard' for a
    // link the user can actually reach.
    if (navLoading) return

    router.push(resolveAccessLink(COMPLIANCE_LIBRARY_ACCESS_LINK))
  }, [isLoading, user, router, navLoading, resolveAccessLink])

  return null
}
