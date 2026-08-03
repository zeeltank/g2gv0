import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const TalentDashboard = createLazyComponent(() => import('@/domain/talent/dashboard').then((m) => ({ default: m.TalentDashboard })))
const RecruitmentCenter = createLazyComponent(() => import('@/domain/talent/recruitment').then((m) => ({ default: m.RecruitmentCenter })))
const OnboardingCenter = createLazyComponent(() => import('@/domain/talent/onboarding').then((m) => ({ default: m.OnboardingCenter })))
const PerformanceCenter = createLazyComponent(() => import('@/domain/talent/performance').then((m) => ({ default: m.PerformanceCenter })))
const MobilityCenter = createLazyComponent(() => import('@/domain/talent/mobility-succession').then((m) => ({ default: m.MobilityCenter })))
const OffboardingCenter = createLazyComponent(() => import('@/domain/talent/offboarding').then((m) => ({ default: m.OffboardingCenter })))
const AdminCenter = createLazyComponent(() => import('@/domain/talent/administration').then((m) => ({ default: m.AdminCenter })))

// Ids are tblmenumaster_g2g menu-level rows (Talent Management, module id 3).
export const M3_CONTENT: ContentRoute[] = [
  { menuId: '46', component: TalentDashboard }, // Talent Dashboard
  { menuId: '47', component: RecruitmentCenter }, // Recruitment
  { menuId: '48', component: OnboardingCenter }, // Onboarding
  { menuId: '49', component: PerformanceCenter }, // Performance Reviews & Appraisals
  { menuId: '52', component: MobilityCenter }, // Mobility & Succession
  { menuId: '171', component: OffboardingCenter }, // Offboarding
  { menuId: '178', component: AdminCenter }, // Administration
]
