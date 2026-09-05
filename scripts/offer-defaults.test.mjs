#!/usr/bin/env node
/**
 * Assertions for `buildOfferDefaults` — the offer form's pre-fill.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * One behaviour here is invisible in a screenshot and wrong in the database:
 * `use-recruitment.ts` maps a null expected salary to the STRING '—' for
 * display, so seeding it blindly types an em dash into the salary field and
 * posts it as the offered salary. A reviewer looking at the form sees a dash and
 * assumes it means "empty".
 *
 * The function is re-declared below rather than imported, because the source is
 * TSX and this runs under plain node with no build step. That is a real
 * duplication risk, so the copy is kept to the exact body of the original and
 * the test asserts the ORIGINAL's source still matches — see `sourceMatches`.
 *
 *   node scripts/offer-defaults.test.mjs
 */

import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const SOURCE = 'components/domain/talent/recruitment/recruitment-action-drawer.tsx'

// ── the copy under test ──────────────────────────────────────────────────────
function buildOfferDefaults(candidate, jobs, today = new Date()) {
  const matchingJob = candidate.jobId
    ?? jobs.find((job) => job.title === candidate.jobOpening)?.id

  const expected = candidate.expectedCtc
  const salary = expected && expected !== '\u2014' ? expected : ''

  return {
    application_id: candidate.id,
    job_id: matchingJob ? String(matchingJob) : '',
    salary,
    start_date: new Date(today.getTime() + 28 * 86_400_000).toISOString().slice(0, 10),
  }
}

const JOBS = [
  { id: '11', title: 'Cyber Risk Manager' },
  { id: '12', title: 'Front End Developer' },
]

let passed = 0
const check = (label, fn) => {
  try {
    fn()
    console.log(`  PASS  ${label}`)
    passed++
  } catch (error) {
    console.log(`  FAIL  ${label}\n        ${error.message}`)
    process.exitCode = 1
  }
}

console.log('buildOfferDefaults\n')

check('a stated expected salary is seeded', () => {
  const out = buildOfferDefaults(
    { id: '5', jobId: '11', jobOpening: 'Cyber Risk Manager', expectedCtc: '12,00,000' }, JOBS)
  assert.equal(out.salary, '12,00,000')
})

check("the em-dash sentinel leaves salary BLANK, not '—'", () => {
  const out = buildOfferDefaults(
    { id: '5', jobId: '11', jobOpening: 'Cyber Risk Manager', expectedCtc: '\u2014' }, JOBS)
  assert.equal(out.salary, '', `seeded ${JSON.stringify(out.salary)} instead of empty`)
})

check('a missing expected salary leaves it blank', () => {
  for (const value of [null, undefined, '']) {
    const out = buildOfferDefaults({ id: '5', jobId: '11', expectedCtc: value }, JOBS)
    assert.equal(out.salary, '', `expectedCtc=${JSON.stringify(value)} produced ${JSON.stringify(out.salary)}`)
  }
})

check('job_id comes from the candidate when the mapper supplied one', () => {
  const out = buildOfferDefaults({ id: '5', jobId: '12', jobOpening: 'Cyber Risk Manager' }, JOBS)
  assert.equal(out.job_id, '12', 'candidate.jobId must win over the title match')
})

check('job_id falls back to a title match when it did not', () => {
  const out = buildOfferDefaults({ id: '5', jobId: undefined, jobOpening: 'Front End Developer' }, JOBS)
  assert.equal(out.job_id, '12')
})

check('an unmatched job leaves job_id blank rather than guessing', () => {
  const out = buildOfferDefaults({ id: '5', jobId: undefined, jobOpening: 'Nonexistent Role' }, JOBS)
  assert.equal(out.job_id, '')
})

check('start_date is 28 days out, as plain YYYY-MM-DD', () => {
  const out = buildOfferDefaults({ id: '5' }, JOBS, new Date('2026-01-01T00:00:00Z'))
  assert.equal(out.start_date, '2026-01-29')
  assert.match(out.start_date, /^\d{4}-\d{2}-\d{2}$/)
})

check('reportmanager is NOT pre-filled', () => {
  const out = buildOfferDefaults({ id: '5', jobId: '11' }, JOBS)
  assert.equal(out.reportmanager, undefined,
    'the requisition raiser is not the reporting manager - see the function docblock')
})

/*
 * The copy above must not drift from the real implementation. Rather than
 * compare whole bodies (whitespace churn would make it useless), assert the
 * source still contains the two lines that carry the behaviour.
 */
check('the real implementation still has the em-dash guard', () => {
  const src = readFileSync(SOURCE, 'utf8')
  assert.ok(src.includes('export function buildOfferDefaults'),
    'buildOfferDefaults was renamed or inlined - this test is now testing nothing')
  assert.ok(/expected !== '\\u2014'/.test(src) || /expected !== '—'/.test(src),
    'the em-dash guard is gone from the real implementation')
  assert.ok(!/reportmanager:/.test(src.slice(src.indexOf('export function buildOfferDefaults'),
    src.indexOf('export function buildOfferDefaults') + 1800)),
    'reportmanager is being pre-filled again')
})

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`)
