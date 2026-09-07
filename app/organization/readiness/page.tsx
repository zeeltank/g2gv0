'use client'

import { OrganizationReadiness } from '@/domain/organization/organization-readiness'

/**
 * The readiness screen now lives in components/domain/organization so the
 * content map can mount it from its menu row. This route is kept as a thin
 * wrapper: the URL was the ONLY way in before the menu existed, and anything
 * already pointing at it should keep working.
 */
export default function ReadinessGatesPage() {
  return <OrganizationReadiness />
}
