import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const TalentDashboard = createLazyComponent(() => import('@/domain/talent/dashboard').then((m) => ({ default: m.TalentDashboard })))
const RecruitmentCenter = createLazyComponent(() => import('@/domain/talent/recruitment').then((m) => ({ default: m.RecruitmentCenter })))
const OnboardingCenter = createLazyComponent(() => import('@/domain/talent/onboarding').then((m) => ({ default: m.OnboardingCenter })))
const PerformanceCenter = createLazyComponent(() => import('@/domain/talent/performance').then((m) => ({ default: m.PerformanceCenter })))
const MobilityCenter = createLazyComponent(() => import('@/domain/talent/mobility-succession').then((m) => ({ default: m.MobilityCenter })))
const OffboardingCenter = createLazyComponent(() => import('@/domain/talent/offboarding').then((m) => ({ default: m.OffboardingCenter })))
const AdminCenter = createLazyComponent(() => import('@/domain/talent/administration').then((m) => ({ default: m.AdminCenter })))

// accessLink is the stable tblmenumaster_g2g column (Talent Management,
// module id 3, menu-level rows); menuId is kept as a fallback.
export const M3_CONTENT: ContentRoute[] = [
  { accessLink: '/module/talent-management/talent-dashboard', menuId: '46', component: TalentDashboard }, // Talent Dashboard
  { accessLink: '/module/talent-management/recruitment', menuId: '47', component: RecruitmentCenter }, // Recruitment
  { accessLink: '/module/talent-management/onboarding', menuId: '48', component: OnboardingCenter }, // Onboarding
  { accessLink: '/module/talent-management/performance-reviews-and-appraisals', menuId: '49', component: PerformanceCenter }, // Performance Reviews & Appraisals
 { accessLink: '/module/talent-management/compensation', menuId: '50', component: PerformanceCenter }, // Compensation
  { accessLink: '/module/talent-management/mobility-and-succession', menuId: '52', component: MobilityCenter }, // Mobility & Succession
  { accessLink: '/module/talent-management/offboarding', menuId: '171', component: OffboardingCenter }, // Offboarding
  { accessLink: '/module/talent-management/administration', menuId: '178', component: AdminCenter }, // Administration
]
