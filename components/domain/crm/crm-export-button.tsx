'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  /** Already-built export URL (crmService.*ExportUrl(context, search)) - a plain navigation, same as DepartmentJobRoleExportController's precedent. */
  href: string
}

export function CrmExportButton({ href }: Props) {
  return (
    <Button variant="outline" onClick={() => { window.location.href = href }}>
      <Download className="mr-1.5 size-4" aria-hidden="true" />
      Export
    </Button>
  )
}
