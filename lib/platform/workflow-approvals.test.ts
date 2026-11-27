import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { RegistryOption, WorkflowChain, WorkflowPoint, WorkflowStatus, WorkflowStep } from './workflow'
import {
  approvalsSummary,
  breachNeedsTime,
  conditionRowErrors,
  conditionWarning,
  COVERAGE_TONE,
  COVERAGE_WORD,
  describeCondition,
  editFlowForm,
  emptyStep,
  flowNote,
  flowPayload,
  flowSentence,
  FLOW_STATUS_MEANING,
  FLOW_STATUS_TONE,
  FLOW_STATUS_WORD,
  formatCondition,
  hasFlowFormErrors,
  isFlowFormDirty,
  newFlowForm,
  orderedModuleKeys,
  parseCondition,
  plural,
  pointCoverage,
  previewContext,
  previewSummary,
  stepErrors,
  validateFlowForm,
} from './workflow-approvals'

const APPROVER_TYPES: RegistryOption[] = [
  { key: 'reporting_manager', label: 'Reporting manager', needs_value: false },
  { key: 'department_head', label: 'Department head', needs_value: false },
  { key: 'role', label: 'A role', needs_value: true },
  { key: 'user', label: 'A named person', needs_value: true },
]

const step = (over: Partial<WorkflowStep> = {}): WorkflowStep => ({
  id: 'stp_1', order: 1, name: 'Reporting manager', approver_type: 'reporting_manager', approver: '', sla_hours: 24, on_breach: 'remind', allow_delegate: true, require_comment: false, ...over,
})

const flow = (over: Partial<WorkflowChain> = {}): WorkflowChain => ({
  id: 7, flow_key: 'hrms.leave.approval', module: 'hrms', component: 'leave', name: 'Long leave', description: null, status: 'active', condition: '', steps: [step()], step_count: 1, total_sla_hours: 24,
  on_reject: 'return_to_requester', notify_requester: true, created_at: null, created_by: null, updated_at: null, updated_by: null, effective: true, ineffective_reason: null, ...over,
})

const point = (over: Partial<WorkflowPoint> = {}): WorkflowPoint => ({
  key: 'hrms.leave.approval', module: 'hrms', component: 'leave', label: 'Leave approval', description: 'Sign-off before a leave request is granted.', subject: 'Leave request',
  enforced: true, enforced_note: 'Enforced when a request is submitted.', suggested_steps: [step({ name: 'Reporting manager' }), step({ id: 'stp_2', order: 2, name: 'HR', approver_type: 'role', approver: 'hr_manager', sla_hours: 48, on_breach: 'escalate' })], workflows: [], ...over,
})

const CONTEXT = { enforced: true, approverTypes: APPROVER_TYPES }

describe('the status of an approval flow is a word, never "Coming soon"', () => {
  it('says Draft, On and Off for the three statuses the server stores', () => {
    assert.deepEqual(FLOW_STATUS_WORD, { draft: 'Draft', active: 'On', disabled: 'Off' })
    for (const status of Object.keys(FLOW_STATUS_WORD) as WorkflowStatus[]) {
      assert.ok(FLOW_STATUS_MEANING[status].length > 0)
      assert.ok(FLOW_STATUS_TONE[status])
    }
  })

  it('never uses the wording of the old chip (a lock and "Coming soon" for a draft and a disabled flow)', () => {
    for (const word of Object.values(FLOW_STATUS_WORD)) assert.doesNotMatch(word, /coming soon|live|lock/i)
  })

  it('takes the tone from the status: On is the positive look, Draft the neutral one, Off the muted one', () => {
    assert.deepEqual(FLOW_STATUS_TONE, { draft: 'neutral', active: 'positive', disabled: 'muted' })
  })
})

describe('where an approval stands', () => {
  it('is "on" when any flow is On, "no flow" when there is none, "none on" when only a draft or an Off flow exists', () => {
    assert.equal(pointCoverage(point({ workflows: [flow({ status: 'draft' }), flow({ status: 'active' })] })), 'on')
    assert.equal(pointCoverage(point({ workflows: [] })), 'no-flow')
    assert.equal(pointCoverage(point({ workflows: [flow({ status: 'draft' })] })), 'none-on')
    assert.equal(pointCoverage(point({ workflows: [flow({ status: 'disabled' })] })), 'none-on')
  })

  it('calls an approval nothing reads "not in use yet", whatever flows are saved on it', () => {
    assert.equal(pointCoverage(point({ enforced: false, workflows: [flow({ status: 'active' })] })), 'not-in-use')
    assert.equal(COVERAGE_WORD['not-in-use'], 'Not in use yet')
  })

  it('has a word and a tone for each state, and a gap is the caution look, not the positive one', () => {
    assert.deepEqual(Object.keys(COVERAGE_WORD).sort(), Object.keys(COVERAGE_TONE).sort())
    assert.equal(COVERAGE_TONE.on, 'positive')
    assert.equal(COVERAGE_TONE['no-flow'], 'caution')
    assert.equal(COVERAGE_TONE['none-on'], 'caution')
  })

  it('uses none of the developer words anywhere in the words it shows', () => {
    const shown = [...Object.values(COVERAGE_WORD), ...Object.values(FLOW_STATUS_WORD), ...Object.values(FLOW_STATUS_MEANING)].join(' ')
    assert.doesNotMatch(shown, /\b(point|chain|flow_key|enforced|governed|payload|trigger_event)\b/i)
  })
})

describe('the line above the list', () => {
  it('counts how many working approvals have a flow turned on', () => {
    const points = [point({ workflows: [flow()] }), point({ key: 'b', workflows: [] }), point({ key: 'c', workflows: [flow({ status: 'draft' })] })]
    assert.equal(approvalsSummary(points, null), '1 of 3 approvals have a flow turned on.')
    assert.equal(approvalsSummary(points, 'HRMS'), '1 of 3 approvals in HRMS have a flow turned on.')
  })

  it('agrees the verb with the number of approvals: "has" for one, "have" for more', () => {
    assert.equal(approvalsSummary([point({ workflows: [flow()] }), point({ key: 'b', workflows: [flow()] })], null), '2 of 2 approvals have a flow turned on.')
    assert.equal(approvalsSummary([point({ workflows: [] })], null), '0 of 1 approval has a flow turned on.')
  })

  it('says how many more cannot be used yet, and does not count them as missing a flow', () => {
    const points = [point({ workflows: [flow()] }), point({ key: 'b', enforced: false }), point({ key: 'c', enforced: false })]
    assert.equal(approvalsSummary(points, null), '1 of 1 approval has a flow turned on. 2 more can be set up, but nothing uses them yet.')
  })

  it('says so when nothing is in use at all, and is empty when there is no approval', () => {
    assert.equal(approvalsSummary([point({ enforced: false })], 'Talent'), '1 approval in Talent can be set up, but nothing uses it yet.')
    assert.equal(approvalsSummary([], 'Sales & Marketing'), '')
  })

  it('has a plural helper that does not guess', () => {
    assert.equal(plural(1, 'step'), 'step')
    assert.equal(plural(0, 'step'), 'steps')
    assert.equal(plural(2, 'hour'), 'hours')
  })
})

describe('the condition of a flow', () => {
  it('reads what the engine reads: value, operator, number, joined by AND, any case', () => {
    assert.deepEqual(parseCondition('leave_days > 5'), [{ field: 'leave_days', op: '>', value: '5' }])
    assert.deepEqual(parseCondition('leave_days>=5 and leave_type_id = 3'), [
      { field: 'leave_days', op: '>=', value: '5' },
      { field: 'leave_type_id', op: '=', value: '3' },
    ])
    assert.deepEqual(parseCondition('a <= 2.5 AND b != -1 AND c < .5'), [
      { field: 'a', op: '<=', value: '2.5' },
      { field: 'b', op: '!=', value: '-1' },
      { field: 'c', op: '<', value: '.5' },
    ])
  })

  it('reads an empty condition as no rows, and anything else the engine would not read as null', () => {
    assert.deepEqual(parseCondition(''), [])
    assert.deepEqual(parseCondition('   '), [])
    for (const text of ['leave_days', 'leave_days > many', '> 5', 'a > 5 OR b > 6', '(a > 5)', 'a == 5', 'a > 5 AND', 'leave days > 5', 'a > 5 > 6']) {
      assert.equal(parseCondition(text), null, text)
    }
  })

  it('round-trips: the text the rows make is what parses back to the same rows', () => {
    const rows = parseCondition('leave_days > 5 AND leave_type_id = 3')!
    assert.equal(formatCondition(rows), 'leave_days > 5 AND leave_type_id = 3')
    assert.deepEqual(parseCondition(formatCondition(rows)), rows)
    assert.equal(formatCondition([]), '')
  })

  it('says a condition in words, with the operators a person says', () => {
    assert.equal(describeCondition('leave_days > 5'), 'leave_days is more than 5')
    assert.equal(describeCondition('a >= 1 AND b <= 2 AND c < 3 AND d = 4 AND e != 5'), 'a is at least 1 and b is at most 2 and c is less than 3 and d is 4 and e is not 5')
    assert.equal(describeCondition('days is big'), 'days is big', 'text the rows cannot show comes back as typed')
  })

  it('checks a row before Save: a name and a number', () => {
    assert.deepEqual(conditionRowErrors({ field: 'leave_days', op: '>', value: '5' }), {})
    assert.match(conditionRowErrors({ field: '', op: '>', value: '5' }).field!, /Name the value/)
    assert.match(conditionRowErrors({ field: 'leave days', op: '>', value: '5' }).field!, /letters, digits and underscores/)
    assert.match(conditionRowErrors({ field: 'a', op: '>', value: 'five' }).value!, /Enter a number/)
    assert.match(conditionRowErrors({ field: 'a', op: '>', value: '' }).value!, /Enter a number/)
  })

  it('warns about text the engine would never apply, and about nothing else', () => {
    assert.equal(conditionWarning({ conditionMode: 'rows', conditionText: 'nonsense' }), null)
    assert.equal(conditionWarning({ conditionMode: 'text', conditionText: '' }), null)
    assert.equal(conditionWarning({ conditionMode: 'text', conditionText: 'a > 5' }), null)
    assert.match(conditionWarning({ conditionMode: 'text', conditionText: 'a > 5 OR b > 6' })!, /never apply/)
  })
})

describe('the sentences about a flow', () => {
  it('says the steps, the longest wait and the condition', () => {
    assert.equal(flowSentence({ step_count: 2, total_sla_hours: 72, condition: 'leave_days > 5' }), '2 steps, up to 72 hours. Applies when leave_days is more than 5.')
    assert.equal(flowSentence({ step_count: 1, total_sla_hours: 1, condition: '' }), '1 step, up to 1 hour. Applies to every request.')
    assert.equal(flowSentence({ step_count: 3, total_sla_hours: 0, condition: '  ' }), '3 steps. Applies to every request.')
    assert.equal(flowSentence({ step_count: 1, total_sla_hours: 2160, condition: '' }), '1 step, up to 2,160 hours. Applies to every request.')
  })

  it('explains a draft, an Off flow and a shadowed flow in plain words, and says nothing for a flow that is in use or has a condition', () => {
    assert.match(flowNote(flow({ status: 'draft' }))!, /Saved for later/)
    assert.match(flowNote(flow({ status: 'disabled' }))!, /Switched off/)
    assert.match(flowNote(flow({ status: 'active', effective: false }))!, /earlier flow/)
    assert.equal(flowNote(flow({ status: 'active', effective: true })), null)
    assert.equal(flowNote(flow({ status: 'active', effective: false, condition: 'a > 1' })), null, 'a flow with a condition cannot be judged without a request')
  })

  it('never repeats the server\'s own reason, which speaks of chains and fallbacks', () => {
    const note = flowNote(flow({ status: 'active', effective: false, ineffective_reason: 'Another unconditional chain, saved earlier, is the fallback for this point instead.' })) ?? ''
    assert.doesNotMatch(note, /chain|fallback|point/i)
  })
})

describe('the answer of "which flow would apply"', () => {
  it('names the flow, its steps and its longest wait when one would apply', () => {
    assert.equal(previewSummary({ matched: true, reason: 'selected', workflow: flow({ name: 'Long leave', step_count: 2, total_sla_hours: 72 }) }), '“Long leave” would apply: 2 steps, up to 72 hours.')
  })

  it('says why none would, with no code from the server in it', () => {
    for (const reason of ['no_active_chain', 'no_matching_chain', 'not_installed', 'something_new']) {
      const text = previewSummary({ matched: false, reason, workflow: null })
      assert.match(text, /^No saved flow would apply\. /)
      assert.doesNotMatch(text, /_|chain|point/i, reason)
    }
    assert.match(previewSummary({ matched: false, reason: 'no_active_chain', workflow: null }), /No flow is turned on/)
    assert.match(previewSummary({ matched: false, reason: 'no_matching_chain', workflow: null }), /match these values/)
  })

  it('sends only a named value with a number, as it always did', () => {
    assert.deepEqual(previewContext([{ field: ' leave_days ', value: '7' }, { field: '', value: '3' }, { field: 'x', value: '' }, { field: 'y', value: 'abc' }, { field: 'z', value: '0' }]), { leave_days: 7, z: 0 })
  })
})

describe('the modules', () => {
  it('orders the modules that have an approval by the registry, then any it does not list', () => {
    const modules = [
      { key: 'hrms', label: 'HRMS', description: '', icon: '' },
      { key: 'talent', label: 'Talent', description: '', icon: '' },
      { key: 'lms', label: 'Learning', description: '', icon: '' },
    ]
    assert.deepEqual(orderedModuleKeys([{ module: 'talent' }, { module: 'mystery' }, { module: 'hrms' }, { module: 'hrms' }], modules), ['hrms', 'talent', 'mystery'])
  })
})

describe('the form', () => {
  it('opens a new flow as a draft, named after the approval, with that approval\'s suggested steps, and nothing typed', () => {
    const form = newFlowForm(point())
    assert.equal(form.status, 'draft')
    assert.equal(form.name, 'Leave approval')
    assert.equal(form.id, null)
    assert.deepEqual(form.steps.map((s) => s.name), ['Reporting manager', 'HR'])
    assert.equal(form.conditionMode, 'rows')
    assert.deepEqual(form.conditionRows, [])
    assert.equal(form.onReject, 'return_to_requester')
    assert.equal(form.notifyRequester, true)
    assert.equal(isFlowFormDirty(form, newFlowForm(point())), false)
  })

  it('opens a new flow with one empty step when the approval suggests none', () => {
    const form = newFlowForm(point({ suggested_steps: [] }))
    assert.equal(form.steps.length, 1)
    assert.deepEqual(form.steps[0], emptyStep())
  })

  it('opens a stored flow with its condition as rows when it fits them, and as text when it does not', () => {
    const rows = editFlowForm(flow({ condition: 'leave_days > 5' }))
    assert.equal(rows.conditionMode, 'rows')
    assert.deepEqual(rows.conditionRows, [{ field: 'leave_days', op: '>', value: '5' }])
    const text = editFlowForm(flow({ condition: 'a > 1 OR b > 2' }))
    assert.equal(text.conditionMode, 'text')
    assert.equal(text.conditionText, 'a > 1 OR b > 2')
    assert.equal(flowPayload(text).condition, 'a > 1 OR b > 2', 'saved exactly as it was written')
  })

  it('sends the same keys the screen has always sent', () => {
    assert.deepEqual(Object.keys(flowPayload(newFlowForm(point()))), ['flow_key', 'name', 'description', 'condition', 'status', 'steps', 'on_reject', 'notify_requester'])
    assert.equal(flowPayload(newFlowForm(point())).flow_key, 'hrms.leave.approval')
  })

  it('counts a change to anything that would be saved as dirty, and nothing else', () => {
    const opened = editFlowForm(flow({ condition: 'leave_days > 5' }))
    assert.equal(isFlowFormDirty(opened, editFlowForm(flow({ condition: 'leave_days > 5' }))), false)
    assert.equal(isFlowFormDirty(opened, { ...opened, name: 'Other' }), true)
    assert.equal(isFlowFormDirty(opened, { ...opened, status: 'disabled' }), true)
    assert.equal(isFlowFormDirty(opened, { ...opened, conditionRows: [{ field: 'leave_days', op: '>', value: '6' }] }), true)
    assert.equal(isFlowFormDirty(opened, { ...opened, steps: [...opened.steps, emptyStep()] }), true)
    assert.equal(isFlowFormDirty(opened, { ...opened, conditionMode: 'text', conditionText: 'leave_days > 5' }), false, 'the same condition written the other way is no change')
  })
})

describe('checking a flow before Save', () => {
  it('passes the suggested steps as a draft and as On', () => {
    const form = newFlowForm(point())
    assert.equal(hasFlowFormErrors(validateFlowForm(form, CONTEXT)), false)
    assert.equal(hasFlowFormErrors(validateFlowForm({ ...form, status: 'active' }, CONTEXT)), false)
  })

  it('refuses On at an approval nothing reads yet, with a sentence about what to do, unless the flow was already On', () => {
    const form = { ...newFlowForm(point({ enforced: false })), status: 'active' as const }
    const errors = validateFlowForm(form, { ...CONTEXT, enforced: false })
    assert.match(errors.status!, /cannot be turned on here\. Save it as a draft instead\./)
    assert.equal(validateFlowForm({ ...form, wasOn: true }, { ...CONTEXT, enforced: false }).status, undefined, 'the server lets an On flow be edited and turned off')
    assert.equal(validateFlowForm({ ...form, status: 'draft' }, { ...CONTEXT, enforced: false }).status, undefined)
  })

  it('refuses On with no step, and more than 12 steps', () => {
    const none = { ...newFlowForm(point()), steps: [], status: 'active' as const }
    assert.match(validateFlowForm(none, CONTEXT).steps!, /Add at least one step/)
    assert.equal(validateFlowForm({ ...none, status: 'draft' }, CONTEXT).steps, undefined, 'a draft may be empty')
    const many = { ...newFlowForm(point()), steps: Array.from({ length: 13 }, () => ({ ...emptyStep(), name: 'x' })) }
    assert.match(validateFlowForm(many, CONTEXT).steps!, /at most 12 steps/)
  })

  it('checks each step: a name, the person or role where one is needed, and a wait the server accepts', () => {
    assert.deepEqual(stepErrors({ ...emptyStep(), name: 'Manager' }, APPROVER_TYPES), {})
    assert.match(stepErrors({ ...emptyStep(), name: '  ' }, APPROVER_TYPES).name!, /Name this step/)
    assert.match(stepErrors({ ...emptyStep(), name: 'x'.repeat(121) }, APPROVER_TYPES).name!, /120 characters/)
    assert.match(stepErrors({ ...emptyStep(), name: 'HR', approver_type: 'role' }, APPROVER_TYPES).approver!, /Name the role/)
    assert.match(stepErrors({ ...emptyStep(), name: 'Ann', approver_type: 'user' }, APPROVER_TYPES).approver!, /id of the person/)
    assert.deepEqual(stepErrors({ ...emptyStep(), name: 'HR', approver_type: 'role', approver: 'hr_manager' }, APPROVER_TYPES), {})
    assert.match(stepErrors({ ...emptyStep(), name: 'a', sla_hours: 2161 }, APPROVER_TYPES).sla!, /0 to 2,160/)
    assert.match(stepErrors({ ...emptyStep(), name: 'a', sla_hours: -1 }, APPROVER_TYPES).sla!, /whole number/)
    assert.match(stepErrors({ ...emptyStep(), name: 'a', sla_hours: 1.5 }, APPROVER_TYPES).sla!, /whole number/)
  })

  it('says a breach action needs a time, next to the step, as the editor always did', () => {
    assert.equal(breachNeedsTime('remind', 0), true)
    assert.equal(breachNeedsTime('none', 0), false)
    assert.equal(breachNeedsTime('escalate', 24), false)
    assert.match(stepErrors({ ...emptyStep(), name: 'a', sla_hours: 0, on_breach: 'escalate' }, APPROVER_TYPES).breach!, /Set a time above/)
  })

  it('reports a bad condition row, one entry for each row, only while the rows are the way the condition is written', () => {
    const form = { ...newFlowForm(point()), conditionRows: [{ field: 'leave_days', op: '>' as const, value: '5' }, { field: '', op: '=' as const, value: 'x' }] }
    const errors = validateFlowForm(form, CONTEXT)
    assert.deepEqual(errors.conditionRows[0], {})
    assert.ok(errors.conditionRows[1].field && errors.conditionRows[1].value)
    assert.equal(hasFlowFormErrors(errors), true)
    assert.deepEqual(validateFlowForm({ ...form, conditionMode: 'text', conditionText: 'a > 1' }, CONTEXT).conditionRows, [])
  })
})
