import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const LmsDashboard = createLazyComponent(() => import('@/domain/lms/dashboard').then((m) => ({ default: m.LmsDashboard })))
const LearningCatalog = createLazyComponent(() => import('@/domain/lms/catalog').then((m) => ({ default: m.LearningCatalog })))
const CreateCoursePage = createLazyComponent(() => import('@/domain/lms/course-builder/create-course-page').then((m) => ({ default: m.CreateCoursePage })))
const LearningAssignments = createLazyComponent(() => import('@/domain/lms/assignments').then((m) => ({ default: m.LearningAssignments })))
const CapabilityGapInbox = createLazyComponent(() => import('@/domain/lms/gap-inbox').then((m) => ({ default: m.CapabilityGapInbox })))
const SimulationLearning = createLazyComponent(() => import('@/domain/lms/simulations').then((m) => ({ default: m.SimulationLearning })))
const LearningDeliveryWorkspace = createLazyComponent(() => import('@/domain/lms/delivery').then((m) => ({ default: m.LearningDeliveryWorkspace })))
const SessionsCalendar = createLazyComponent(() => import('@/domain/lms/sessions').then((m) => ({ default: m.SessionsCalendar })))
const CertificationsRecords = createLazyComponent(() => import('@/domain/lms/records').then((m) => ({ default: m.CertificationsRecords })))
const LmsGovernance = createLazyComponent(() => import('@/domain/lms/governance').then((m) => ({ default: m.LmsGovernance })))
const CmAssessmentWorkspace = createLazyComponent(() => import('@/domain/competency/cm-assessment-workspace').then((m) => ({ default: m.CmAssessmentWorkspace })))
// The EMPLOYEE's own assessment. Deliberately a different component from the
// workspace above: that one is admin/hr and renders correct answers.
const CmMyAssessment = createLazyComponent(() => import('@/domain/competency/cm-my-assessment').then((m) => ({ default: m.CmMyAssessment })))

// accessLink is the stable tblmenumaster_g2g column (LMS, module id 4);
// submenuId is kept as a fallback.
export const M4_CONTENT: ContentRoute[] = [
  { accessLink: '/module/lms/assessments', submenuId: '155', component: CmAssessmentWorkspace }, // Assessments — moved from Capability Intelligence 2026-08-19
  { accessLink: '/module/lms/learning/learning-dashboard', submenuId: '80', component: LmsDashboard }, // Learning Dashboard
  { accessLink: '/module/lms/learning/learning-catalog', submenuId: '182', component: LearningCatalog }, // Learning Catalog
  { accessLink: '/module/lms/learning/my-learning', submenuId: '209', component: LearningDeliveryWorkspace }, // My Learning
  { accessLink: '/module/lms/learning/my-assessment', submenuId: '301', component: CmMyAssessment }, // My Assessment — beside My Learning, added 2026-08-26
  // Simulation Learning — no submenuId on purpose: the tblmenumaster_g2g row is created by hp_erp's
  // 2026_12_03_090100 migration and its id differs between hosts, so it is matched by access_link only.
  { accessLink: '/module/lms/simulation-learning', component: SimulationLearning }, // Simulation Learning
  { accessLink: '/module/lms/administration/course-builder', submenuId: '84', component: CreateCoursePage }, // Course Builder
  { accessLink: '/module/lms/training-and-records/assignments', submenuId: '81', component: LearningAssignments }, // Assignments
  // Capability Gap Inbox — no submenuId yet: needs a tblmenumaster_g2g row
  // with this exact access_link before it has a menu entry. See the
  // manual-step note in LMS_CAPABILITY_GAP_INBOX_ACCESS_LINK's own comment.
  { accessLink: '/module/lms/training-and-records/capability-gap-inbox', component: CapabilityGapInbox }, // Capability Gap Inbox
  { accessLink: '/module/lms/training-and-records/sessions-and-calendar', submenuId: '82', component: SessionsCalendar }, // Sessions & Calendar
  { accessLink: '/module/lms/training-and-records/certifications-and-records', submenuId: '83', component: CertificationsRecords }, // Certifications & Records
  { accessLink: '/module/lms/administration/administration-and-governance', submenuId: '85', component: LmsGovernance }, // Administration & Governance
]
