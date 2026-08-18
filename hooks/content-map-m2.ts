import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const CmCommandCenter = createLazyComponent(() => import('@/domain/competency/cm-command-center').then((m) => ({ default: m.CmCommandCenter })))
// Competency Definitions REMOVED 2026-08-18. Its two jobs — listing real
// competencies and creating them with their KASBA items — now live in the
// Competency Library, which has the richer screen and the same data.
const CmCompetencyLibrary = createLazyComponent(() => import('@/domain/competency/cm-competency-library').then((m) => ({ default: m.CmCompetencyLibrary })))
const CmLibrariesTaxonomy = createLazyComponent(() => import('@/domain/competency/cm-libraries-taxonomy').then((m) => ({ default: m.CmLibrariesTaxonomy })))
// Skill Taxonomy (menu 41) REMOVED 2026-08-18. The same authoring exists in
// Library & Taxonomy > KASBA tabs, so it was a second door to one room.
// The component file is kept, unreferenced; the /skill-taxonomy-tree ENDPOINT is
// kept too — Library & Taxonomy reads it.
const CmTaxonomyOntology = createLazyComponent(() => import('@/domain/competency/cm-taxonomy-ontology').then((m) => ({ default: m.CmTaxonomyOntology })))
const CmFrameworkMapping = createLazyComponent(() => import('@/domain/competency/cm-framework-mapping').then((m) => ({ default: m.CmFrameworkMapping })))
const CmAssessmentWorkspace = createLazyComponent(() => import('@/domain/competency/cm-assessment-workspace').then((m) => ({ default: m.CmAssessmentWorkspace })))
const CmMyCapabilityScreen = createLazyComponent(() => import('@/domain/competency/cm-my-capability-screen').then((m) => ({ default: m.CmMyCapabilityScreen })))
const CmTaskCompetencies = createLazyComponent(() => import('@/domain/competency/cm-task-competencies').then((m) => ({ default: m.CmTaskCompetencies })))
// Role Requirements - competency to job role. The chain link that had a screen,
// an API and no way to reach either: menu row 231 created 2026-08-13.
const CmRoleRequirements = createLazyComponent(() => import('@/domain/competency/role-requirements-panel').then((m) => ({ default: m.RoleRequirementsPanel })))
const CmCourseCompetencies = createLazyComponent(() => import('@/domain/competency/cm-course-competencies').then((m) => ({ default: m.CmCourseCompetencies })))
const CmAudit = createLazyComponent(() => import('@/domain/competency/cm-audit').then((m) => ({ default: m.CmAudit })))

// accessLink is the stable tblmenumaster_g2g column (Competency Library menu,
// id 34, of module 2); submenuId is kept as a fallback.
// NOTE: ids 38 ("Competency Library"), 39 ("Libraries & Taxonomy") and 208
// ("Audit & Activity Center") don't currently exist as tblmenumaster_g2g
// rows — confirmed via a live DB query — so they have no access_link and
// keep matching on submenuId only (already broken pre-migration; unchanged).
export const M2_CONTENT: ContentRoute[] = [
  { accessLink: '/module/capability-intelligence/dashboard', component: CmCommandCenter }, // Command Center
  { accessLink: '/module/capability-intelligence/competency-library', submenuId: '34', component: CmCompetencyLibrary }, // Competency Library
  { accessLink: '/module/capability-intelligence/competency-framework', submenuId: '154', component: CmFrameworkMapping }, // Framework & Role Mapping
  { accessLink: '/module/capability-intelligence/capability', submenuId: '223', component: CmLibrariesTaxonomy }, // Libraries & Taxonomy
  { submenuId: '39', component: CmLibrariesTaxonomy }, // Libraries & Taxonomy
  { accessLink: '/module/capability-intelligence/capability-explorer', submenuId: '43', component: CmTaxonomyOntology }, // Taxonomy Ontology
  { accessLink: '/module/capability-intelligence/assessments', submenuId: '155', component: CmAssessmentWorkspace }, // Assessments
  // G-UI-01: menu row 224, derived from sibling 156 rather than guessed. The
  // component existed and was correct for the whole of Slice 1; nothing mapped
  // an accessLink to it, so nobody could open it.
  { accessLink: '/module/capability-intelligence/my-capability', submenuId: '224', component: CmMyCapabilityScreen }, // My Capability
  // G-UI-01 AGAIN, and this time the component was a SUB-COMPONENT with props,
  // so it needed a host screen as well as a map row. `CmCompetencyComposer` was
  // built, correct, and unreachable: the `competency` table's only two writers
  // had no reachable caller, so no customer could define a competency at all.
  // Menu row 227 derived from sibling 156 (Employee Profiles) - parent_id 2,
  // level 2, page_type 'page', sub_institute_id '1,2,3,4,5,6,7,8,9,10,11',
  // sort_order 12 (next free) - NOT guessed.
  //
  // THE ID ITSELF WAS ALSO NOT GUESSED, and it needed not to be: this comment
  // said 225 until the insert returned 227. AUTO_INCREMENT is not "highest id
  // you can see plus one" - deleted rows and other tables' history move it. The
  // change script prints the id it created and says to correct this line if it
  // differs; that last line is the only reason the map is right.
  // COURSE -> COMPETENCY. The table LearningAssigner and RemediationRecommender
  // have been reading since they landed, with no writer until now. Menu row
  // derived from sibling 156, and the id taken from what the insert RETURNED -
  // the map said 225 for Competency Definitions until the database said 227.
  { accessLink: '/module/capability-intelligence/course-competencies', submenuId: '228', component: CmCourseCompetencies }, // Course Competencies
  // TASK -> COMPETENCY. jobrole_task_competency_map holds 0 rows; golden thread 2
  // carries the signal on task.skill_id today, hand-picked per ticket at 67%.
  { accessLink: '/module/capability-intelligence/task-competencies', submenuId: '229', component: CmTaskCompetencies }, // Task Competencies
  { accessLink: '/module/capability-intelligence/role-requirements', submenuId: '231', component: CmRoleRequirements }, // Role Requirements
  { submenuId: '208', component: CmAudit }, // Audit & Activity Center
]
