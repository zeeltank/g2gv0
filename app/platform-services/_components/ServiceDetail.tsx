'use client'

/**
 * What a service page says when the service has no console of its own yet.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT A "COMING SOON" PLACEHOLDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A placeholder tells somebody the thing does not exist and stops. That is wrong here in
 * both directions:
 *
 *   For a service that is not built, it is incomplete. Workflow has no designer, but
 *   Talent, Leave, Agentic and Competency each have a working approval path TODAY. An
 *   administrator who reads "coming soon" and concludes the product cannot do approvals
 *   has been misled by a true sentence.
 *
 *   For a service that IS built and simply lives elsewhere, it is false. Onboarding,
 *   RBAC, Integration and Mobile App Rights all work; their pages exist to point at the
 *   screen, not to apologise for it.
 *
 * So every page renders what the registry actually knows: what the service is for, why
 * it is central, what this product holds today, and — only where something is genuinely
 * missing — what still has to be built. `todayInG2g` names real tables and real
 * endpoints, which is what makes it checkable rather than reassuring.
 *
 * NOTHING HERE PROMISES A DATE. The registry carries a phase, not a quarter. A roadmap
 * that commits to timing in a product screen is a commitment nobody in the room made.
 */

import { PointList, SectionCard } from '@/components/shared/console-ui'
import type { PlatformService } from '@shared/platform-services-core'

export function ServiceDetail({ service }: { service: PlatformService }) {
  const isBuilt = service.destination.kind !== 'not-built'

  return (
    <div className="mt-6 space-y-4">
      <SectionCard title="In this organisation today" description={service.todayInG2g} />

      <SectionCard title="Why it is a platform service" description={service.whyCentral} />

      {service.toBuild.length > 0 && (
        <SectionCard
          title="Still to build"
          description={
            isBuilt
              ? 'This service works today. These are the parts of it that do not yet.'
              : 'There is no screen for this yet. This is what it needs.'
          }
        >
          <PointList points={service.toBuild} />
        </SectionCard>
      )}
    </div>
  )
}
