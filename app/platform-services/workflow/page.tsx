'use client'

/**
 * Workflows.
 *
 * One page for what a business wants to happen without chasing it: who signs a request off (Approvals), what is set to happen when something changes in Sales &
 * Marketing (Automations), and what actually ran (Runs). This file is only the shell: the header comes from the service registry, the tabs from `WorkflowTabs`, and each
 * tab is a folder of its own beside it.
 *
 * `?module=` pins the page to one module. Sales & Marketing (`crm`) and the central view, which has no module, carry all three tabs; every other module shows Approvals
 * alone, exactly as before (lib/platform/workflow-tabs.ts). Automations and Runs read the tenant's GTM engine, which has no split by module, and say so.
 */

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { isDecentralizedModule } from '@/lib/platform/access-links'

import { ServiceShell } from '../_components/ServiceShell'
import { ApprovalsTab } from './_components/approvals'
import { AutomationsTab, RunsTab } from './_components/automations'
import { WorkflowTabs } from './_components/WorkflowTabs'

export default function WorkflowPage() {
  return (
    <Suspense fallback={null}>
      <WorkflowConsole />
    </Suspense>
  )
}

function WorkflowConsole() {
  /** `?module=hrms` etc. pins the page to one module. Absent on the central hub, which shows every module's approvals. */
  const rawModuleKey = useSearchParams().get('module')
  const moduleKey = isDecentralizedModule(rawModuleKey) ? rawModuleKey : null

  return (
    <ServiceShell slug="workflow">
      <div className="mt-6">
        <WorkflowTabs
          moduleKey={moduleKey}
          panels={{
            automations: <AutomationsTab />,
            // Keyed by the module, so moving between two modules never shows the first one's approvals under the second one's name.
            approvals: <ApprovalsTab key={moduleKey ?? 'all'} moduleKey={moduleKey} />,
            runs: <RunsTab />,
          }}
        />
      </div>
    </ServiceShell>
  )
}
