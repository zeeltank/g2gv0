/**
 * THE WORDS RECRUITMENT USES, IN ONE PLACE.
 *
 * These lists were written out by hand in job-posting-form.tsx and again in
 * candidate-application-form.tsx, and a third copy was about to appear in the
 * public careers form. Three copies of "what counts as an education level" drift
 * the moment one of them gains an option, and then a candidate picks something
 * a recruiter's filter has never heard of.
 *
 * WHAT IS STORED IS THE LABEL, not a code. Every one of these columns is a
 * VARCHAR holding the display string already - `employment_type` on the live
 * host holds 'Full-Time', 'Part-Time', 'Contract' and 'Internship' as text - so
 * introducing codes now would orphan 126 existing postings. The value and the
 * label are therefore the same string on purpose.
 */

/** Employment types, matching what the live database already holds. */
export const EMPLOYMENT_TYPES = [
  'Full-Time',
  'Part-Time',
  'Contract',
  'Temporary',
  'Internship',
] as const

/**
 * WHERE the work happens, which is a different question from the contract.
 *
 * A role can be Full-Time AND Remote; the two were being conflated because only
 * employment_type existed. Kept separate rather than adding 'Remote' to the list
 * above, which would have made "remote internship" unrepresentable.
 */
export const WORK_MODES = ['On-site', 'Hybrid', 'Remote'] as const

export const EDUCATION_LEVELS = [
  'High School Diploma',
  'Associate Degree',
  "Bachelor's Degree",
  "Master's Degree",
  'PhD',
  'Not Required',
] as const

/** The candidate's own answer, which never includes "Not Required". */
export const CANDIDATE_EDUCATION_LEVELS = EDUCATION_LEVELS.filter(
  (level) => level !== 'Not Required',
)

export const EXPERIENCE_LEVELS = [
  'Entry Level (0-2 years)',
  'Mid Level (3-5 years)',
  'Senior Level (6-10 years)',
  'Lead Level (10+ years)',
] as const

/** Ready for a <Select options={...}>: value and label are the same string. */
export function asOptions(values: readonly string[]) {
  return values.map((value) => ({ label: value, value }))
}
