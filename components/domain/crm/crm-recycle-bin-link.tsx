'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CRM_RECYCLE_BIN_PATH } from '@/lib/gtg-navigation'

/**
 * Shared header link into the Recycle Bin, used by all 4 CRM list views.
 * A literal `router.push` - the Recycle Bin has no menu row for
 * `resolveAccessLink()` to resolve (see CRM_RECYCLE_BIN_PATH).
 */
export function CrmRecycleBinLink() {
  const router = useRouter()

  return (
    <Button variant="outline" onClick={() => router.push(CRM_RECYCLE_BIN_PATH)}>
      <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
      Recycle Bin
    </Button>
  )
}
