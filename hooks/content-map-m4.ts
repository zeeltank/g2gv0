import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const LmsDashboard = createLazyComponent(() => import('@/domain/lms/dashboard').then((m) => ({ default: m.LmsDashboard })))
const LearningCatalog = createLazyComponent(() => import('@/domain/lms/catalog').then((m) => ({ default: m.LearningCatalog })))
const CreateCoursePage = createLazyComponent(() => import('@/domain/lms/course-builder/create-course-page').then((m) => ({ default: m.CreateCoursePage })))
const LearningAssignments = createLazyComponent(() => import('@/domain/lms/assignments').then((m) => ({ default: m.LearningAssignments })))
const LearningDeliveryWorkspace = createLazyComponent(() => import('@/domain/lms/delivery').then((m) => ({ default: m.LearningDeliveryWorkspace })))
const SessionsCalendar = createLazyComponent(() => import('@/domain/lms/sessions').then((m) => ({ default: m.SessionsCalendar })))
const CertificationsRecords = createLazyComponent(() => import('@/domain/lms/records').then((m) => ({ default: m.CertificationsRecords })))
const LmsGovernance = createLazyComponent(() => import('@/domain/lms/governance').then((m) => ({ default: m.LmsGovernance })))

// Ids are tblmenumaster_g2g rows (LMS, module id 4).
export const M4_CONTENT: ContentRoute[] = [
  { submenuId: '80', component: LmsDashboard }, // Learning Dashboard
  { submenuId: '182', component: LearningCatalog }, // Learning Catalog
  { submenuId: '209', component: LearningDeliveryWorkspace }, // My Learning
  { submenuId: '84', component: CreateCoursePage }, // Course Builder
  { submenuId: '81', component: LearningAssignments }, // Assignments
  { submenuId: '82', component: SessionsCalendar }, // Sessions & Calendar
  { submenuId: '83', component: CertificationsRecords }, // Certifications & Records
  { submenuId: '85', component: LmsGovernance }, // Administration & Governance
]
