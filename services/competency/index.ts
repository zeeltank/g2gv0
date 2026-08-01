/**
 * Competency Service barrel.
 *
 * The Competency Command Center is backed by the real Laravel
 * /api/competency/* endpoints via ./command-center. `competencyService` is kept
 * as an alias so existing re-exports (services/index.ts) keep resolving.
 */

export * from './command-center'
export { competencyCommandCenterService, competencyCommandCenterService as competencyService } from './command-center'

export * from './library'
export { competencyLibraryService } from './library'

export * from './libraries'
export { competencyLibrariesService } from './libraries'

export * from './approvals'
export { competencyApprovalService } from './approvals'

export * from './studio'
export { competencyStudioService } from './studio'

export * from './assessment-workspace'
export { assessmentWorkspaceService } from './assessment-workspace'

export * from './employee-profiles'
export { employeeProfileService } from './employee-profiles'

export * from './development-career'
export { developmentCareerService } from './development-career'

export * from './certifications'
export { certificationService } from './certifications'

export * from './audit'
export { competencyAuditService } from './audit'
