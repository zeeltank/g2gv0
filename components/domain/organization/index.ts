export { OrganizationDetailsForm as OrganizationDetails } from './organization-details'
export { OrganizationInformation } from './organization-information'
/*
 * Four department exports were removed here, all of them orphans:
 *
 *   DepartmentDetails   - an older copy of the details panel in which every
 *                         button lacked an onClick, and which fabricated an
 *                         "Open Positions" figure as employees / 12.
 *   DepartmentHierarchy - rendered a hardcoded 12-department demo fixture
 *                         (Engineering / 486 employees, and so on) instead of
 *                         the API. Reachable only via a redirect whose path
 *                         segment was misspelled, which is the sole reason
 *                         users never saw invented departments.
 *   department-table    - an older row menu whose five items had no handlers.
 *   department-utils    - a third copy of the department-code lookup table.
 *
 * The live screen is DepartmentList, loaded lazily by hooks/content-map-m1.ts
 * rather than through this barrel.
 */
export { DepartmentList } from './department-management/department-list'
export { EmployeeDirectory } from './employee-directory'
export { AddOrganizationDetail } from './add-organization-detail'
export { RolePermissions } from './role-permissions'

// Re-export custom org components
export {
  SectionCard,
  ReadField,
  FormField,
  TextInput,
  SelectInput,
  TextArea,
  AccessDenied,
  Tabs,
} from './components'
