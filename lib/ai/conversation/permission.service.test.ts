import test from 'node:test'
import assert from 'node:assert/strict'
import { validateConversationPermission, getAllowedToolNames } from './permission.service'

const intent = { requiredPermission: 'assistant:module-data:read' } as never
const user = (role?: string) => ({ role }) as never

test('administrator (a role_key) may read module data', () => {
  assert.doesNotThrow(() => validateConversationPermission(intent, user('administrator')))
})

test('every role key may read module data; a missing role may not', () => {
  for (const r of ['employee', 'hr_manager', 'hr_executive', 'department_head', 'reporting_manager', 'executive', 'auditor', 'recruiter', 'admin']) {
    assert.doesNotThrow(() => validateConversationPermission(intent, user(r)), r)
  }
  assert.throws(() => validateConversationPermission(intent, user(undefined)))
})

test('employee-level roles do not get reporting or admin-only permissions', () => {
  const reports = { requiredPermission: 'attendance:reports:read' } as never
  assert.throws(() => validateConversationPermission(reports, user('auditor')))
  assert.doesNotThrow(() => validateConversationPermission(reports, user('hr_manager')))
  assert.ok(getAllowedToolNames(user('administrator')).includes('getModuleData'))
})
