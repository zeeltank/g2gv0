import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const TalentDashboard = createLazyComponent(() => import('@/domain/talent/dashboard').then((m) => ({ default: m.TalentDashboard })))
const RecruitmentCenter = createLazyComponent(() => import('@/domain/talent/recruitment').then((m) => ({ default: m.RecruitmentCenter })))
const OnboardingCenter = createLazyComponent(() => import('@/domain/talent/onboarding').then((m) => ({ default: m.OnboardingCenter })))
const PerformanceCenter = createLazyComponent(() => import('@/domain/talent/performance').then((m) => ({ default: m.PerformanceCenter })))
const MobilityCenter = createLazyComponent(() => import('@/domain/talent/mobility-succession').then((m) => ({ default: m.MobilityCenter })))
const OffboardingCenter = createLazyComponent(() => import('@/domain/talent/offboarding').then((m) => ({ default: m.OffboardingCenter })))
const AdminCenter = createLazyComponent(() => import('@/domain/talent/administration').then((m) => ({ default: m.AdminCenter })))

// ── MOVED FROM COMPETENCY MANAGEMENT, 2026-08-18 ──────────────────────────
// These three menus now live under Talent Management (parent 3). The content
// map is keyed by MODULE ID, so a menu that moves module must have its entry
// move too — otherwise the sidebar shows the link and the page 404s.
//
// The accessLink still says /module/competency-management/... because that is
// the stable column in tblmenumaster_g2g and renaming it would break every
// bookmark and rights row pointing at it. THE URL IS AN IDENTIFIER, NOT A
// STATEMENT OF OWNERSHIP.
const CmEmployeeProfiles = createLazyComponent(() => import('@/domain/competency/cm-employee-profiles').then((m) => ({ default: m.CmEmployeeProfiles })))
const CmDevelopmentCareer = createLazyComponent(() => import('@/domain/competency/cm-development-career').then((m) => ({ default: m.CmDevelopmentCareer })))
const CmCertifications = createLazyComponent(() => import('@/domain/competency/cm-certifications').then((m) => ({ default: m.CmCertifications })))

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
  { accessLink: '/module/talent-management/employee-profiles', submenuId: '156', component: CmEmployeeProfiles }, // Employee Profiles
  { accessLink: '/module/talent-management/development-and-career-paths', submenuId: '157', component: CmDevelopmentCareer }, // Development & Career Paths
  { accessLink: '/module/talent-management/certifications', submenuId: '158', component: CmCertifications }, // Certifications
]
