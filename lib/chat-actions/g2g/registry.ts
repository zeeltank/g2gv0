import { recordModuleActivitySafely } from '@/lib/intelligence/ai-module'
import { organizationService } from '@/services/organization'

import { ActionRegistry } from '../registry'
import { createDepartmentAction, type G2gActionApp } from './actions'

/**
 * G2G's registry, wired to G2G's own services. Add an action by adding a definition here -
 * the flow, the card and the confirmation rules are shared.
 */
export function createG2gActionRegistry(): ActionRegistry<G2gActionApp> {
  return new ActionRegistry<G2gActionApp>([
    createDepartmentAction({
      listDepartments: async (context) => {
        const response = await organizationService.getDepartmentsManagement(context)
        const all = response.departments ?? [
          ...response.main_departments,
          ...Object.values(response.sub_departments).flat(),
        ]

        return all.map((department) => ({ id: department.id, department: department.department }))
      },
      createDepartment: organizationService.createDepartment,
      record: (moduleKey, entry) => recordModuleActivitySafely(moduleKey, entry as never),
    }),
  ])
}
