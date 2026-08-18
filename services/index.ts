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
export { lmsService } from './lms'
export { hrmsService, leaveBiService, leaveService } from './hrms'
export { competencyService } from './competency'
export { talentService } from './talent'
export { sidebarService } from './navigation/sidebar'
export { menuRightsService } from './navigation/menu-rights'
