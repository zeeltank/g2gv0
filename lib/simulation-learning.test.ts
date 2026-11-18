/**
 * Simulation Learning: the parts that decide what the page believes and shows, checked without a browser.
 *
 *  - the message check that stands between the sandboxed runtime and the host page (a wrong answer here is how a stray frame, or another
 *    simulation, would be taken for the one being played);
 *  - the sandbox flags of the frame (the login token lives in this page's localStorage, so "no same-origin" is a property worth pinning);
 *  - the small pieces of wording the cards are drawn from.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { SIM_FRAME_SANDBOX, parseRuntimeMessage, runtimeFrameUrl } from './simulation-host'
import { cardNumber, categoryKindOf, categoryLabelOf, difficultyOf, minutesLabel, missionsLabel, readSpec, startLabel } from '../components/domain/lms/simulations/simulation-format'

const fromRuntime = { src: 'g2g-course', lesson: '7' }

describe('the message check between the runtime and this page', () => {
  it('accepts the messages the runtime sends for this lesson', () => {
    assert.deepEqual(parseRuntimeMessage({ ...fromRuntime, type: 'ready' }, '7'), { type: 'ready' })
    assert.deepEqual(parseRuntimeMessage({ ...fromRuntime, type: 'spec', ok: true, issues: [] }, '7'), { type: 'spec', ok: true, issues: [] })
    assert.deepEqual(parseRuntimeMessage({ ...fromRuntime, type: 'progress', step: 2, percent: 35, snapshot: { phase: 'predict' } }, '7'), {
      type: 'progress',
      step: 2,
      percent: 35,
      snapshot: { phase: 'predict' },
    })
    assert.equal(parseRuntimeMessage({ ...fromRuntime, type: 'completed', step: 9, percent: 100 }, '7')?.type, 'completed')
  })

  it('accepts only a message that names this lesson: not one that names another, and not one that names none', () => {
    assert.equal(parseRuntimeMessage({ src: 'g2g-course', type: 'ready' }, '7'), null)
    assert.equal(parseRuntimeMessage({ src: 'g2g-course', lesson: '8', type: 'ready' }, '7'), null)
    // a number and its string are the same lesson
    assert.deepEqual(parseRuntimeMessage({ src: 'g2g-course', lesson: 7, type: 'ready' }, '7'), { type: 'ready' })
  })

  it('refuses what is not a message from the runtime', () => {
    for (const junk of [null, undefined, 'ready', 42, [], { type: 'ready' }, { src: 'someone-else', type: 'ready' }, { src: 'g2g-host', type: 'ready' }]) {
      assert.equal(parseRuntimeMessage(junk, '7'), null, JSON.stringify(junk))
    }
  })

  it('ignores a message type nobody here handles', () => {
    assert.equal(parseRuntimeMessage({ ...fromRuntime, type: 'navigate', to: 'https://example.com' }, '7'), null)
    assert.equal(parseRuntimeMessage({ ...fromRuntime }, '7'), null)
  })

  it('keeps progress inside 0 to 100 and whole, whatever is sent', () => {
    const clamp = (percent: unknown, step: unknown) => parseRuntimeMessage({ ...fromRuntime, type: 'progress', percent, step }, '7')
    assert.deepEqual(clamp(250, 3), { type: 'progress', step: 3, percent: 100, snapshot: undefined })
    assert.deepEqual(clamp(-40, -1), { type: 'progress', step: 0, percent: 0, snapshot: undefined })
    assert.deepEqual(clamp(33.6, 2.4), { type: 'progress', step: 2, percent: 34, snapshot: undefined })
    assert.deepEqual(clamp('lots', null), { type: 'progress', step: 0, percent: 0, snapshot: undefined })
    assert.deepEqual(clamp(Number.NaN, Number.POSITIVE_INFINITY), { type: 'progress', step: 0, percent: 0, snapshot: undefined })
  })

  it('keeps only text in the list of problems, and at most 30 of them', () => {
    const issues = [...Array.from({ length: 40 }, (_, i) => `problem ${i}`), 7, null, { a: 1 }]
    const message = parseRuntimeMessage({ ...fromRuntime, type: 'spec', ok: false, issues }, '7')
    assert.equal(message?.type, 'spec')
    if (message?.type === 'spec') {
      assert.equal(message.issues.length, 30)
      assert.ok(message.issues.every((issue) => typeof issue === 'string'))
      assert.equal(message.ok, false)
    }
    // "ok" must be exactly true: a truthy string is not a verdict
    assert.equal((parseRuntimeMessage({ ...fromRuntime, type: 'spec', ok: 'yes' }, '7') as { ok: boolean }).ok, false)
  })
})

describe('the frame that holds the runtime', () => {
  it('is sandboxed with scripts but without same-origin, top navigation, forms or modals', () => {
    const flags = SIM_FRAME_SANDBOX.split(/\s+/)
    assert.ok(flags.includes('allow-scripts'))
    for (const forbidden of ['allow-same-origin', 'allow-top-navigation', 'allow-top-navigation-by-user-activation', 'allow-forms', 'allow-modals', 'allow-downloads']) {
      assert.ok(!flags.includes(forbidden), `${forbidden} must not be allowed`)
    }
  })

  it('asks the runtime to wait for this page (or only to check), and names the lesson', () => {
    assert.match(runtimeFrameUrl({ lessonId: '7' }), /\?host=1&lesson=7$/)
    assert.match(runtimeFrameUrl({ lessonId: 'check', validate: true }), /\?validate=1&lesson=check$/)
  })
})

describe('the words on a card', () => {
  it('sorts a category into a kind by its words, and anything unknown is general', () => {
    assert.equal(categoryKindOf('Engineering'), 'engineering')
    assert.equal(categoryKindOf('Data & ML'), 'data')
    assert.equal(categoryKindOf('Cyber security'), 'security')
    assert.equal(categoryKindOf('Customer success'), 'commercial')
    assert.equal(categoryKindOf('Underwater basket weaving'), 'general')
    assert.equal(categoryKindOf(''), 'general')
    assert.equal(categoryKindOf(null), 'general')
  })

  it('shows a blank category as General, as the server counts it', () => {
    assert.equal(categoryLabelOf({ category: null }), 'General')
    assert.equal(categoryLabelOf({ category: '   ' }), 'General')
    assert.equal(categoryLabelOf({ category: 'Engineering' }), 'Engineering')
  })

  it('reads a difficulty as a label and a level, and shows an unknown one as written', () => {
    assert.deepEqual(difficultyOf('intro'), { label: 'Introductory', level: 1 })
    assert.deepEqual(difficultyOf('Advanced'), { label: 'Advanced', level: 3 })
    assert.deepEqual(difficultyOf('expert'), { label: 'Expert', level: 2 })
    assert.equal(difficultyOf(null), null)
    assert.equal(difficultyOf(''), null)
  })

  it('writes minutes, missions and the card number plainly', () => {
    assert.equal(minutesLabel(15), '15 min')
    assert.equal(minutesLabel(60), '1 h')
    assert.equal(minutesLabel(95), '1 h 35 min')
    assert.equal(minutesLabel(0), null)
    assert.equal(minutesLabel(null), null)
    assert.equal(missionsLabel(1), '1 mission')
    assert.equal(missionsLabel(4), '4 missions')
    assert.equal(missionsLabel(0), null)
    assert.equal(cardNumber(0), '01')
    assert.equal(cardNumber(11), '12')
  })

  it('labels the start button from where the learner is', () => {
    const base = { status: 'published' as const }
    assert.equal(startLabel({ ...base, progress: null }), 'Start simulation')
    assert.equal(startLabel({ status: 'draft', progress: null }), 'Preview simulation')
    assert.equal(startLabel({ ...base, progress: { status: 'in_progress', percent: 42, step: 3, completed_at: null } }), 'Continue · 42%')
    assert.equal(startLabel({ ...base, progress: { status: 'completed', percent: 100, step: 9, completed_at: '2026-10-26 10:00:00' } }), 'Play again')
  })
})

describe('reading a specification that may be anything', () => {
  it('reads a well-formed specification into facts', () => {
    const facts = readSpec({
      id: 'traffic-control-room',
      title: ' Traffic Control Room ',
      subtitle: 'Back-End Design',
      meta: { minutes: 15, difficulty: 'intermediate', category: 'Engineering', tags: ['caching', 'queues'], authors: ['G2G simulation team'], competencies: [442, 443] },
      lesson: { intro: 'You run the back end of a busy shop.', missions: [{ id: 'm1', kind: 'explore', title: 'Survive the launch spike', brief: 'Make it survive.' }] },
    })
    assert.equal(facts.title, 'Traffic Control Room')
    assert.equal(facts.minutes, 15)
    assert.equal(facts.difficulty, 'intermediate')
    assert.deepEqual(facts.tags, ['caching', 'queues'])
    assert.equal(facts.competencies, 2)
    assert.deepEqual(facts.missions, [{ id: 'm1', kind: 'explore', title: 'Survive the launch spike', brief: 'Make it survive.' }])
  })

  it('never throws and never returns a wrong type, whatever each field holds', () => {
    for (const junk of [null, undefined, 7, 'text', [], true, { meta: 5, lesson: 'x' }, { meta: { difficulty: 2, minutes: '15', tags: 'a,b', authors: [1, null, {}], competencies: 'many', category: ['x'] }, lesson: { intro: 12, missions: [null, 3, 'm', { title: 9, brief: [], kind: {} }] }, title: 4, subtitle: [], summary: false }]) {
      const facts = readSpec(junk)
      for (const text of [facts.id, facts.title, facts.subtitle, facts.summary, facts.intro, facts.difficulty, facts.category]) assert.ok(text === null || typeof text === 'string')
      assert.ok(facts.minutes === null || typeof facts.minutes === 'number')
      assert.ok(Array.isArray(facts.tags) && facts.tags.every((t) => typeof t === 'string'))
      assert.ok(Array.isArray(facts.authors) && facts.authors.every((a) => typeof a === 'string'))
      assert.equal(typeof facts.competencies, 'number')
      assert.ok(facts.missions.every((m) => [m.id, m.kind, m.title, m.brief].every((x) => x === null || typeof x === 'string')))
    }
  })

  it('treats a difficulty or a minutes figure that is not the right type as absent', () => {
    assert.equal(difficultyOf(2), null)
    assert.equal(difficultyOf({}), null)
    assert.equal(minutesLabel('15'), null)
    assert.equal(minutesLabel(Number.NaN), null)
    assert.equal(minutesLabel(14.6), '15 min')
  })
})
