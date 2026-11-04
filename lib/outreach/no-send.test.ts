import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * THE OWNER'S STANDING RULE: this effort never sends, schedules or switches sending on, and the Checks section sits next to email sending. These scans are the
 * proof that the new code cannot: it reads two endpoints, draws one button (Check again, or Retry) and names no sending route, flag or control. The screen's
 * own controls (Send now, Approve, Unschedule, ...) are the older code's and are pinned here as they were, so any change to them shows.
 *
 * A scan that matches nothing proves nothing, so each rule is also run on text it must flag (the last test).
 */

const read = (file: string) => readFileSync(path.resolve(file), 'utf8')

/** The files the S10b track wrote whole. */
const NEW_FILES = [
  'components/domain/gtm/outreach-checks.tsx',
  'components/domain/gtm/outreach-claims.tsx',
  'lib/outreach/model.ts',
  'lib/outreach/tones.ts',
  'lib/outreach/types.ts',
  'services/outreach/gate-service.ts',
]

/** The code without whole-line comments (they explain what is NOT done, in the very words searched for). */
function code(source: string): string {
  let inBlock = false
  return source.split(/\r?\n/).filter((line) => {
    const t = line.trim()
    if (inBlock) { if (t.includes('*/')) inBlock = false; return false }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; return false }
    return !t.startsWith('//') && !t.startsWith('*')
  }).join('\n')
}

/** The text between each <button ...> and its </button>. The opening tag is walked character by character so a `>` inside an attribute (an arrow function) does not end it. */
function buttonLabels(source: string): string[] {
  const labels: string[] = []
  let from = 0
  for (;;) {
    const open = source.indexOf('<button', from)
    if (open < 0) return labels
    let depth = 0
    let quote = ''
    let i = open + '<button'.length
    for (; i < source.length; i++) {
      const ch = source[i]
      if (quote) { if (ch === quote) quote = ''; continue }
      if (ch === '"' || ch === "'") quote = ch
      else if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0 && source[i - 1] !== '=') break
    }
    const close = source.indexOf('</button>', i)
    const inner = source.slice(i + 1, close)
    const literals = [...inner.matchAll(/'([^']+)'/g)].map((m) => m[1])
    // a label that is a condition between two words (`ready ? 'Check again' : 'Retry'`) holds its words as the literals after the `?`
    const words = inner.includes('?') ? [...inner.slice(inner.indexOf('?')).matchAll(/'([^']+)'/g)].map((m) => m[1]) : literals
    labels.push(...(words.length > 0 ? words : [inner.replace(/<[^>]*>/g, '').trim()]))
    from = close + 1
  }
}

const WRITES = /apiClient\.(post|put|patch|delete|postForm|putForm|deleteWithBody)\b|\bmethod:\s*['"](POST|PUT|PATCH|DELETE)/i
const ROUTES = /['"`][^'"`\n]*\/(send|approve|schedule|unschedule|cancel|submit|reject|readiness|suppressions|sequences|record-event|from-analysis)\b/i
const FLAGS = /sending_enabled|scheduler_enabled|can_send|sendReady|gtm_sending|email_sending|platform_gate|outbound_email/
const IMPORTS = /outreachService|services\/gtm|services\/crm|\bgtmService\b|CrmOutreach|OutreachMailer/
const CONTROL_WORDS = /\b(Send|Schedule|Unschedule|Enable|Approve|Propose|Retire|Submit|Publish)\b/
const FORM_PARTS = /<form\b|<input\b|<select\b|<textarea\b|<Input\b|<Button\b|type="submit"|onSubmit|window\.(confirm|prompt)|<Switch\b|<Checkbox\b/

describe('the new files cannot send, schedule or switch anything on', () => {
  for (const file of NEW_FILES) {
    describe(file, () => {
      const source = code(read(file))

      it('makes no write request and names no sending route', () => {
        assert.equal(WRITES.test(source), false, 'no POST, PUT, PATCH or DELETE')
        assert.equal(ROUTES.test(source), false, 'no path to send, approve, schedule, cancel, submit or reject')
      })

      it('names no sending flag and imports nothing from the sending services', () => {
        assert.equal(FLAGS.test(source), false)
        assert.equal(IMPORTS.test(source), false)
      })

      it('has no control labelled Send, Schedule, Enable, Approve, Propose, Retire, Submit or Publish, and no form part', () => {
        assert.equal(CONTROL_WORDS.test(source), false, `a capitalised control word in ${file}`)
        assert.equal(FORM_PARTS.test(source), false)
      })
    })
  }

  it('the service holds exactly two calls, both GET', () => {
    const source = code(read('services/outreach/gate-service.ts'))
    assert.equal((source.match(/apiClient\.\w+/g) ?? []).join(','), 'apiClient.get,apiClient.get')
    assert.deepEqual([...source.matchAll(/'(\/outreach\/[a-z]+)'/g)].map((m) => m[1]), ['/outreach/gate', '/outreach/claims'])
  })

  it('every button the components draw is labelled Check again or Retry', () => {
    const labels: string[] = []
    for (const file of ['components/domain/gtm/outreach-checks.tsx', 'components/domain/gtm/outreach-claims.tsx']) {
      labels.push(...buttonLabels(code(read(file))))
    }
    assert.deepEqual([...new Set(labels)].sort(), ['Check again', 'Retry'])
  })
})


