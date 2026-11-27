import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import type { PlatformRegistryPayload, WorkflowChain, WorkflowPayload, WorkflowPoint, WorkflowStep } from './workflow'

/**
 * The Approvals tab in a fake browser with a fake server: the real components, the real scaffolds (RecordDrawer, useConfirm, Field) and `fetch` replaced by a table of
 * answers. It pins what a person sees (a word for each status, no engine words, an honest empty state), what the screen asks of the server (the same keys as before) and
 * what it does when the server fails.
 */

const step = (over: Partial<WorkflowStep> = {}): WorkflowStep => ({
  id: 'stp_1', order: 1, name: 'Reporting manager', approver_type: 'reporting_manager', approver: '', sla_hours: 24, on_breach: 'remind', allow_delegate: true, require_comment: false, ...over,
})

const flow = (over: Partial<WorkflowChain> = {}): WorkflowChain => ({
  id: 7, flow_key: 'hrms.leave.approval', module: 'hrms', component: 'leave', name: 'Long leave', description: null, status: 'active', condition: 'leave_days > 5', steps: [step(), step({ id: 'stp_2', order: 2, name: 'HR', approver_type: 'role', approver: 'hr_manager', sla_hours: 48 })],
  step_count: 2, total_sla_hours: 72, on_reject: 'return_to_requester', notify_requester: true, created_at: null, created_by: null, updated_at: null, updated_by: null, effective: false,
  ineffective_reason: 'This chain only takes effect when its condition is met by the specific request being decided.', ...over,
})

const point = (over: Partial<WorkflowPoint> = {}): WorkflowPoint => ({
  key: 'hrms.leave.approval', module: 'hrms', component: 'leave', label: 'Leave approval', description: 'Sign-off before a leave request is granted.', subject: 'Leave request', enforced: true,
  enforced_note: 'Enforced when a request is submitted. Editing or deleting a chain does not change requests already in flight.',
  suggested_steps: [step(), step({ id: 'stp_2', order: 2, name: 'HR', approver_type: 'role', approver: 'hr_manager', sla_hours: 48, on_breach: 'escalate' })], workflows: [], ...over,
})

const PAYLOAD = (points: WorkflowPoint[]): WorkflowPayload => ({
  points,
  summary: { points: points.length, governed: 0, workflows: 0, active: 0, draft: 0, enforced_points: points.filter((p) => p.enforced).length, enforced_governed: 0 },
})

const REGISTRY: PlatformRegistryPayload = {
  modules: [
    { key: 'hrms', label: 'HRMS', description: '', icon: '' },
    { key: 'talent', label: 'Talent', description: '', icon: '' },
  ],
  components: [],
  workflows: [],
  approver_types: [
    { key: 'reporting_manager', label: 'Reporting manager', needs_value: false },
    { key: 'role', label: 'A role', needs_value: true },
    { key: 'user', label: 'A named person', needs_value: true },
  ],
  escalation_actions: [
    { key: 'none', label: 'Do nothing' },
    { key: 'remind', label: 'Send a reminder' },
    { key: 'escalate', label: 'Pass it up' },
  ],
  custom_field_tables: [],
  problems: [],
}

const POINTS = [
  point({ workflows: [flow({ id: 1, name: 'Long leave', status: 'active' }), flow({ id: 2, name: 'Draft flow', status: 'draft', condition: '', effective: false }), flow({ id: 3, name: 'Old flow', status: 'disabled', condition: '' })] }),
  point({ key: 'hrms.attendance.regularisation', component: 'attendance', label: 'Attendance regularisation', description: 'Sign-off before attendance is corrected.', subject: 'Attendance regularisation', workflows: [] }),
  point({ key: 'talent.offer.approval', module: 'talent', component: 'offer', label: 'Offer approval', description: 'Sign-off before an offer is sent.', subject: 'Offer', enforced: false, workflows: [] }),
]

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body: Record<string, unknown> | undefined
}

type Answer = unknown | ((call: Call) => unknown)

interface Setup {
  module?: 'hrms' | 'crm' | null
  points?: WorkflowPoint[]
  /** Overrides, by `METHOD path-suffix`. A status can be given with `{ __status: 500, message: '…' }`. */
  answers?: Record<string, Answer>
  registry?: PlatformRegistryPayload
}

async function setup(options: Setup = {}) {
  const k = await kit()
  const router = await routerHarness('', '/platform-services/workflow')
  const { ApprovalsTab } = await import('../../app/platform-services/workflow/_components/approvals')

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const calls: Call[] = []
  const original = globalThis.fetch
  const scope = options.module === undefined ? null : options.module

  globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: string }) => {
    const url = new URL(String(input), 'http://test.local')
    const call: Call = { method: init?.method ?? 'GET', path: url.pathname, query: url.searchParams, body: init?.body ? JSON.parse(init.body) : undefined }
    calls.push(call)

    const key = Object.keys(options.answers ?? {}).find((candidate) => candidate === `${call.method} ${call.path.slice(call.path.indexOf('/platform') + '/platform'.length)}`)
    let data: unknown
    if (key) {
      const answer = options.answers![key]
      data = typeof answer === 'function' ? (answer as (c: Call) => unknown)(call) : answer
    } else if (call.method === 'GET' && call.path.endsWith('/workflow/points')) data = PAYLOAD(options.points ?? POINTS)
    else if (call.method === 'GET' && call.path.endsWith('/registry')) data = options.registry ?? REGISTRY
    else data = {}

    const status = (data as { __status?: number } | null)?.__status ?? 200
    const body = status >= 400 ? { success: false, message: (data as { message?: string }).message ?? 'Failed', data: null, errors: {} } : { success: true, message: 'ok', data }
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  await k.render(router.wrap(k.h(ApprovalsTab, { moduleKey: scope })))
  await k.tick(20)
  await k.tick(20)

  const setValue = async (el: Element, value: string) => {
    const proto = el.tagName === 'SELECT' ? k.w.HTMLSelectElement.prototype : k.w.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
    await k.act(async () => { el.dispatchEvent(new k.w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })) })
  }
  /** The control a label names, inside the open drawer (or anywhere when none is open). */
  const control = (label: string, within: ParentNode = k.w.document): HTMLInputElement | HTMLSelectElement | null => {
    const found = Array.from(within.querySelectorAll('label')).find((l) => (l.textContent ?? '').replace('*', '').trim().startsWith(label))
    return found ? (k.w.document.getElementById(found.getAttribute('for') ?? '') as HTMLInputElement | HTMLSelectElement | null) : null
  }
  const drawer = () => k.one('[role="dialog"]')
  /** A button by its visible text or, where the text is shared by several (Edit, Delete), by the name a screen reader gives it. */
  const button = (text: string, within: ParentNode = k.w.document) => (Array.from(within.querySelectorAll('button')) as HTMLElement[]).find((b) => (b.textContent ?? '').trim() === text || b.getAttribute('aria-label') === text) ?? null
  const press = async (el: Element | null, settle = 20) => {
    assert.ok(el, 'the button exists')
    await k.click(el)
    await k.tick(settle)
    await k.tick(settle)
  }
  const text = () => k.w.document.body.textContent ?? ''

  return { k, calls, setValue, control, drawer, button, press, text, restore: () => { globalThis.fetch = original } }
}

describe('the Approvals tab: what a person sees', () => {
  afterEach(disposeAll)

  it('shows a loading placeholder first, with words, and then the approvals', async () => {
    const k = await kit()
    const router = await routerHarness('', '/platform-services/workflow')
    const { ApprovalsTab } = await import('../../app/platform-services/workflow/_components/approvals')
    k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
    Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })
    const original = globalThis.fetch
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    globalThis.fetch = (async (input: unknown) => {
      await gate
      const data = String(input).includes('registry') ? REGISTRY : PAYLOAD(POINTS)
      return new Response(JSON.stringify({ success: true, message: 'ok', data }), { status: 200 })
    }) as typeof fetch
    try {
      await k.render(router.wrap(k.h(ApprovalsTab, { moduleKey: null })))
      await k.tick(5)
      assert.ok(k.bodyText().includes('Loading approvals…'))
      assert.ok(k.one('[role="status"]'))
      release()
      await k.tick(20)
      await k.tick(20)
      assert.ok(!k.bodyText().includes('Loading approvals…'))
      assert.ok(k.bodyText().includes('Leave approval'))
    } finally {
      globalThis.fetch = original
    }
  })

  it('lists every approval by module, with how many have a flow turned on, and a chip that says where each one stands', async () => {
    const s = await setup()
    try {
      const headings = s.k.all('h2').map((h) => h.textContent?.replace(/\s+/g, ' ').trim())
      assert.deepEqual(headings, ['HRMS (2)', 'Talent (1)'])
      assert.equal(s.k.one('[data-approvals-summary]')!.textContent, '1 of 2 approvals have a flow turned on. 1 more can be set up, but nothing uses it yet.')
      const chip = (key: string) => s.k.one(`[data-approval="${key}"] [data-coverage]`)!.textContent
      assert.equal(chip('hrms.leave.approval'), 'A flow is on')
      assert.equal(chip('hrms.attendance.regularisation'), 'No approval flow')
      assert.equal(chip('talent.offer.approval'), 'Not in use yet')
      assert.ok(s.k.one('[data-coverage-bar]'), 'the bar is drawn')
      assert.equal(s.k.one('[data-coverage-bar]')!.getAttribute('aria-hidden'), 'true', 'and hidden from a screen reader, which has the sentence')
    } finally { s.restore() }
  })

  it('shows the status of a flow as the word Draft, On or Off, never "Coming soon", and never a lock', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1) })
    try {
      await s.press(s.k.one('[data-approval="hrms.leave.approval"] h3 button'))
      const status = (id: number) => s.k.one(`[data-flow="${id}"] [data-flow-status]`)!.textContent
      assert.equal(status(1), 'On')
      assert.equal(status(2), 'Draft')
      assert.equal(status(3), 'Off')
      assert.ok(!/coming soon/i.test(s.text()))
      assert.equal(s.k.all('[data-flow] svg.lucide-lock').length, 0)
    } finally { s.restore() }
  })

  it('says what a flow does in one sentence, and why it is not in use, in words that carry no engine terms', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1) })
    try {
      await s.press(s.k.one('[data-approval="hrms.leave.approval"] h3 button'))
      assert.ok(s.text().includes('2 steps, up to 72 hours. Applies when leave_days is more than 5.'))
      assert.ok(s.text().includes('Saved for later. Nothing waits for it until you turn it on.'))
      assert.ok(s.text().includes('Switched off. New requests skip it.'))
    } finally { s.restore() }
  })

  it('shows no word the engine uses, and never the raw key of an approval, anywhere on the tab', async () => {
    const s = await setup({ module: 'hrms', points: POINTS })
    try {
      await s.press(s.k.one('[data-approval="hrms.leave.approval"] h3 button'))
      await s.press(s.k.one('[data-approval="talent.offer.approval"] h3 button'))
      const shown = s.text()
      assert.doesNotMatch(shown, /\b(chains?|enforced|governed|payload|flow_key|trigger_event)\b/i)
      assert.doesNotMatch(shown, /\bpoints?\b/i)
      assert.ok(!shown.includes('hrms.leave.approval'), 'the key is not shown')
      assert.ok(!shown.includes('Enforced when a request is submitted'), 'the server\'s note, which speaks of chains and ladders, is not repeated')
      assert.ok(!shown.includes('This chain only takes effect'), 'nor is its reason')
    } finally { s.restore() }
  })

  it('says an approval nothing uses yet is only a plan, and that one with no flow lets requests go ahead', async () => {
    const s = await setup({ module: 'hrms', points: POINTS })
    try {
      await s.press(s.k.one('[data-approval="talent.offer.approval"] h3 button'))
      assert.ok(s.text().includes('A flow saved here is only a plan'))
      await s.press(s.k.one('[data-approval="hrms.attendance.regularisation"] h3 button'))
      assert.ok(s.text().includes('Nobody signs off attendance regularisations here yet. They go ahead without approval.'))
    } finally { s.restore() }
  })

  it('opens and closes an approval with its button, and tells a screen reader which it is', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1) })
    try {
      const toggle = s.k.one('[data-approval="hrms.leave.approval"] h3 button')!
      assert.equal(toggle.getAttribute('aria-expanded'), 'false')
      await s.press(toggle)
      assert.equal(toggle.getAttribute('aria-expanded'), 'true')
      assert.ok(s.k.w.document.getElementById(toggle.getAttribute('aria-controls')!), 'it controls a real panel')
      await s.press(toggle)
      assert.equal(toggle.getAttribute('aria-expanded'), 'false')
    } finally { s.restore() }
  })

  it('asks the server for one module\'s approvals when the tab is pinned to a module, and for all of them in the central view', async () => {
    const pinned = await setup({ module: 'hrms', points: POINTS.slice(0, 1) })
    try {
      assert.equal(pinned.calls.find((c) => c.path.endsWith('/workflow/points'))!.query.get('module'), 'hrms')
    } finally { pinned.restore() }
    await disposeAll()
    const central = await setup()
    try {
      assert.equal(central.calls.find((c) => c.path.endsWith('/workflow/points'))!.query.get('module'), null)
    } finally { central.restore() }
  })

  it('shows an honest empty state for Sales & Marketing, with a line about when approvals appear', async () => {
    const s = await setup({ module: 'crm', points: [] })
    try {
      assert.ok(s.text().includes('No approvals are set for Sales & Marketing yet'))
      assert.ok(s.text().includes('Approvals appear here once an approval flow is declared for this module.'))
      assert.equal(s.k.all('[data-approval]').length, 0)
    } finally { s.restore() }
  })

  it('shows what went wrong and a Try again button when the first load fails, and loads again on it', async () => {
    let attempt = 0
    const s = await setup({
      answers: {
        'GET /workflow/points': () => (attempt++ === 0 ? { __status: 500, message: 'The platform could not be reached.' } : PAYLOAD(POINTS)),
      },
    })
    try {
      assert.ok(s.text().includes('The platform could not be reached.'))
      assert.equal(s.k.all('[data-approval]').length, 0)
      await s.press(s.button('Try again'))
      assert.ok(s.k.all('[data-approval]').length > 0, 'the list is there after the retry')
    } finally { s.restore() }
  })

  it('keeps the list and says it may be out of date when a refresh fails', async () => {
    let attempt = 0
    const s = await setup({
      answers: { 'GET /workflow/points': () => (attempt++ === 0 ? PAYLOAD(POINTS) : { __status: 500, message: 'The platform could not be reached.' }) },
    })
    try {
      await s.press(s.button('Refresh'))
      assert.ok(s.text().includes('The platform could not be reached. The list below may be out of date.'))
      assert.ok(s.k.all('[data-approval]').length > 0)
    } finally { s.restore() }
  })

  it('lists the problems of the approvals setup, in plain words, when the registry reports any', async () => {
    const s = await setup({ registry: { ...REGISTRY, problems: ['Approval talent.offer.approval names a module nobody declared.'] } })
    try {
      assert.ok(s.text().includes('The approvals setup needs attention (1)'))
      assert.ok(s.text().includes('Share these details with your platform administrator.'))
      assert.ok(!s.text().includes('config/platform_services.php'))
    } finally { s.restore() }
  })
})

describe('the Approvals tab: the form', () => {
  afterEach(disposeAll)

  const openNew = async (s: Awaited<ReturnType<typeof setup>>, key = 'hrms.leave.approval') => {
    await s.press(s.button('Add approval flow', s.k.one(`[data-approval="${key}"]`)!))
  }

  it('opens the form in a drawer, not above the list, with the approval named in words and the flow starting as a draft', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 2) })
    try {
      await openNew(s)
      const drawer = s.drawer()
      assert.ok(drawer, 'a drawer is open')
      assert.ok(drawer!.textContent!.includes('Add an approval flow'))
      assert.ok(drawer!.textContent!.includes('Leave approval in HRMS'))
      assert.equal(s.control('Status')!.value, 'draft')
      assert.equal(s.control('Name')!.value, 'Leave approval')
      assert.ok(drawer!.textContent!.includes('A new flow starts as a draft'))
      assert.equal(s.k.all('[data-step]').length, 2, 'the approval\'s own suggested steps')
    } finally { s.restore() }
  })

  it('says what is wrong next to the field, puts focus on the first one, and sends nothing, when a step has no name', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1) })
    try {
      await openNew(s)
      const first = s.k.one('[data-step="1"]')!
      await s.setValue(s.control('Step name', first)!, '')
      await s.press(s.button('Save approval flow'))
      assert.ok(s.drawer()!.textContent!.includes('Name this step, for example “Reporting manager”.'))
      assert.equal(s.k.w.document.activeElement, s.control('Step name', first), 'focus is on the first field that is wrong')
      assert.equal(s.control('Step name', first)!.getAttribute('aria-invalid'), 'true')
      assert.equal(s.calls.filter((c) => c.method === 'POST').length, 0, 'nothing was sent')
    } finally { s.restore() }
  })

  it('refuses On at an approval the product does not use yet, in words, before anything is sent', async () => {
    const s = await setup({ module: 'hrms', points: [POINTS[2]] })
    try {
      await openNew(s, 'talent.offer.approval')
      await s.setValue(s.control('Status')!, 'active')
      await s.press(s.button('Save approval flow'))
      assert.ok(s.drawer()!.textContent!.includes('Nothing in the product uses this approval yet, so a flow cannot be turned on here. Save it as a draft instead.'))
      assert.equal(s.calls.filter((c) => c.method === 'POST').length, 0)
    } finally { s.restore() }
  })

  it('saves a new flow with the keys the screen has always sent, then closes, says so, and loads the list again', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1), answers: { 'POST /workflow': { workflow: flow({ id: 99 }) } } })
    try {
      await openNew(s)
      await s.setValue(s.control('Name')!, 'Leave over a week')
      await s.press(s.button('Add a condition'))
      await s.setValue(s.control('Value', s.k.one('[data-condition-row="1"]')!)!, 'leave_days')
      await s.setValue(s.control('Number', s.k.one('[data-condition-row="1"]')!)!, '7')
      assert.ok(s.k.one('[data-condition-sentence]')!.textContent!.includes('Applies when leave_days is more than 7.'), 'the sentence is made as the rows are filled')
      const before = s.calls.filter((c) => c.path.endsWith('/workflow/points')).length
      await s.press(s.button('Save approval flow'))
      const post = s.calls.find((c) => c.method === 'POST' && c.path.endsWith('/workflow'))!
      assert.deepEqual(Object.keys(post.body!), ['flow_key', 'name', 'description', 'condition', 'status', 'steps', 'on_reject', 'notify_requester'])
      assert.equal(post.body!.flow_key, 'hrms.leave.approval')
      assert.equal(post.body!.name, 'Leave over a week')
      assert.equal(post.body!.condition, 'leave_days > 7')
      assert.equal(post.body!.status, 'draft')
      assert.equal((post.body!.steps as unknown[]).length, 2)
      assert.equal(post.body!.on_reject, 'return_to_requester')
      assert.equal(post.body!.notify_requester, true)
      assert.equal(s.drawer(), null, 'the drawer closes')
      assert.ok(s.text().includes('Approval flow saved.'))
      assert.ok(s.calls.filter((c) => c.path.endsWith('/workflow/points')).length > before, 'the list is read again')
    } finally { s.restore() }
  })

  it('edits a stored flow with a PUT to its own id and the same keys', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1), answers: { 'PUT /workflow/1': { workflow: flow({ id: 1 }) } } })
    try {
      await s.press(s.k.one('[data-approval="hrms.leave.approval"] h3 button'))
      await s.press(s.button('Edit Long leave'))
      assert.ok(s.drawer()!.textContent!.includes('Edit approval flow'))
      assert.equal(s.control('Status')!.value, 'active')
      assert.equal(s.k.one('[data-condition-row="1"]') !== null, true, 'the condition is shown as a row')
      await s.setValue(s.control('Name')!, 'Longer leave')
      await s.press(s.button('Save approval flow'))
      const put = s.calls.find((c) => c.method === 'PUT')!
      assert.equal(put.path.endsWith('/workflow/1'), true)
      assert.equal(put.body!.name, 'Longer leave')
      assert.equal(put.body!.condition, 'leave_days > 5')
    } finally { s.restore() }
  })

  it('shows what the server refused, as it came, at the top of the form, and keeps what was typed', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1), answers: { 'POST /workflow': { __status: 422, message: 'Step 2: set an SLA, or there is nothing for its breach action to happen after.' } } })
    try {
      await openNew(s)
      await s.setValue(s.control('Name')!, 'Kept')
      await s.press(s.button('Save approval flow'))
      assert.ok(s.drawer()!.textContent!.includes('This could not be saved'))
      assert.ok(s.drawer()!.textContent!.includes('Step 2: set an SLA, or there is nothing for its breach action to happen after.'))
      assert.equal(s.control('Name')!.value, 'Kept')
    } finally { s.restore() }
  })

  it('asks before throwing away what was typed, and closes without asking when nothing was', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1) })
    try {
      await openNew(s)
      await s.press(s.button('Cancel', s.drawer()!))
      assert.equal(s.k.one('[role="alertdialog"]'), null, 'nothing typed, nothing asked')
      assert.equal(s.drawer(), null)

      await openNew(s)
      await s.setValue(s.control('Name')!, 'Changed')
      await s.press(s.button('Cancel', s.drawer()!))
      const question = s.k.one('[role="alertdialog"]')
      assert.ok(question, 'it asks')
      assert.ok(question!.textContent!.includes('Discard your changes?'))
    } finally { s.restore() }
  })

  it('checks which flow applies for typed values and says so in a sentence, changing nothing', async () => {
    const s = await setup({
      module: 'hrms',
      points: POINTS.slice(0, 1),
      answers: { 'POST /workflow/simulate': { matched: true, reason: 'selected', workflow: flow({ name: 'Long leave', step_count: 2, total_sla_hours: 72 }) } },
    })
    try {
      await openNew(s)
      const panel = s.drawer()!.querySelector('section[aria-labelledby]') as HTMLElement
      await s.setValue(s.control('Value', panel)!, 'leave_days')
      await s.setValue(s.control('Number', panel)!, '7')
      await s.press(s.button('Check these values', panel))
      const sent = s.calls.find((c) => c.path.endsWith('/workflow/simulate'))!
      assert.deepEqual(sent.body, { flow_key: 'hrms.leave.approval', context: { leave_days: 7 } })
      assert.equal(s.k.one('[data-check-result]')!.textContent, '“Long leave” would apply: 2 steps, up to 72 hours.')
      assert.equal(s.calls.filter((c) => c.method !== 'GET' && !c.path.endsWith('/simulate')).length, 0, 'nothing was changed')
    } finally { s.restore() }
  })

  it('does not save the form when Enter is pressed in the check\'s fields (the check is outside the form)', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1) })
    try {
      await openNew(s)
      const panel = s.drawer()!.querySelector('section[aria-labelledby]') as HTMLElement
      assert.equal(panel.closest('form'), null)
    } finally { s.restore() }
  })
})

describe('the Approvals tab: deleting and history', () => {
  afterEach(disposeAll)

  it('asks with a dialog, not window.confirm, before it deletes, and deletes only on the answer yes', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1), answers: { 'DELETE /workflow/2': { deleted: 2 } } })
    const asked: string[] = []
    ;(globalThis as unknown as { confirm: (m: string) => boolean }).confirm = (message) => { asked.push(message); return true }
    try {
      await s.press(s.k.one('[data-approval="hrms.leave.approval"] h3 button'))
      await s.press(s.button('Delete Draft flow'))
      const dialog = s.k.one('[role="alertdialog"]')!
      assert.ok(dialog.textContent!.includes('Delete “Draft flow”?'))
      assert.ok(dialog.textContent!.includes('Requests already waiting for a decision are not affected.'))
      assert.equal(s.calls.filter((c) => c.method === 'DELETE').length, 0, 'nothing is deleted while it asks')
      await s.press(s.button('Cancel', dialog))
      assert.equal(s.calls.filter((c) => c.method === 'DELETE').length, 0, 'No answers no')

      await s.press(s.button('Delete Draft flow'))
      await s.press(s.button('Delete approval flow', s.k.one('[role="alertdialog"]')!))
      assert.equal(s.calls.filter((c) => c.method === 'DELETE').length, 1)
      assert.ok(s.calls.find((c) => c.method === 'DELETE')!.path.endsWith('/workflow/2'))
      assert.ok(s.text().includes('Approval flow deleted.'))
      assert.deepEqual(asked, [], 'window.confirm was never used')
    } finally { s.restore() }
  })

  it('says what went wrong and keeps the list when a delete fails', async () => {
    const s = await setup({ module: 'hrms', points: POINTS.slice(0, 1), answers: { 'DELETE /workflow/2': { __status: 500, message: 'The platform could not be reached.' } } })
    try {
      await s.press(s.k.one('[data-approval="hrms.leave.approval"] h3 button'))
      await s.press(s.button('Delete Draft flow'))
      await s.press(s.button('Delete approval flow', s.k.one('[role="alertdialog"]')!))
      assert.ok(s.text().includes('The platform could not be reached.'))
      assert.ok(s.k.all('[data-approval]').length > 0)
    } finally { s.restore() }
  })

  it('shows the history of a flow in dates and sentences, and hides it again on a second press', async () => {
    const s = await setup({
      module: 'hrms',
      points: POINTS.slice(0, 1),
      answers: { 'GET /workflow/1/history': { versions: [{ id: 1, changed_by: 'Asha', created_at: '2026-11-20T10:30:00Z', snapshot: flow(), summary: '2 steps changed to 3 steps.' }] } },
    })
    try {
      await s.press(s.k.one('[data-approval="hrms.leave.approval"] h3 button'))
      const history = s.button('History of Long leave')!
      await s.press(history)
      assert.ok(s.text().includes('2 steps changed to 3 steps.'))
      assert.ok(s.text().includes('Asha'))
      assert.equal(history.getAttribute('aria-expanded'), 'true')
      await s.press(history)
      assert.ok(!s.text().includes('2 steps changed to 3 steps.'))
    } finally { s.restore() }
  })
})
