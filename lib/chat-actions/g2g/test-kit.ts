/** Small helpers shared by the chat-action unit tests. Not imported by application code. */

import assert from 'node:assert/strict'

import type { ActionContext, ActionLabels, ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'

export const laravel = {
  token: 'tok', subInstituteId: '1', syear: '2026', userId: '7', organizationId: '1', orgType: 'x', profileId: '1',
}

export const at = (pathname: string, menuId: number | null = 13): ActionContext<G2gActionApp> => ({
  pathname, menuId, moduleKey: null, snapshot: null, app: { laravel },
})

export type Ledger = Array<{ moduleKey: string; entry: Record<string, unknown> }>

export function ledger() {
  const rows: Ledger = []

  return { rows, record: async (moduleKey: string, entry: Record<string, unknown>) => { rows.push({ moduleKey, entry }); return true } }
}

/** A definition is offered on its page(s) only, and only to a page resolved from the user's own menu. */
export function assertAppliesTo(definition: ChatActionDefinition<G2gActionApp>, pages: string[], elsewhere: string[]) {
  for (const page of pages) {
    assert.equal(definition.appliesTo(at(page)), true, `${definition.key} on ${page}`)
    assert.equal(definition.appliesTo(at(`${page}/42`)), true, `${definition.key} on ${page}/42`)
    assert.equal(definition.appliesTo(at(page, null)), false, `${definition.key} with menuId null`)
    assert.equal(definition.appliesTo(at(`${page}-old`)), false, `${definition.key} not on a sibling prefix`)
  }
  for (const page of elsewhere) assert.equal(definition.appliesTo(at(page)), false, `${definition.key} not on ${page}`)
}

export function assertWriteDefinition(definition: ChatActionDefinition<G2gActionApp>) {
  assert.equal(definition.risk, 'write')
  assert.ok(definition.phrases.length > 0)
  assert.ok(definition.phrases.every((phrase) => phrase === phrase.toLowerCase()))
  assert.equal(typeof definition.verify, 'function', `${definition.key} must read its result back`)
}

export function previewOf(
  definition: ChatActionDefinition<G2gActionApp>,
  values: Record<string, string>,
  context: ActionContext<G2gActionApp>,
  labels: ActionLabels = {},
) {
  return definition.preview(values, context, labels)
}

export const lineMap = (preview: { lines: Array<{ label: string; value: string }> }) =>
  Object.fromEntries(preview.lines.map((line) => [line.label, line.value]))
