import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const OrganizationInformation = createLazyComponent(() => import('@/components/org/organization-information').then((m) => ({ default: m.OrganizationInformation })))
const DepartmentList = createLazyComponent(() => import('@/components/org/department-list').then((m) => ({ default: m.DepartmentList })))
const DepartmentHierarchy = createLazyComponent(() => import('@/components/org/department-hierarchy').then((m) => ({ default: m.DepartmentHierarchy })))
const EmployeeDirectory = createLazyComponent(() => import('@/components/org/employee-directory').then((m) => ({ default: m.EmployeeDirectory })))
const RolePermissions = createLazyComponent(() => import('@/components/org/role-permissions').then((m) => ({ default: m.RolePermissions })))
const ComplianceLibraryManagement = createLazyComponent(() => import('@/components/compliance-discipline/compliance-library-management').then((m) => ({ default: m.ComplianceLibraryManagement })))
const DisciplinaryManagement = createLazyComponent(() => import('@/components/compliance-discipline/disciplinary-management').then((m) => ({ default: m.DisciplinaryManagement })))

export const M1_CONTENT: ContentRoute[] = [
  { submenuId: 'org-profile', component: OrganizationInformation },
  { submenuId: 'dept-management', component: DepartmentList },
  { submenuId: 'hierarchy', component: DepartmentHierarchy },
  { submenuId: 'employee-directory', component: EmployeeDirectory },
  { submenuId: 'role-permissions', component: RolePermissions },
  { submenuId: 'compliance-management', component: ComplianceLibraryManagement },
  { submenuId: 'disciplinary-management', component: DisciplinaryManagement },
]
