import { resolveApiBaseUrl } from '@/lib/api-config'

/**
 * The candidate's API client. Deliberately separate from services/talent/*.
 *
 * Every method in services/talent/* begins with contextParams(), which throws
 * "Your Laravel session is unavailable. Please sign in again." when there is no
 * token. A candidate has no token and never will - they are not a user of this
 * product - so those services cannot be reused here at all.
 *
 * This client sends no Authorization header and no tenant parameters. The
 * organisation is identified by the careers slug in the path, which is the
 * resource itself.
 */

export type CareersPosting = {
  id: number
  title: string
  department: string | null
  location: string | null
  employment_type: string | null
  /** On-site, Hybrid or Remote. Null means not stated, never On-site. */
  work_mode: string | null
  /** The date applications OPEN. Null means open on publication. */
  opens_on?: string | null
  experience: string | null
  positions: number | null
  deadline: string | null
  posted_at: string | null
  skills: string[]
  salary_min: number | null
  salary_max: number | null
  description?: string | null
  education?: string | null
  certifications?: string | null
  benefits?: string | null
  priority?: string | null
}

export type CareersOrganisation = {
  name: string
  slug: string
  industry?: string | null
  website?: string | null
  address?: string | null
}

/** One step on the candidate's own timeline. */
export type TrackStage = {
  name: string
  state: 'done' | 'current' | 'upcoming'
}

/**
 * What a candidate is allowed to see about their own application.
 *
 * Deliberately narrower than the recruiter's view: a coarse stage, never the
 * internal status; whether an assessment is waiting, never its score.
 */
export type ApplicationTracking = {
  candidate: { name: string; email: string | null }
  organisation: { name: string | null; slug: string | null; website: string | null }
  application: {
    reference: string
    job_id: number | null
    job_title: string | null
    department: string | null
    location: string | null
    employment_type: string | null
    applied_date: string | null
  }
  timeline: { current: string; index: number; stages: TrackStage[]; closed: boolean }
  assessment: { waiting: boolean; submitted: boolean; expires_at: string | null } | null
  offer: { position: string | null; start_date: string | null; responded: boolean } | null
  expires_at: string | null
}

export class CareersError extends Error {
  status: number
  fieldErrors?: Record<string, string[]>

  constructor(message: string, status: number, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'CareersError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

async function readError(response: Response): Promise<CareersError> {
  try {
    const payload = await response.json()
    return new CareersError(
      payload?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.errors,
    )
  } catch {
    // A 429 from the throttle middleware has no JSON body worth parsing.
    if (response.status === 429) {
      return new CareersError('Too many requests. Please wait a moment and try again.', 429)
    }
    return new CareersError(`Request failed (${response.status})`, response.status)
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw await readError(response)
  const payload = await response.json()
  return payload.data as T
}

export const careersApi = {
  organisation(slug: string) {
    return get<{ organisation: CareersOrganisation; postings: CareersPosting[]; total: number }>(
      `/careers/${encodeURIComponent(slug)}`,
    )
  },

  posting(slug: string, id: string | number) {
    return get<{ organisation: CareersOrganisation; posting: CareersPosting }>(
      `/careers/${encodeURIComponent(slug)}/postings/${id}`,
    )
  },

  /**
   * Multipart, because the CV is a required file. No Content-Type header is set
   * on purpose - the browser has to supply the multipart boundary itself.
   */
  async apply(slug: string, id: string | number, form: FormData) {
    const response = await fetch(
      `${resolveApiBaseUrl()}/careers/${encodeURIComponent(slug)}/postings/${id}/apply`,
      { method: 'POST', headers: { Accept: 'application/json' }, body: form },
    )
    if (!response.ok) throw await readError(response)
    return response.json() as Promise<{
      status: number
      message: string
      data: {
        application_id: number
        /** Where the candidate can follow it. Returned even when email is off. */
        track_url: string
        track_expires: string
        emailed: boolean
      }
    }>
  },

  /**
   * One candidate's own application. The token IS the credential, so nothing
   * else is sent - no slug, no id, nothing that could be tampered with.
   */
  track(token: string) {
    return get<ApplicationTracking>(`/careers/track/${encodeURIComponent(token)}`)
  },
}

export type OfferResponse = {
  organisation: string | null
  candidate_name: string | null
  position: string | null
  salary: string | null
  start_date: string | null
  location: string | null
  employment_type: string | null
  expires_at: string | null
  /** 'accepted' | 'declined' when the candidate has already answered. */
  already_decided: string | null
}

/**
 * The candidate's own offer, opened by the link they were sent.
 *
 * The token in the path is the whole authorisation — it opens one offer and
 * nothing else. Every failure (unknown, expired, already used) comes back as a
 * 410 with a sentence meant for a person to read.
 */
export const offerApi = {
  show(token: string) {
    return get<OfferResponse>(`/offer-response/${encodeURIComponent(token)}`)
  },

  async respond(token: string, decision: 'accepted' | 'declined', note?: string) {
    const response = await fetch(`${resolveApiBaseUrl()}/offer-response/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, note }),
    })
    if (!response.ok) throw await readError(response)
    return response.json() as Promise<{ status: number; message: string }>
  },
}

export type AssessmentQuestion = {
  id: number
  format: 'mcq' | 'short_answer' | 'coding'
  question: string
  /** Present for mcq only. */
  options: string[] | null
  max_score: number
  /** What the candidate has already saved, so a resumed sitting is not lost. */
  answer: string | null
}

export type CandidateAssessment = {
  organisation: string | null
  candidate_name: string | null
  title: string | null
  instructions: string | null
  time_limit_minutes: number | null
  expires_at: string | null
  total_marks: number
  questions: AssessmentQuestion[]
}

/**
 * The candidate's own assessment, opened by the link they were sent.
 *
 * Lives beside offerApi and shares its rules deliberately: no Authorization
 * header, the token in the path is the whole authorisation, and unknown /
 * expired / already-used all arrive as one 410 carrying a sentence written for
 * a person. The page must never branch on `reason` — that is what makes the
 * three indistinguishable to someone guessing tokens.
 *
 * The payload carries NO answer key. `correct_option` and `model_answer` are
 * columns on the same row as the question and are excluded server-side; if they
 * ever appear here, that is a leak, not a feature.
 */
export const assessmentApi = {
  show(token: string) {
    return get<CandidateAssessment>(`/candidate-assessment/${encodeURIComponent(token)}`)
  },

  /**
   * Autosave one answer. Deliberately separate from submit so a dropped
   * connection costs the current question rather than the whole sitting.
   *
   * `selected_option` and `answer` are separate fields because they are
   * separate columns, and the marker reads the MCQ choice from the former.
   */
  async saveAnswer(
    token: string,
    questionId: number,
    value: { answer?: string; selected_option?: string },
  ) {
    const response = await fetch(
      `${resolveApiBaseUrl()}/candidate-assessment/${encodeURIComponent(token)}/answer`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId, ...value }),
      },
    )
    if (!response.ok) throw await readError(response)
    return response.json() as Promise<{ status: number; message: string }>
  },

  /** Final submit. Burns the link — there is no second attempt. */
  async submit(token: string) {
    const response = await fetch(
      `${resolveApiBaseUrl()}/candidate-assessment/${encodeURIComponent(token)}/submit`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    if (!response.ok) throw await readError(response)
    return response.json() as Promise<{ status: number; message: string }>
  },
}

/** "₹6,00,000 – ₹12,00,000", or null when the posting does not say. */
export function formatSalaryRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`
  if (min !== null && max !== null) return `${money(min)} – ${money(max)}`
  return money((min ?? max) as number)
}

/** "Closes 31 Dec 2026", or null when the role has no deadline. */
export function formatDeadline(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
