import assert from 'node:assert/strict'
import { test } from 'node:test'

import { asksToNavigate, matchNavTarget, type NavTarget } from './navigation'

const targets: NavTarget[] = [
  { label: 'Department Management', path: '/organization/departments', trail: ['Organization'] },
  { label: 'Leave', path: '/hrms/leave', trail: ['HRMS'] },
  { label: 'Leave Requests', path: '/hrms/leave-requests', trail: ['HRMS'] },
  { label: 'Reports', path: '/a/reports', trail: ['A'] },
  { label: 'Reports', path: '/b/reports', trail: ['B'] },
]

test('only a request to GO somewhere navigates, a question does not', () => {
  assert.equal(asksToNavigate('open the department management page'), true)
  assert.equal(asksToNavigate('how many departments are there'), false)
  assert.equal(matchNavTarget('what is in department management', targets), null)
})

test('the destination is matched against the pages the user can actually see', () => {
  assert.equal(matchNavTarget('open the department management page', targets)?.path, '/organization/departments')
  assert.equal(matchNavTarget('take me to payroll', targets), null)
})

test('the most specific label wins', () => {
  assert.equal(matchNavTarget('go to leave requests', targets)?.path, '/hrms/leave-requests')
  assert.equal(matchNavTarget('go to leave', targets)?.path, '/hrms/leave')
})

test('an ambiguous destination is not guessed', () => {
  assert.equal(matchNavTarget('open reports', targets), null)
})
