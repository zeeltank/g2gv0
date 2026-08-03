import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const OrganizationInformation = createLazyComponent(() => import('@/domain/organization/organization-information').then((m) => ({ default: m.OrganizationInformation })))
const DepartmentList = createLazyComponent(() => import('@/domain/organization/department-management/department-list').then((m) => ({ default: m.DepartmentList })))
const EmployeeDirectory = createLazyComponent(() => import('@/domain/organization/employee-directory').then((m) => ({ default: m.EmployeeDirectory })))
const RolePermissions = createLazyComponent(() => import('@/domain/organization/role-permissions').then((m) => ({ default: m.RolePermissions })))
const ComplianceLibraryManagement = createLazyComponent(() => import('@/domain/hrms/compliance-discipline/compliance-library-management').then((m) => ({ default: m.ComplianceLibraryManagement })))
const DisciplinaryManagement = createLazyComponent(() => import('@/domain/hrms/compliance-discipline/disciplinary-management').then((m) => ({ default: m.DisciplinaryManagement })))

// Ids are tblmenumaster_g2g rows (Organizational Management, module id 1).
export const M1_CONTENT: ContentRoute[] = [
  { submenuId: '12', component: OrganizationInformation }, // Organization Profile
  { submenuId: '13', component: DepartmentList }, // Department Management
  { submenuId: '22', component: EmployeeDirectory }, // Employee Directory
  { submenuId: '23', component: RolePermissions }, // Role & Permissions
  { submenuId: '206', component: ComplianceLibraryManagement }, // Compliance Library
  { submenuId: '207', component: DisciplinaryManagement }, // Disciplinary Library
]
