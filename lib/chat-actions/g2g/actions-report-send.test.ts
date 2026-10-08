import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as flow from '../flow'
import { splitMulti, type ActionContext } from '../types'
import type { G2gActionApp } from './actions'
import { sendReportAction, type SendReportDeps } from './actions-report-send'

const laravel = { token: 't', subInstituteId: '1', syear: '2026', userId: '7', organizationId: '1', orgType: 'x', profileId: '1' }
const context = (moduleKey: string | null, menuId: number | null = 5): ActionContext<G2gActionApp> => ({
  pathname: '/module/lms', menuId, moduleKey, snapshot: null, app: { laravel },
})

function deps(overrides: Partial<SendReportDeps> = {}) {
  const calls = { reportsFor: [] as string[], sent: [] as unknown[], recorded: [] as unknown[] }
  const value: SendReportDeps = {
    listReports: async (m) => { calls.reportsFor.push(m); return [{ id: 12, title: 'Course status', module_key: m, row_count: 3, created_at: '2026-10-08', url_path: '/ai/reports/12' }] },
    listRecipients: async () => [
      { id: 28, name: 'Asha Rao', email: 'asha@org.test', role: null, department: null },
      { id: 29, name: 'Ben Roy', email: 'ben@org.test', role: null, department: null },
    ],
    sendReport: async (reportId, ids, options) => {
      calls.sent.push({ reportId, ids, options })
      return {
        report_id: reportId, title: 'Course status', sent: ids.length, failed: 0, duplicate: 0,
        results: ids.map((id) => ({ recipient_user_id: id, name: `U${id}`, email: `u${id}@x.test`, status: 'sent' as const, error: null })),
      }
    },
    listDeliveries: async () => [28, 29].map((id) => ({
      id, recipient_user_id: id, recipient_name: null, recipient_email: 'x@y.test', status: 'sent' as const, error: null, sent_by: 1, sent_at: 'now', created_at: 'now',
    })),
    newRequestKey: () => 'key-1',
    record: async (_m, entry) => { calls.recorded.push(entry); return true },
    ...overrides,
  }
  return { value, calls }
}

const values = { report: '12', recipients: '28,29', note: 'FYI' }

test('offered only inside a module, on a page from the user’s own menu', () => {
  const action = sendReportAction(deps().value)
  assert.equal(action.appliesTo(context('lms')), true)
  assert.equal(action.appliesTo(context(null)), false)
  assert.equal(action.appliesTo(context('lms', null)), false)
})

test('reports are read live for THIS module; recipients come from the backend list', async () => {
  const d = deps()
  const action = sendReportAction(d.value)
  const reports = await action.inputs.find((i) => i.key === 'report')!.options!(context('lms'))
  assert.deepEqual(d.calls.reportsFor, ['lms'])
  assert.equal(reports.some((o) => o.value === '12'), true)
  const people = await action.inputs.find((i) => i.key === 'recipients')!.options!(context('lms'))
  assert.deepEqual(people.map((p) => p.value), ['28', '29'])
  assert.equal(action.inputs.find((i) => i.key === 'recipients')!.type, 'multiselect')
})

test('validation: report, at least one numeric recipient, cap', () => {
  const action = sendReportAction(deps().value)
  assert.ok(action.validate!({ report: '', recipients: '28' }).report)
  assert.ok(action.validate!({ report: '12', recipients: '' }).recipients)
  assert.ok(action.validate!({ report: '12', recipients: 'a@b.c' }).recipients)
  assert.ok(action.validate!({ report: '12', recipients: Array.from({ length: 21 }, (_, i) => i + 1).join(',') }).recipients)
  assert.deepEqual(action.validate!(values), {})
})

test('preview shows the report and every recipient name/email', () => {
  const action = sendReportAction(deps().value)
  const preview = action.preview(values, context('lms'), { report: 'Course status (2026-10-08)', recipients: 'Asha Rao <asha@org.test>\nBen Roy <ben@org.test>' })
  const text = JSON.stringify(preview)
  assert.ok(text.includes('Course status'))
  assert.ok(text.includes('asha@org.test') && text.includes('ben@org.test'))
  assert.ok(preview.warning)
})

test('execute sends once through the flow, only after Confirm, with a request key', async () => {
  const d = deps()
  const action = sendReportAction(d.value)
  const ctx = context('lms')
  let state = flow.start(action, {})
  state = flow.submit(state, action, values, ctx, { report: 'R', recipients: 'A\nB' })
  assert.equal(state.phase, 'confirming')
  assert.equal(d.calls.sent.length, 0, 'nothing is sent before Confirm')
  const result = await action.execute(values, ctx)
  assert.equal(result.ok, true)
  assert.deepEqual(d.calls.sent, [{ reportId: 12, ids: [28, 29], options: { note: 'FYI', requestKey: 'key-1' } }])
  assert.equal(d.calls.recorded.length, 1)
  assert.deepEqual(await action.verify!(values, ctx, result), { ok: true })
})

test('a recipient the transport failed is reported, not hidden', async () => {
  const d = deps({
    sendReport: async () => ({
      report_id: 12, title: 'Course status', sent: 1, failed: 1, duplicate: 0,
      results: [
        { recipient_user_id: 28, name: 'Asha Rao', email: 'a@x.test', status: 'sent', error: null },
        { recipient_user_id: 29, name: 'Ben Roy', email: 'b@x.test', status: 'failed', error: 'SMTP refused' },
      ],
    }),
  })
  const result = await sendReportAction(d.value).execute(values, context('lms'))
  assert.equal(result.ok, false)
  assert.ok(result.message.includes('Ben Roy') && result.message.includes('SMTP refused'))
})

test('the backend refusal is the message', async () => {
  const d = deps({ sendReport: async () => { throw new Error('Sending reports is available to administrators.') } })
  const result = await sendReportAction(d.value).execute(values, context('lms'))
  assert.deepEqual(result, { ok: false, message: 'Sending reports is available to administrators.' })
})

test('verify fails when a chosen recipient has no sent delivery', async () => {
  const d = deps({ listDeliveries: async () => [{ id: 1, recipient_user_id: 28, recipient_name: null, recipient_email: 'a', status: 'sent', error: null, sent_by: 1, sent_at: 'n', created_at: 'n' }] })
  const outcome = await sendReportAction(d.value).verify!(values, context('lms'), { ok: true, message: '' })
  assert.equal(outcome.ok, false)
})

test('splitMulti trims, drops blanks and repeats', () => {
  assert.deepEqual(splitMulti(' 1, 2,,2 ,3'), ['1', '2', '3'])
  assert.deepEqual(splitMulti(undefined), [])
})
