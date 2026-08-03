import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const CmCommandCenter = createLazyComponent(() => import('@/domain/competency/cm-command-center').then((m) => ({ default: m.CmCommandCenter })))
const CmCompetencyLibrary = createLazyComponent(() => import('@/domain/competency/cm-competency-library').then((m) => ({ default: m.CmCompetencyLibrary })))
const CmFrameworkMapping = createLazyComponent(() => import('@/domain/competency/cm-framework-mapping').then((m) => ({ default: m.CmFrameworkMapping })))
const CmAssessmentWorkspace = createLazyComponent(() => import('@/domain/competency/cm-assessment-workspace').then((m) => ({ default: m.CmAssessmentWorkspace })))
const CmEmployeeProfiles = createLazyComponent(() => import('@/domain/competency/cm-employee-profiles').then((m) => ({ default: m.CmEmployeeProfiles })))
const CmDevelopmentCareer = createLazyComponent(() => import('@/domain/competency/cm-development-career').then((m) => ({ default: m.CmDevelopmentCareer })))
const CmCertifications = createLazyComponent(() => import('@/domain/competency/cm-certifications').then((m) => ({ default: m.CmCertifications })))
const CmAudit = createLazyComponent(() => import('@/domain/competency/cm-audit').then((m) => ({ default: m.CmAudit })))

// Ids are tblmenumaster_g2g rows, all under the "Competency Library" menu (id 34) of module 2.
export const M2_CONTENT: ContentRoute[] = [
  { submenuId: '37', component: CmCommandCenter }, // Command Center
  { submenuId: '38', component: CmCompetencyLibrary }, // Competency Library
  { submenuId: '154', component: CmFrameworkMapping }, // Framework & Role Mapping
  { submenuId: '155', component: CmAssessmentWorkspace }, // Assessments
  { submenuId: '156', component: CmEmployeeProfiles }, // Employee Profiles
  { submenuId: '157', component: CmDevelopmentCareer }, // Development & Career Paths
  { submenuId: '158', component: CmCertifications }, // Certifications
  { submenuId: '208', component: CmAudit }, // Audit & Activity Center
]
