'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'

export default function OrganizationInformationPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    router.push('/module/organizational-management/org-setup/org-profile')
  }, [isLoading, user, router])

  if (isLoading) {
    return null
  }

  return null
}
