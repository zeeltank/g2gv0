import type { StepState, StepperStep } from '@/components/shared/wizard/setup-stepper'
import type { SetupStepStatus } from '@/services/organization/setup-status'

/**
 * ONE STEP VOCABULARY FOR THE WHOLE SETUP SURFACE.
 *
 * ── THE THREE THAT DISAGREED ────────────────────────────────────────────────
 *
 *   module-configuration-page.tsx  8 steps: profile, modules, organization,
 *                                  department, employee, additional, review,
 *                                  golive
 *   portal-review-page.tsx         6 steps: modules, organization, department,
 *                                  employee, review, golive
 *   app/organization/setup         6 different steps: profile, roles, modules,
 *                                  departments, people, capability
 *
 * All three fed the same progress component, so the same organisation was
 * "STEP 2 OF 8" on one screen and "5 of 6" on the next. The first two also
 * described a flow that no longer exists - there is no employee-import step and
 * no go-live event.
 *
 * ── THE SERVER OWNS THE ORDER AND THE ANSWER ────────────────────────────────
 *
 * `GET /api/organization/setup-status` returns the steps, their labels, their
 * real numbers and whether each is done, all counted from the tables the rest of
 * the product writes. This file only adds the two things a checklist API has no
 * opinion about: which step you are LOOKING at, and the closing step that is not
 * a piece of configuration at all.
 *
 * So the list is not duplicated here. If the server adds a step, the rail grows
 * on its own.
 */

/**
 * The one step the server does not report, because there is nothing to count.
 *
 * Review is where somebody reads what they have built and decides they are
 * finished. It is deliberately NOT a stored "we went live" flag - the previous
 * screen had one of those in `localStorage.setItem('gtg-portal-live', 'true')`,
 * written per browser, read by nothing.
 */
export const REVIEW_STEP_KEY = 'review'

export const REVIEW_STEP = {
  key: REVIEW_STEP_KEY,
  label: 'Review & finish',
} as const

/**
 * Turn the server's checklist into a rail.
 *
 * `currentKey` decides which step reads as current; everything before it that is
 * done reads complete, and an unfinished step you have walked past reads
 * `skipped` rather than `upcoming` - because you HAVE been there, and telling
 * somebody a step they skipped is "not started" is how a wizard loses their
 * trust.
 */
export function toStepperSteps(
  steps: SetupStepStatus[],
  currentKey: string | null,
): StepperStep[] {
  const all = [...steps.map((step) => ({ key: step.key, label: step.label, detail: step.detail, done: step.done })), {
    key: REVIEW_STEP.key,
    label: REVIEW_STEP.label,
    detail: undefined as string | undefined,
    // Review is done only when every measured step is.
    done: steps.length > 0 && steps.every((step) => step.done),
  }]

  const currentIndex = currentKey ? all.findIndex((step) => step.key === currentKey) : -1

  return all.map((step, index): StepperStep => {
    let state: StepState

    if (step.key === currentKey) {
      state = 'current'
    } else if (step.done) {
      state = 'complete'
    } else if (currentIndex >= 0 && index < currentIndex) {
      state = 'skipped'
    } else {
      state = 'upcoming'
    }

    return { key: step.key, label: step.label, detail: step.detail, state }
  })
}

/** The first thing still outstanding, or the review step when nothing is. */
export function firstOutstanding(steps: SetupStepStatus[]): string {
  return steps.find((step) => !step.done)?.key ?? REVIEW_STEP_KEY
}
