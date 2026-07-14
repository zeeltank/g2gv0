'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'

export default function DepartmentHierarchyPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    router.push('/module/m1/org-setup/hierarchy')
  }, [isLoading, user, router])

  if (isLoading) {
    return null
  }

  return null
}
