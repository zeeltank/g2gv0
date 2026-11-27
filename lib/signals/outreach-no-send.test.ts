import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * THE OWNER'S STANDING RULE for the Outreach tab's new screens (Companies, All people, the company page, the Write message dialog): nothing here sends an email or an SMS, approves a
 * message or schedules one. The only thing these screens may do with a message is SAVE A DRAFT (through the Outreach API) and SUBMIT it for approval (the one existing GTM call,
 * `submit`); approving and sending stay in the Messages panel behind its own switches. These scans read the source of every file in components/domain/signals/outreach/ except the
 * Messages panel's own files (`messages-*`, the older screen moved here, which has its own pinned tests in lib/outreach/).
 *
 * A scan that matches nothing proves nothing, so each rule is also run on text it must flag (the last test), and the scans first prove they found the files they are meant to read.
 */

const DIR = 'components/domain/signals/outreach'
const read = (file: string) => readFileSync(path.resolve(file), 'utf8')

/** The code without whole-line comments (they explain what is NOT done, in the very words searched for). */
function code(source: string): string {
  let inBlock = false
  return source.split(/\r?\n/).filter((line) => {
    const text = line.trim()
    if (inBlock) { if (text.includes('*/')) inBlock = false; return false }
    if (text.startsWith('/*')) { if (!text.includes('*/')) inBlock = true; return false }
    return !text.startsWith('//') && !text.startsWith('*')
  }).join('\n')
}

const OWN_FILES = readdirSync(path.resolve(DIR)).filter((name) => /\.tsx?$/.test(name) && !name.startsWith('messages-')).sort()
const sources = Object.fromEntries(OWN_FILES.map((name) => [name, code(read(`${DIR}/${name}`))]))

/** A path that names a sending, approving or scheduling route. */
const ROUTES = /['"`][^'"`\n]*\/(send|approve|schedule|unschedule|dispatch)\b/i
/** A call of anything named send..., approve..., schedule..., unschedule... or dispatch (including React's own `dispatch`). */
const CALLS = /\b(send|approve|unschedule|schedule|dispatch)[A-Za-z]*\s*\(/i
/** A control (a button label, a menu item) worded as an act of sending, approving or scheduling. "Submit for approval" is the one allowed act. */
/** (React's own `Dispatch` type, the state setter's, is not a control; a call of `dispatch(` is caught by CALLS.) */
const CONTROLS = /\b(Send|Approve|Schedule|Unschedule)\b/
/** A way to reach the network that is not the Outreach API or the read-only checks. */
const DIRECT_NETWORK = /\bfetch\s*\(|\bapiClient\b|\bwebClient\b|XMLHttpRequest|crmService|services\/crm|OutreachMailer|CrmOutreach/

/** Every `something.method(` call on the Outreach API object, by the object's usual names. */
const API_CALL = /\b(?:service|api)\.([A-Za-z]+)\s*\(/g
const OUTREACH_API_METHODS = ['companies', 'company', 'addCompany', 'updateCompany', 'deleteCompany', 'people', 'person', 'addPerson', 'updatePerson', 'deletePerson', 'setConsent', 'assign', 'findContacts', 'convertToLead', 'writeMessages', 'personMessages']

describe('the Outreach screens cannot send, approve or schedule anything', () => {
  it('reads the files it is meant to scan, and not the Messages panel\'s own', () => {
    for (const name of ['outreach-page.tsx', 'outreach-companies.tsx', 'outreach-people.tsx', 'outreach-company-page.tsx', 'outreach-person-panel.tsx', 'write-message-dialog.tsx', 'add-company-dialog.tsx', 'add-person-dialog.tsx', 'consent-dialog.tsx', 'reach-chip.tsx']) {
      assert.ok(OWN_FILES.includes(name), `${name} is scanned`)
    }
    assert.ok(OWN_FILES.every((name) => !name.startsWith('messages-')))
    assert.ok(OWN_FILES.length >= 15, `${OWN_FILES.length} files`)
    for (const name of OWN_FILES) assert.ok(sources[name].length > 50, `${name} has code to scan`)
  })

  for (const name of OWN_FILES) {
    describe(name, () => {
      it('names no sending, approving or scheduling route, and calls nothing of that name', () => {
        assert.equal(ROUTES.test(sources[name]), false, 'a path to send, approve, schedule or dispatch')
        assert.equal(CALLS.test(sources[name]), false, 'a call named send, approve, schedule or dispatch')
      })

      it('has no control labelled Send, Approve or Schedule', () => {
        assert.equal(CONTROLS.test(sources[name]), false)
      })

      it('reaches the network only through the Outreach API, the read-only checks and the one submit call', () => {
        assert.equal(DIRECT_NETWORK.test(sources[name]), false)
        const services = [...sources[name].matchAll(/from '(@\/services\/[^']+)'/g)].map((match) => match[1])
        const allowed = ['@/services/signals/outreach', '@/services/signals/outreach-types', '@/services/outreach/gate-service', '@/services/gtm/gtm', '@/services/core']
        assert.deepEqual(services.filter((service) => !allowed.includes(service)), [], 'a service this screen has no business with')
      })

      it('calls only methods the Outreach API has', () => {
        const used = [...sources[name].matchAll(API_CALL)].map((match) => match[1])
        assert.deepEqual(used.filter((method) => !OUTREACH_API_METHODS.includes(method)), [])
      })
    })
  }

  it('imports the GTM service in one file only, for one call, and that call is submit', () => {
    const importers = OWN_FILES.filter((name) => /services\/gtm\/gtm/.test(sources[name]))
    assert.deepEqual(importers, ['write-message-dialog.tsx'])
    const source = sources['write-message-dialog.tsx']
    assert.match(source, /import \{ outreachService as gtmOutreach \} from '@\/services\/gtm\/gtm'/)
    const members = [...source.matchAll(/\bgtmOutreach\.([A-Za-z]+)/g)].map((match) => match[1])
    assert.deepEqual(members, ['submit'], 'the only call on the GTM outreach service is submit')
    assert.match(source, /gtmOutreach\.submit\(messageId\)/)
  })

  it('keeps the checks read-only: the dialog gives the section the gate API and nothing else', () => {
    const source = sources['write-message-dialog.tsx']
    assert.match(source, /<OutreachChecks[\s\S]*?refusal=\{null\}[\s\S]*?api=\{gate\}/)
    assert.match(source, /import \{ gateService, type GateApi \} from '@\/services\/outreach\/gate-service'/)
  })

  it('offers Submit for approval and nothing like it, in the dialog\'s buttons', () => {
    const source = sources['write-message-dialog.tsx']
    assert.ok(source.includes('Submit for approval'))
    const labels = [...source.matchAll(/>\s*([A-Z][A-Za-z ]+?)\s*<\/(?:Button|button)>/g)].map((match) => match[1])
    assert.ok(labels.includes('Close') && labels.includes('Cancel'), JSON.stringify(labels))
    assert.deepEqual(labels.filter((label) => /^(send|approve|schedule|dispatch)/i.test(label)), [])
  })

  it('says the sending and approving happen in Messages, and links there', () => {
    const source = sources['write-message-dialog.tsx']
    assert.ok(source.includes('Approving and sending happen in'))
    assert.match(source, /href=\{outreachHref\('messages'\)\}/)
  })

  it('never turns a saved draft into anything else: the Outreach API\'s message call is writeMessages, once, in the dialog', () => {
    const calls = OWN_FILES.flatMap((name) => [...sources[name].matchAll(/\.writeMessages\(/g)].map(() => name))
    assert.deepEqual(calls, ['write-message-dialog.tsx'])
  })

  it('catches what it is meant to catch (each rule run on text it must flag)', () => {
    assert.equal(ROUTES.test("apiClient.post(`/gtm/outreach/${id}/send`, {})"), true)
    assert.equal(ROUTES.test("'/gtm/outreach/1/approve'"), true)
    assert.equal(ROUTES.test("'/x/schedule'"), true)
    assert.equal(CALLS.test('await message.send()'), true)
    assert.equal(CALLS.test('outreachService.approve(id)'), true)
    assert.equal(CALLS.test('dispatch({ type: "x" })'), true)
    assert.equal(CALLS.test('sendNow(id)'), true)
    assert.equal(CONTROLS.test('<Button>Send now</Button>'), true)
    assert.equal(CONTROLS.test("label: 'Approve'"), true)
    assert.equal(CONTROLS.test('listState?: readonly [S, Dispatch<SetStateAction<S>>]'), false, 'the state setter type is not a control')
    assert.equal(DIRECT_NETWORK.test("await fetch('/x')"), true)
    assert.equal(DIRECT_NETWORK.test('crmService.sendSms()'), true)
    assert.deepEqual([...'service.sendEmail(1) and api.companies(q)'.matchAll(API_CALL)].map((match) => match[1]), ['sendEmail', 'companies'])
    assert.equal(code('// never send\nconst a = 1\n/* approve */\nconst b = 2').trim(), 'const a = 1\nconst b = 2', 'comments are not code')
  })

  it('does not flag the words the screens legitimately use', () => {
    const fine = "Approving and sending happen in Messages. Submit for approval. 'Nothing is sent from here.' Waiting for approval. Not approved. Could not be sent."
    assert.equal(ROUTES.test(fine), false)
    assert.equal(CALLS.test(fine), false)
    assert.equal(CONTROLS.test(fine), false)
  })
})
