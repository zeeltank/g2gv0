'use client'

/**
 * Host for the course->competency panel, so the content map has a prop-less
 * component to render. Same arrangement as cm-competency-definitions.tsx, and
 * the same reason: the content map renders components with no props, and a panel
 * that needs none is still clearer with its own page shell.
 */

import { CourseCompetenciesPanel } from './course-competencies-panel'

export function CmCourseCompetencies() {
  return (
    <div className="w-full flex-1 space-y-6 p-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Course Competencies</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Which competencies each course develops. Learning assignment and remediation both read
          this — a course mapped to nothing is never suggested to close a gap.
        </p>
      </div>
      <CourseCompetenciesPanel />
    </div>
  )
}
