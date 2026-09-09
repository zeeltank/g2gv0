/*
 * `OrganizationDetails` and `AddOrganizationDetail` were removed, for the same
 * reason as the four department orphans described below.
 *
 *   organization-details.tsx      739 lines. Eight buttons with no onClick -
 *                                 Save Draft (twice), Change Logo, Add Sister
 *                                 Company, three unlabelled icon buttons and
 *                                 View & Edit Settings - three hardcoded sister
 *                                 companies ("ABC Infotech Pvt. Ltd.", ...) and
 *                                 a hardcoded "Showing 1 to 3 of 3 entries".
 *                                 Exported here and MOUNTED NOWHERE.
 *   add-organization-detail.tsx   338 lines. Six buttons with no onClick, no
 *                                 form and no submit handler; EVERY input
 *                                 unbound - no value, no onChange, including
 *                                 the logo file input - and its dropdowns
 *                                 prefilled with "GapstoGrowth Technologies
 *                                 (HQ)". Reachable only from an unlinked dev
 *                                 route, /organization/screens-showcase, which
 *                                 went with it.
 *
 * The live Organization Profile is OrganizationInformation, loaded by
 * hooks/content-map-m1.ts.
 */
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
