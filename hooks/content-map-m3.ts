import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const TalentDashboard = createLazyComponent(() => import('@/domain/talent/dashboard').then((m) => ({ default: m.TalentDashboard })))
const RecruitmentCenter = createLazyComponent(() => import('@/domain/talent/recruitment').then((m) => ({ default: m.RecruitmentCenter })))
const OnboardingCenter = createLazyComponent(() => import('@/domain/talent/onboarding').then((m) => ({ default: m.OnboardingCenter })))
const PerformanceCenter = createLazyComponent(() => import('@/domain/talent/performance').then((m) => ({ default: m.PerformanceCenter })))
const MobilityCenter = createLazyComponent(() => import('@/domain/talent/mobility-succession').then((m) => ({ default: m.MobilityCenter })))
const OffboardingCenter = createLazyComponent(() => import('@/domain/talent/offboarding').then((m) => ({ default: m.OffboardingCenter })))
const AdminCenter = createLazyComponent(() => import('@/domain/talent/administration').then((m) => ({ default: m.AdminCenter })))

export const M3_CONTENT: ContentRoute[] = [
  { menuId: 'tm-dashboard', component: TalentDashboard },
  { menuId: 'recruitment', component: RecruitmentCenter },
  { menuId: 'onboarding', component: OnboardingCenter },
  { menuId: 'performance', component: PerformanceCenter },
  { menuId: 'mobility-succession', component: MobilityCenter },
  { menuId: 'offboarding', component: OffboardingCenter },
  { menuId: 'administration', component: AdminCenter },
]
