import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const CmCommandCenter = createLazyComponent(() => import('@/domain/competency/cm-command-center').then((m) => ({ default: m.CmCommandCenter })))
const CmCompetencyLibrary = createLazyComponent(() => import('@/domain/competency/cm-competency-library').then((m) => ({ default: m.CmCompetencyLibrary })))
const CmLibrariesTaxonomy = createLazyComponent(() => import('@/domain/competency/cm-libraries-taxonomy').then((m) => ({ default: m.CmLibrariesTaxonomy })))
const CmSkillTaxonomy = createLazyComponent(() => import('@/domain/competency/cm-skill-taxonomy').then((m) => ({ default: m.CmSkillTaxonomy })))
const CmTaxonomyOntology = createLazyComponent(() => import('@/domain/competency/cm-taxonomy-ontology').then((m) => ({ default: m.CmTaxonomyOntology })))
const CmFrameworkMapping = createLazyComponent(() => import('@/domain/competency/cm-framework-mapping').then((m) => ({ default: m.CmFrameworkMapping })))
const CmAssessmentWorkspace = createLazyComponent(() => import('@/domain/competency/cm-assessment-workspace').then((m) => ({ default: m.CmAssessmentWorkspace })))
const CmEmployeeProfiles = createLazyComponent(() => import('@/domain/competency/cm-employee-profiles').then((m) => ({ default: m.CmEmployeeProfiles })))
const CmDevelopmentCareer = createLazyComponent(() => import('@/domain/competency/cm-development-career').then((m) => ({ default: m.CmDevelopmentCareer })))
const CmCertifications = createLazyComponent(() => import('@/domain/competency/cm-certifications').then((m) => ({ default: m.CmCertifications })))
const CmAudit = createLazyComponent(() => import('@/domain/competency/cm-audit').then((m) => ({ default: m.CmAudit })))

// accessLink is the stable tblmenumaster_g2g column (Competency Library menu,
// id 34, of module 2); submenuId is kept as a fallback.
// NOTE: ids 38 ("Competency Library"), 39 ("Libraries & Taxonomy") and 208
// ("Audit & Activity Center") don't currently exist as tblmenumaster_g2g
// rows — confirmed via a live DB query — so they have no access_link and
// keep matching on submenuId only (already broken pre-migration; unchanged).
export const M2_CONTENT: ContentRoute[] = [
  { accessLink: '/module/competency-management/competency-library/command-center', component: CmCommandCenter }, // Command Center
  { accessLink: '/module/competency-management/competency-library', submenuId: '34', component: CmCompetencyLibrary }, // Competency Library
  { accessLink: '/module/competency-management/competency-library/framework-and-role-mapping', submenuId: '154', component: CmFrameworkMapping }, // Framework & Role Mapping
  { accessLink: '/module/competency-management/competency-library/libraries-and-taxonomy', submenuId: '223', component: CmLibrariesTaxonomy }, // Libraries & Taxonomy
  { submenuId: '39', component: CmLibrariesTaxonomy }, // Libraries & Taxonomy
  { accessLink: '/module/competency-management/competency-library/skill-taxonomy', submenuId: '41', component: CmSkillTaxonomy }, // Skills & Taxonomy
  { accessLink: '/module/competency-management/competency-library/taxonomy-ontology', submenuId: '43', component: CmTaxonomyOntology }, // Taxonomy Ontology
  { accessLink: '/module/competency-management/competency-library/assessments', submenuId: '155', component: CmAssessmentWorkspace }, // Assessments
  { accessLink: '/module/competency-management/competency-library/employee-profiles', submenuId: '156', component: CmEmployeeProfiles }, // Employee Profiles
  { accessLink: '/module/competency-management/competency-library/development-and-career-paths', submenuId: '157', component: CmDevelopmentCareer }, // Development & Career Paths
  { accessLink: '/module/competency-management/competency-library/certifications', submenuId: '158', component: CmCertifications }, // Certifications
  { submenuId: '208', component: CmAudit }, // Audit & Activity Center
]
