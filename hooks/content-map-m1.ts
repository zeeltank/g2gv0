import { createLazyComponent, type ContentRoute } from './use-content-map-utils'
import {
  ORG_PROFILE_ACCESS_LINK,
  DEPT_MANAGEMENT_ACCESS_LINK,
  EMPLOYEE_DIRECTORY_ACCESS_LINK,
  ROLE_PERMISSIONS_ACCESS_LINK,
  COMPLIANCE_LIBRARY_ACCESS_LINK,
  DISCIPLINARY_LIBRARY_ACCESS_LINK,
} from '@/lib/gtg-navigation'

const OrganizationInformation = createLazyComponent(() => import('@/domain/organization/organization-information').then((m) => ({ default: m.OrganizationInformation })))
const DepartmentList = createLazyComponent(() => import('@/domain/organization/department-management/department-list').then((m) => ({ default: m.DepartmentList })))
const EmployeeDirectory = createLazyComponent(() => import('@/domain/organization/employee-directory').then((m) => ({ default: m.EmployeeDirectory })))
const RolePermissions = createLazyComponent(() => import('@/domain/organization/role-permissions').then((m) => ({ default: m.RolePermissions })))
const ComplianceLibraryManagement = createLazyComponent(() => import('@/domain/hrms/compliance-discipline/compliance-library-management').then((m) => ({ default: m.ComplianceLibraryManagement })))
const DisciplinaryManagement = createLazyComponent(() => import('@/domain/hrms/compliance-discipline/disciplinary-management').then((m) => ({ default: m.DisciplinaryManagement })))

// accessLink is the stable tblmenumaster_g2g column (Organizational
// Management, module id 1); submenuId is kept only as a fallback in case a
// row's access_link is ever missing/blank.
export const M1_CONTENT: ContentRoute[] = [
  { accessLink: ORG_PROFILE_ACCESS_LINK,  component: OrganizationInformation }, // Organization Profile
  { accessLink: DEPT_MANAGEMENT_ACCESS_LINK,  component: DepartmentList }, // Department Management
  { accessLink: EMPLOYEE_DIRECTORY_ACCESS_LINK,  component: EmployeeDirectory }, // Employee Directory
  { accessLink: ROLE_PERMISSIONS_ACCESS_LINK,  component: RolePermissions }, // Role & Permissions
  { accessLink: COMPLIANCE_LIBRARY_ACCESS_LINK, component: ComplianceLibraryManagement }, // Compliance Library
  { accessLink: DISCIPLINARY_LIBRARY_ACCESS_LINK, component: DisciplinaryManagement }, // Disciplinary Library
]
