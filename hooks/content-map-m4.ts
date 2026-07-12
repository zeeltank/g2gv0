import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const LmsDashboard = createLazyComponent(() => import('@/components/lms/dashboard').then((m) => ({ default: m.LmsDashboard })))
const LearningCatalog = createLazyComponent(() => import('@/components/lms/catalog').then((m) => ({ default: m.LearningCatalog })))
const CreateCoursePage = createLazyComponent(() => import('@/components/lms/course-builder/create-course-page').then((m) => ({ default: m.CreateCoursePage })))
const LearningAssignments = createLazyComponent(() => import('@/components/lms/assignments').then((m) => ({ default: m.LearningAssignments })))
const LearningDeliveryWorkspace = createLazyComponent(() => import('@/components/lms/delivery').then((m) => ({ default: m.LearningDeliveryWorkspace })))
const SessionsCalendar = createLazyComponent(() => import('@/components/lms/sessions').then((m) => ({ default: m.SessionsCalendar })))
const CertificationsRecords = createLazyComponent(() => import('@/components/lms/records').then((m) => ({ default: m.CertificationsRecords })))
const LmsGovernance = createLazyComponent(() => import('@/components/lms/governance').then((m) => ({ default: m.LmsGovernance })))

export const M4_CONTENT: ContentRoute[] = [
  { submenuId: 'lms-dashboard', component: LmsDashboard },
  { submenuId: 'learning-catalog', component: LearningCatalog },
  { submenuId: 'my-learning', component: LearningDeliveryWorkspace },
  { submenuId: 'create-course', component: CreateCoursePage },
  { submenuId: 'assignments', component: LearningAssignments },
  { submenuId: 'sessions-calendar', component: SessionsCalendar },
  { submenuId: 'certifications', component: CertificationsRecords },
  { submenuId: 'governance', component: LmsGovernance },
]
