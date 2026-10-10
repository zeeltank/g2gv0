'use client'

/**
 * CRM's "Master Fields" menu row (id 202, reactivated from the abandoned
 * scaffolding this migration reused) is the entry point the plan always
 * intended for custom-fields admin - but the actual console already exists
 * and is already table-agnostic (`FieldsConfigurationConsole`), so this is
 * a thin redirect to it scoped to `?module=crm`, not a second console.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function CrmMasterFieldsRoute() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/platform-services/fields-configuration?module=crm')
  }, [router])

  return (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Opening Manage Fields…
    </div>
  )
}
