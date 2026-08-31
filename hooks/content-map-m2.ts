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
// Role Requirements - competency to job role. The chain link that had a screen,
// an API and no way to reach either: menu row 231 created 2026-08-13.
const CmAudit = createLazyComponent(() => import('@/domain/competency/cm-audit').then((m) => ({ default: m.CmAudit })))

// accessLink is the stable tblmenumaster_g2g column (Competency Library menu,
// id 34, of module 2); submenuId is kept as a fallback.
//
// THE THREE "MISSING MENUS" ARE RESOLVED (2026-08-31), and only one of them was
// real:
//
//   208  Audit & Activity Center — a genuine gap. CmAudit had no other route, so
//        a complete subsystem (the approval queue, six tabs, seven endpoints and
//        ~2,000 rows of activity log) was unreachable, while two reachable
//        screens could still SUBMIT into the queue nobody could open. Menu row
//        created on both databases at that exact id, gated to admin/hr to match
//        the API. It now resolves by accessLink like every other M2 screen.
//
//   39   NOT created, and removed from this map. It pointed at
//        CmLibrariesTaxonomy — the same component menu 223 already opens with a
//        working accessLink — so creating it would have put two sidebar entries
//        on one screen. This module has removed exactly that twice before (Skill
//        Taxonomy 41, Competency Definitions).
//
//   38   Was never a route at all; only this comment referred to it.
//
// Every M2 screen now has exactly one door.
export const M2_CONTENT: ContentRoute[] = [
  { accessLink: '/module/capability-intelligence/dashboard', component: CmCommandCenter }, // Command Center
  { accessLink: '/module/capability-intelligence/competency-library', submenuId: '34', component: CmCompetencyLibrary }, // Competency Library
  { accessLink: '/module/capability-intelligence/competency-framework', submenuId: '154', component: CmFrameworkMapping }, // Framework & Role Mapping
  { accessLink: '/module/capability-intelligence/capability-library', submenuId: '223', component: CmLibrariesTaxonomy }, // Libraries & Taxonomy
  { accessLink: '/module/capability-intelligence/capability-explorer', submenuId: '43', component: CmTaxonomyOntology }, // Taxonomy Ontology
  // ASSESSMENTS MOVED TO LMS on 2026-08-19 - see content-map-m4.ts. It is a
  // learning activity, not a competency-authoring screen, so it belongs with
  // the courses it assesses.
  // G-UI-01: menu row 224, derived from sibling 156 rather than guessed. The
  // component existed and was correct for the whole of Slice 1; nothing mapped
  // an accessLink to it, so nobody could open it.
  // MY CAPABILITY MOVED TO /profile on 2026-08-19, as a tab beside Job Role
  // Skills. It answers for whoever is signed in - the endpoint takes no user id
  // at all - so a profile page is where it belongs, not a sidebar submenu.
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
  // COURSE -> COMPETENCY LIVES IN THE COURSE BUILDER NOW, not on its own screen.
  // Menu removed 2026-08-19 (local 228 / live 225 - the ids differ). Mapped by
  // the person authoring the course, in Basic Information.
  // TASK -> COMPETENCY LIVES IN THE ASSIGN-TASK MODAL NOW, not on its own screen.
  // Menu 229 removed 2026-08-19; the mapping is edited by the person assigning the
  // work, who knows what it takes, instead of on a matrix nobody visited.
  // ROLE -> COMPETENCY LIVES IN THE JOB ROLE FORM NOW, not on its own screen.
  // Menu removed 2026-08-19 (local 231 / live 227 - the ids differ). Set by the
  // person defining the role, on the Capability screen's Job Role tab.
  { accessLink: '/module/capability-intelligence/audit', submenuId: '208', component: CmAudit }, // Audit & Activity Center
]
