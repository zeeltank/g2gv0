import assert from 'node:assert/strict'
import { test } from 'node:test'

import { collectSuggestions, resolveEntity } from './resolve'
import type { EntityContext, EntityMatch, EntityProvider } from './types'

const ctx: EntityContext<null> = { pathname: '/things', menuId: 1, moduleKey: null, app: null }
const match = (id: string): EntityMatch => ({ id, title: `T${id}`, details: [] })

function provider(over: Partial<EntityProvider<null>> & { found?: EntityMatch[] }): EntityProvider<null> {
  return {
    key: 'things',
    noun: 'things',
    appliesTo: () => true,
    parse: (message) => (message.includes('thing') ? { terms: { q: 'x' }, summary: 'things for x' } : null),
    search: async () => over.found ?? [],
    open: (m) => ({ kind: 'navigate', href: `/things/${m.id}` }),
    ...over,
  }
}

test('a sentence that is not about these records is left alone', async () => {
  assert.equal(await resolveEntity('how is the weather', [provider({})], ctx), null)
})

test('exactly one match is "one" - to be opened', async () => {
  const out = await resolveEntity('show thing', [provider({ found: [match('1')] })], ctx)
  assert.equal(out?.kind, 'one')
})

test('several matches are ALL returned and none is chosen for the user', async () => {
  const out = await resolveEntity('show thing', [provider({ found: [match('1'), match('2'), match('3')] })], ctx)
  assert.equal(out?.kind, 'many')
  assert.equal(out?.kind === 'many' ? out.matches.length : 0, 3)
})

test('no match says so', async () => {
  assert.equal((await resolveEntity('show thing', [provider({ found: [] })], ctx))?.kind, 'none')
})

test('the same record twice is one record, so it opens directly', async () => {
  assert.equal((await resolveEntity('show thing', [provider({ found: [match('1'), match('1')] })], ctx))?.kind, 'one')
})

test('a provider can ask a question back instead of guessing', async () => {
  const out = await resolveEntity('show thing', [provider({ parse: () => ({ question: 'Whose?', choices: [{ label: 'A', message: 'show thing a' }] }) })], ctx)
  assert.equal(out?.kind, 'clarify')
})

test('providers that do not apply here are never consulted', async () => {
  let called = false
  const out = await resolveEntity('show thing', [provider({ appliesTo: () => false, parse: () => { called = true; return null } })], ctx)
  assert.equal(out, null)
  assert.equal(called, false)
})

test('the first provider that recognises the sentence owns it', async () => {
  let secondSearched = false
  const first = provider({ key: 'a', found: [match('1')] })
  const second = provider({ key: 'b', search: async () => { secondSearched = true; return [match('9')] } })
  const out = await resolveEntity('show thing', [first, second], ctx)
  assert.equal(out?.providerKey, 'a')
  assert.equal(secondSearched, false)
})

test('a failing search is reported as an error with its reason, never as "no match"', async () => {
  const out = await resolveEntity('show thing', [provider({ search: async () => { throw new Error('Forbidden') } })], ctx)
  assert.equal(out?.kind, 'error')
  assert.equal(out?.kind === 'error' ? out.message : '', 'Forbidden')
})

test('suggestions come only from providers that apply, deduplicated and capped', async () => {
  const a = provider({ suggestions: async () => ['one', 'two', 'two'] })
  const b = provider({ appliesTo: () => false, suggestions: async () => ['hidden'] })
  const c = provider({ suggestions: async () => { throw new Error('x') } })
  assert.deepEqual(await collectSuggestions([a, b, c], ctx, 6), ['one', 'two'])
  assert.deepEqual(await collectSuggestions([a], ctx, 1), ['one'])
})
