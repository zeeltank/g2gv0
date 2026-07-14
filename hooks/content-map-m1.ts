import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const OrganizationInformation = createLazyComponent(() => import('@/domain/organization/organization-information').then((m) => ({ default: m.OrganizationInformation })))
const DepartmentList = createLazyComponent(() => import('@/domain/organization/department-management/department-list').then((m) => ({ default: m.DepartmentList })))
const DepartmentHierarchy = createLazyComponent(() => import('@/domain/organization/department-management/department-hierarchy').then((m) => ({ default: m.DepartmentHierarchy })))
const EmployeeDirectory = createLazyComponent(() => import('@/domain/organization/employee-directory').then((m) => ({ default: m.EmployeeDirectory })))
const RolePermissions = createLazyComponent(() => import('@/domain/organization/role-permissions').then((m) => ({ default: m.RolePermissions })))
const ComplianceLibraryManagement = createLazyComponent(() => import('@/domain/hrms/compliance-discipline/compliance-library-management').then((m) => ({ default: m.ComplianceLibraryManagement })))
const DisciplinaryManagement = createLazyComponent(() => import('@/domain/hrms/compliance-discipline/disciplinary-management').then((m) => ({ default: m.DisciplinaryManagement })))

export const M1_CONTENT: ContentRoute[] = [
  { submenuId: 'org-profile', component: OrganizationInformation },
  { submenuId: 'dept-management', component: DepartmentList },
  { submenuId: 'hierarchy', component: DepartmentHierarchy },
  { submenuId: 'employee-directory', component: EmployeeDirectory },
  { submenuId: 'role-permissions', component: RolePermissions },
  { submenuId: 'compliance-management', component: ComplianceLibraryManagement },
  { submenuId: 'disciplinary-management', component: DisciplinaryManagement },
]
