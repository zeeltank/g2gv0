/**
 * The Generate Signals progress bar: what it shows for every state of a run, and the wiring that keeps it beside the research-date dropdown,
 * polling to an end state and cleaning up. (There is no React test setup here, so the component is checked through its pure view and its source.)
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { RESEARCH_STEPS, describeProgress, formatDuration, isTerminal } from './research-steps'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const NOW = Date.parse('2026-10-20T10:05:00Z')
const run = (o: Record<string, unknown> = {}) => ({ status: 'running', stage: 'searching', started_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:04:30Z', ...o })

describe('describeProgress', () => {
  it('is idle without a run', () => {
    assert.equal(describeProgress(null, NOW).state, 'idle')
    assert.equal(describeProgress(null, NOW).percent, null)
  })

  it('shows a queued run as waiting for a worker, with no percentage claimed beyond its step', () => {
    const v = describeProgress(run({ stage: 'queued' }), NOW)
    assert.equal(v.state, 'queued')
    assert.equal(v.stepNumber, 1)
    assert.equal(v.percent, 0)
  })

  it('shows the step in progress, the steps before it as done and the steps after it as pending', () => {
    const v = describeProgress(run({ stage: 'collecting' }), NOW)
    assert.equal(v.state, 'running')
    assert.equal(v.stepNumber, 4)
    assert.equal(v.totalSteps, RESEARCH_STEPS.length)
    assert.deepEqual(v.steps.map((s) => s.status), ['done', 'done', 'done', 'current', 'pending', 'pending'])
    assert.equal(v.percent, Math.round((3 / 6) * 100))
  })

  it('reports elapsed time and the last update from the run timestamps', () => {
    const v = describeProgress(run(), NOW)
    assert.equal(v.elapsedSeconds, 300)
    assert.equal(v.lastUpdateSeconds, 30)
  })

  it('flags a run that has stopped sending progress, and not one that is just working', () => {
    assert.equal(describeProgress(run(), NOW).stale, false)                                   // 30 s since the last update
    assert.equal(describeProgress(run({ updated_at: '2026-10-20T10:01:00Z' }), NOW).stale, true)   // 4 minutes quiet
    assert.equal(describeProgress(run({ status: 'failed', stage: 'failed', updated_at: '2026-10-20T10:01:00Z' }), NOW).stale, false)
  })

  it('does not guess a percentage for a stage it does not know', () => {
    const v = describeProgress(run({ stage: 'something_new' }), NOW)
    assert.equal(v.state, 'running')
    assert.equal(v.percent, null)
    assert.equal(v.stepNumber, null)
  })

  it('counts only what the backend has stored', () => {
    const v = describeProgress(run({ queries_run: 5, queries_failed: 1, sources_found: 12 }), NOW)
    assert.deepEqual(v.counts, ['5 searches (1 failed)', '12 sources'])
  })

  it('shows a successful run as completed at 100% with its result', () => {
    const v = describeProgress(run({ status: 'success', stage: 'completed', completed_at: '2026-10-20T10:03:00Z', opportunities_qualified: 4, opportunities_new: 2 }), NOW)
    assert.equal(v.state, 'completed')
    assert.equal(v.percent, 100)
    assert.equal(v.limited, false)
    assert.equal(v.elapsedSeconds, 180)
    assert.ok(v.counts.includes('4 qualified (2 new)'))
    assert.equal(v.lastUpdateSeconds, null)
  })

  it('marks a partial run completed but limited', () => {
    const v = describeProgress(run({ status: 'partial', stage: 'completed', completed_at: '2026-10-20T10:03:00Z' }), NOW)
    assert.equal(v.state, 'completed')
    assert.equal(v.limited, true)
  })

  for (const status of ['failed', 'skipped']) {
    it(`never shows a ${status} run as 100% or as a success`, () => {
      const v = describeProgress(run({ status, stage: 'failed', error_message: 'No queue worker started it.', completed_at: '2026-10-20T10:03:00Z', opportunities_qualified: 0 }), NOW)
      assert.equal(v.state, 'failed')
      assert.notEqual(v.percent, 100)
      assert.equal(v.percent, null)
      assert.equal(v.error, 'No queue worker started it.')
      assert.ok(v.steps.every((s) => s.status !== 'done'))
      assert.ok(!v.counts.some((c) => c.includes('qualified')))
    })
  }

  it('knows which statuses end a run', () => {
    for (const s of ['success', 'partial', 'failed', 'skipped']) assert.equal(isTerminal(s), true)
    assert.equal(isTerminal('running'), false)
  })

  it('formats durations', () => {
    assert.equal(formatDuration(45), '45s')
    assert.equal(formatDuration(185), '3m 05s')
    assert.equal(formatDuration(3720), '1h 02m')
  })
})

describe('progress bar wiring', () => {
  const screen = read('components/domain/signals/company-opportunities.tsx')
  const hook = read('components/domain/signals/use-generate-signals.ts')
  const bar = read('components/domain/signals/research-progress.tsx')

  it('sits under the product selector and before the signal list', () => {
    assert.ok(screen.indexOf('<ResearchProgress') > 0 && screen.indexOf('<ResearchProgress') < screen.indexOf('<SignalList'))
    assert.match(bar, /break-words/)
  })

  it('offers an explicit Retry for a failed run that starts nothing by itself', () => {
    assert.match(bar, /onClick=\{onRetry\}/)
    assert.match(screen, /onRetry=\{generate\}/)
    assert.doesNotMatch(bar, /generate\(|useGenerateSignals/)
  })

  it('exposes a real progressbar role and only while a run is active', () => {
    assert.match(bar, /role="progressbar"/)
    assert.match(bar, /aria-valuenow/)
    assert.match(bar, /\{active && \(\s*<div\s+role="progressbar"/)
  })

  it('stops its clock when the run ends or the screen unmounts', () => {
    assert.match(bar, /if \(!live\) return/)
    assert.match(bar, /return \(\) => clearInterval\(id\)/)
  })

  it('polls until an end state, drops stale polls, and clears its timer on unmount and product change', () => {
    assert.match(hook, /\['success', 'partial', 'failed', 'skipped'\]\.includes\(run\.status\)/)
    assert.match(hook, /if \(mine !== generation\.current\) return/)
    assert.match(hook, /return \(\) => \{ if \(timer\.current\) clearTimeout\(timer\.current\) \}/)
    assert.match(hook, /POLL_FAILURES_MAX/)
  })

  it('recovers a running run for the selected product on reload and never shows another product\'s run as its progress', () => {
    assert.match(hook, /s\?\.busy_elsewhere/)
    assert.match(hook, /s\?\.running && latest\?\.id/)
  })

  it('does not start research when a date is chosen: the date select only sets state', () => {
    assert.match(screen, /pick\(e\.target\.value\)/)
    assert.equal((screen.match(/run\.generate\(/g) ?? []).length, 1)   // one function starts a run; only the Generate and Retry buttons call it
  })

  it('does not let a double click start two runs (a ref guards it, not async state)', () => {
    assert.match(read('lib/signals-generate.ts'), /if \(guard\.current\) \{[\s\S]*?return\s+\}\s+guard\.current = true/)
  })

  it('the hook routes the click through the guarded runner and never leaves the lock held on a refusal', () => {
    assert.match(hook, /runGuardedGenerate\(inFlight,/)
    assert.doesNotMatch(hook, /inFlight\.current = outcome\.reason/)
  })

  it('the Generate button is disabled only without a product or while a run is active, and never by readiness (which is explained instead)', () => {
    assert.match(screen, /disabled=\{!selected \|\| run\.running\}/)
  })
})
