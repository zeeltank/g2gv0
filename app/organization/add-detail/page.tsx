'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { ORG_PROFILE_ACCESS_LINK } from '@/lib/gtg-navigation'

export default function AddOrganizationDetailPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const { resolveAccessLink, loading: navLoading } = useSidebarNavigation()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (navLoading) return
    router.push(resolveAccessLink(ORG_PROFILE_ACCESS_LINK))
  }, [isLoading, user, router, navLoading, resolveAccessLink])

  if (isLoading) {
    return null
  }

  return null
}
