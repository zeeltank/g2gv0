import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const LmsDashboard = createLazyComponent(() => import('@/domain/lms/dashboard').then((m) => ({ default: m.LmsDashboard })))
const LearningCatalog = createLazyComponent(() => import('@/domain/lms/catalog').then((m) => ({ default: m.LearningCatalog })))
const CreateCoursePage = createLazyComponent(() => import('@/domain/lms/course-builder/create-course-page').then((m) => ({ default: m.CreateCoursePage })))
const LearningAssignments = createLazyComponent(() => import('@/domain/lms/assignments').then((m) => ({ default: m.LearningAssignments })))
const LearningDeliveryWorkspace = createLazyComponent(() => import('@/domain/lms/delivery').then((m) => ({ default: m.LearningDeliveryWorkspace })))
const SessionsCalendar = createLazyComponent(() => import('@/domain/lms/sessions').then((m) => ({ default: m.SessionsCalendar })))
const CertificationsRecords = createLazyComponent(() => import('@/domain/lms/records').then((m) => ({ default: m.CertificationsRecords })))
const LmsGovernance = createLazyComponent(() => import('@/domain/lms/governance').then((m) => ({ default: m.LmsGovernance })))

// accessLink is the stable tblmenumaster_g2g column (LMS, module id 4);
// submenuId is kept as a fallback.
export const M4_CONTENT: ContentRoute[] = [
  { accessLink: '/module/lms/learning/learning-dashboard', submenuId: '80', component: LmsDashboard }, // Learning Dashboard
  { accessLink: '/module/lms/learning/learning-catalog', submenuId: '182', component: LearningCatalog }, // Learning Catalog
  { accessLink: '/module/lms/learning/my-learning', submenuId: '209', component: LearningDeliveryWorkspace }, // My Learning
  { accessLink: '/module/lms/administration/course-builder', submenuId: '84', component: CreateCoursePage }, // Course Builder
  { accessLink: '/module/lms/training-and-records/assignments', submenuId: '81', component: LearningAssignments }, // Assignments
  { accessLink: '/module/lms/training-and-records/sessions-and-calendar', submenuId: '82', component: SessionsCalendar }, // Sessions & Calendar
  { accessLink: '/module/lms/training-and-records/certifications-and-records', submenuId: '83', component: CertificationsRecords }, // Certifications & Records
  { accessLink: '/module/lms/administration/administration-and-governance', submenuId: '85', component: LmsGovernance }, // Administration & Governance
]
