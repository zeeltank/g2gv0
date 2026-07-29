/**
 * Services Index
 * Central export point for all API services
 */

// Core
export { apiClient, webClient, ApiClient } from './core'

// Domain Services
export { authService } from './auth'
export { organizationService } from './organization'
export { taskService } from './task'
export { lmsService, lmsDashboardService, lmsCatalogService, aiCourseService, lmsSessionService } from './lms'
export { hrmsService, leaveService } from './hrms'
export { competencyService } from './competency'
export { talentService } from './talent'
