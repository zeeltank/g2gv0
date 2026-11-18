'use client'

import { useState } from 'react'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { Tabs } from '../components'
import { ProcessLibrary } from './process-library'
import { SopsTab } from './sops-tab'
import { PoliciesTab } from './policies-tab'
import { RulesTab } from './rules-tab'

const SECTIONS = [
  { id: 'processes', label: 'Processes' },
  { id: 'sops', label: 'SOPs' },
  { id: 'policies', label: 'Policies' },
  { id: 'rules', label: 'Rules' },
]

/**
 * The drawer's Process tab.
 *
 * SOPs, Policies and Rules used to be their own top-level tabs, sitting next
 * to Process as unrelated siblings even though a process step routinely
 * points at one of them (the hiring process's offer-approval step references
 * the Offer Approval SOP; the leave process references the Leave Policy).
 * They move here as sub-sections instead of folding their storage into the
 * process graph: SopsTab/PoliciesTab/RulesTab keep their own tables, their
 * own file upload (SOPs), their own CRUD - a process step just references a
 * record by id (see DepartmentProcessStep.linked_sop_id et al. in the canvas
 * builder). One place to manage a department's whole governance story, one
 * source of truth for each piece of it.
 */
export function ProcessTab({
  department,
  context,
  canManage,
}: {
  department: Department
  context: LaravelContext
  canManage: boolean
}) {
  const [section, setSection] = useState('processes')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-3">
        <Tabs tabs={SECTIONS} active={section} onChange={setSection} />
      </div>

      <div className="min-h-0 flex-1">
        {section === 'processes' && (
          <ProcessLibrary department={department} context={context} canManage={canManage} />
        )}
        {section === 'sops' && <SopsTab department={department} context={context} canManage={canManage} />}
        {section === 'policies' && <PoliciesTab department={department} context={context} canManage={canManage} />}
        {section === 'rules' && <RulesTab department={department} context={context} canManage={canManage} />}
      </div>
    </div>
  )
}
