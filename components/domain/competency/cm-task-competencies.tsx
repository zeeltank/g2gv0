'use client'

/**
 * Host for the task->competency panel, so the content map has a prop-less
 * component to render. Same arrangement as cm-course-competencies.tsx.
 */

import { TaskCompetenciesPanel } from './task-competencies-panel'

export function CmTaskCompetencies() {
  return (
    <div className="w-full flex-1 space-y-6 p-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Task Competencies</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Which competency each job-role task exercises. Completing a task becomes evidence
          toward that competency — without this map it is guessed per ticket.
        </p>
      </div>
      <TaskCompetenciesPanel />
    </div>
  )
}
