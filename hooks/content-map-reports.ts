import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

/**
 * The Reports module (tblmenumaster_g2g id 6).
 *
 * ── THIS MODULE HAS NEVER HAD A CONTENT MAP ─────────────────────────────────
 *
 * `use-content-map.ts` keys loaders by module id and has entries for
 * m0/300/1/2/3/4/5/204/186 — every module except this one. So Reports carries
 * ten menu groups (Communication, HRMS, Document, Log, Counselling, Frontdesk,
 * LMS, Task Analysis, ...) and not one of them has ever resolved to a screen.
 *
 * Only the three LMS reports are built here. The rest of the module's rows stay
 * `status = 0` and unmapped, which is honest: they are not mine to invent, and
 * a menu that opens a blank page is worse than one that stays hidden.
 */

const LmsEmployeeAnalysisReport = createLazyComponent(() =>
  import('@/domain/lms/reports').then((m) => ({ default: m.LmsEmployeeAnalysisReport })),
)
const LmsQuizProgressReport = createLazyComponent(() =>
  import('@/domain/lms/reports').then((m) => ({ default: m.LmsQuizProgressReport })),
)
const LmsQuestionWiseReport = createLazyComponent(() =>
  import('@/domain/lms/reports').then((m) => ({ default: m.LmsQuestionWiseReport })),
)

// accessLink is the stable tblmenumaster_g2g column; submenuId is the fallback.
export const REPORTS_CONTENT: ContentRoute[] = [
  { accessLink: '/module/reports/lms-report/employee-analysis-report', submenuId: '151', component: LmsEmployeeAnalysisReport },
  { accessLink: '/module/reports/lms-report/quiz-progress-report', submenuId: '152', component: LmsQuizProgressReport },
  { accessLink: '/module/reports/lms-report/question-wise-report', submenuId: '153', component: LmsQuestionWiseReport },
]
