/**
 * Talent Service
 * API calls for talent management - recruitment, onboarding, performance
 */

export { isOpenJobPosting, recruitmentService } from './recruitment'
export { talentDashboardService } from './dashboard'

/*
 * This file used to carry a `talentService` object and four interfaces below
 * these exports, calling `/performance-reviews`, `/onboarding-tasks` and
 * `/candidates` — none of which exist in Laravel. They were kept "so no existing
 * import breaks"; nothing imported them, and they have been deleted.
 *
 * The live modules are `/api/performance/*` and `/api/onboarding/*`, and they
 * live entirely in ./performance and ./onboarding.
 */
export { performanceService } from './performance'
export { onboardingService } from './onboarding'
export { mobilityService } from './mobility'
export { offboardingService } from './offboarding'
