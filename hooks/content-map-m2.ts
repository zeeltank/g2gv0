import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const CmCommandCenter = createLazyComponent(() => import('@/components/competency/cm-command-center').then((m) => ({ default: m.CmCommandCenter })))
const CmCompetencyLibrary = createLazyComponent(() => import('@/components/competency/cm-competency-library').then((m) => ({ default: m.CmCompetencyLibrary })))
const CmFrameworkMapping = createLazyComponent(() => import('@/components/competency/cm-framework-mapping').then((m) => ({ default: m.CmFrameworkMapping })))
const CmAssessmentWorkspace = createLazyComponent(() => import('@/components/competency/cm-assessment-workspace').then((m) => ({ default: m.CmAssessmentWorkspace })))
const CmEmployeeProfiles = createLazyComponent(() => import('@/components/competency/cm-employee-profiles').then((m) => ({ default: m.CmEmployeeProfiles })))
const CmDevelopmentCareer = createLazyComponent(() => import('@/components/competency/cm-development-career').then((m) => ({ default: m.CmDevelopmentCareer })))
const CmCertifications = createLazyComponent(() => import('@/components/competency/cm-certifications').then((m) => ({ default: m.CmCertifications })))
const CmAudit = createLazyComponent(() => import('@/components/competency/cm-audit').then((m) => ({ default: m.CmAudit })))

export const M2_CONTENT: ContentRoute[] = [
  { submenuId: 'cm-command-center', component: CmCommandCenter },
  { submenuId: 'cm-competency-library', component: CmCompetencyLibrary },
  { submenuId: 'cm-framework-mapping', component: CmFrameworkMapping },
  { submenuId: 'cm-assessments', component: CmAssessmentWorkspace },
  { submenuId: 'cm-employee-profiles', component: CmEmployeeProfiles },
  { submenuId: 'cm-development-career', component: CmDevelopmentCareer },
  { submenuId: 'cm-certifications', component: CmCertifications },
  { submenuId: 'cm-audit', component: CmAudit },
]
