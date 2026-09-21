/**
 * The products that share the AI & Intelligence capabilities.
 *
 * WHY THIS LIST IS HERE AND NOT IN THE APP
 *
 * This package is meant to be consumed by all three products, so it must not import
 * anything from an individual product's `lib/` or `app/`. The ids are therefore
 * declared here, and each product's own code asserts they match the adapters it
 * actually serves — two lists that must agree, rather than one list an unrelated
 * product cannot reach.
 *
 * KIND IS ABOUT WHERE THE IMPLEMENTATION LIVES, NOT ABOUT IMPORTANCE
 *
 * `host` means the capability's implementation and its API routes live in that
 * codebase, and a caller's scope rides on the signed-in user's own token. `external`
 * means the product calls in from another deployment and must present a service
 * token.
 *
 * ── WHY G2G IS A HOST IN THIS COPY, AND LMS K-12's SAYS OTHERWISE ───────────
 *
 * This is the one field that legitimately differs between the two copies of this
 * package, and the difference is a fact rather than a drift.
 *
 * LMS K-12 wrote these capabilities first, so in its copy it is the host and G2G is
 * listed as a prospective external caller. That was accurate when it was written and
 * it is still accurate *there*. It is not accurate here: G2G now serves
 * `/api/ai/*` from its own Laravel application, against its own database, under its
 * own Sanctum session. Leaving `kind: 'external'` in this file would describe an
 * arrangement that does not exist — G2G holds no service token and calls no other
 * product — and the console's own footer explains the model to an administrator, so
 * it would be a visible untruth rather than a private one.
 *
 * The capability registry beside this file is deliberately NOT forked the same way.
 * It is the shared description of what each capability is for, and that does not
 * change per deployment; only the per-product consumption states do, which is what
 * `solutions` on each capability records.
 */

export type SolutionId = 'lms_k12' | 'g2g' | 'enterprise_brain';

export type SolutionKind = 'host' | 'external';

export interface Solution {
  id: SolutionId
  label: string
  kind: SolutionKind
  /** One sentence: what this product is, in terms of what it asks AI for. */
  description: string
}

export const SOLUTIONS: readonly Solution[] = [
  {
    id: 'g2g',
    label: 'G2G',
    kind: 'host',
    description:
      'Capability and competency workflows. Asks for role, skill and development-path intelligence over its own taxonomy, and serves these capabilities from its own database.',
  },
  {
    id: 'lms_k12',
    label: 'LMS K-12',
    kind: 'host',
    description:
      'The school ERP. Asks for curriculum, fees, admissions and teaching intelligence, and hosts its own copy of these capabilities.',
  },
  {
    id: 'enterprise_brain',
    label: 'Enterprise Brain',
    kind: 'external',
    description:
      'Institution intelligence and automation. Asks for signals, deliberation and agent execution over the whole organisation.',
  },
]

export const SOLUTION_IDS: readonly SolutionId[] = SOLUTIONS.map((solution) => solution.id)

export function getSolution(id: SolutionId): Solution | undefined {
  return SOLUTIONS.find((solution) => solution.id === id)
}

/** The header every cross-product call carries. Mirrors `PROJECT_ID_HEADER`. */
export const SOLUTION_ID_HEADER = 'x-project-id'
