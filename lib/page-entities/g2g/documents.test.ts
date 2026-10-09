import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveEntity } from '../resolve'
import {
  DOCUMENT_LIBRARY_PAGE,
  documentLibraryProvider,
  OPEN_DOCUMENT_EVENT,
  parseDocumentRequest,
  type DocumentHit,
  type DocumentProviderDeps,
  type DocumentSearchResult,
  type G2gEntityApp,
} from './documents'

const types = [
  { key: 'resume', label: 'Resume' },
  { key: 'payslip', label: 'Payslip' },
  { key: 'form_16', label: 'Form 16' },
]
const laravel = { token: 't', subInstituteId: '1', syear: '2026', userId: '7', organizationId: '1', orgType: 'x', profileId: '1' }
const ctx = (pathname = DOCUMENT_LIBRARY_PAGE) => ({ pathname, menuId: 9, moduleKey: null, app: { laravel } as G2gEntityApp })

const hit = (id: number, over: Partial<DocumentHit> = {}): DocumentHit => ({
  id, title: `Doc ${id}`, original_file_name: `doc${id}.pdf`, document_type: 'resume', document_date: '2026-08-12',
  created_at: '2026-08-12 10:00:00', visibility: 'private', owner_id: 3, owner_name: 'Rahul Patel', ...over,
})
const result = (data: DocumentHit[]): DocumentSearchResult => ({
  data, meta: { total: data.length }, document_types: { personnel: { resume: 'Resume', payslip: 'Payslip', form_16: 'Form 16' }, organization: {} },
})

function deps(respond: (filters: Record<string, unknown>) => DocumentHit[]) {
  const calls: Array<Record<string, unknown>> = []
  const value: DocumentProviderDeps = { search: async (_ctx, filters) => { calls.push(filters); return result(respond(filters)) } }
  return { value, calls }
}

// ---- reading the sentence ---------------------------------------------------------------

test('a person named with a possessive or a preposition', () => {
  assert.equal((parseDocumentRequest("Show me Rahul Patel's documents", types) as { terms: Record<string, string> }).terms.owner_name, 'Rahul Patel')
  assert.equal((parseDocumentRequest('show documents for Rahul Patel', types) as { terms: Record<string, string> }).terms.owner_name, 'Rahul Patel')
  assert.equal((parseDocumentRequest('find the documents of Rahul Patel please', types) as { terms: Record<string, string> }).terms.owner_name, 'Rahul Patel')
})

test('"show me X\'s documents" is about X - the word "me" does not make it "mine"', () => {
  const t = (parseDocumentRequest("Show me kalpesh sheth1's documents", types) as { terms: Record<string, string> }).terms
  assert.equal(t.owner_name, 'kalpesh sheth1')
  assert.equal(t.mine, undefined)
  const plain = (parseDocumentRequest('show me documents for Rahul Patel', types) as { terms: Record<string, string> }).terms
  assert.equal(plain.owner_name, 'Rahul Patel')
  assert.equal(plain.mine, undefined)
})

test('"for me" and "my" are the signed-in user', () => {
  assert.equal((parseDocumentRequest('find documents for me', types) as { terms: Record<string, string> }).terms.mine, '1')
  assert.equal((parseDocumentRequest('show my documents', types) as { terms: Record<string, string> }).terms.mine, '1')
})

test('"this user" names no one, so the chat asks instead of guessing', () => {
  assert.deepEqual(parseDocumentRequest("Show me this user's document", types), { kind: 'who' })
  assert.deepEqual(parseDocumentRequest('open her documents', types), { kind: 'who' })
})

test('a document type from the library itself, alone or with a person or "mine"', () => {
  const t = (parseDocumentRequest("show Rahul Patel's resume", types) as { terms: Record<string, string> }).terms
  assert.equal(t.document_type, 'resume')
  assert.equal(t.owner_name, 'Rahul Patel')
  const mine = (parseDocumentRequest('show my payslip', types) as { terms: Record<string, string> }).terms
  assert.equal(mine.document_type, 'payslip')
  assert.equal(mine.mine, '1')
})

test('content and title searches', () => {
  assert.equal((parseDocumentRequest('find documents that mention project plan', types) as { terms: Record<string, string> }).terms.q, 'project plan')
  assert.equal((parseDocumentRequest('open the document Design_System_Project', types) as { terms: Record<string, string> }).terms.q, 'Design_System_Project')
})

test('a plain "open <name>" on this page asks for a document', () => {
  const t = (parseDocumentRequest('open Finance_Chatbot_Project', types) as { terms: Record<string, string> }).terms
  assert.equal(t.q, 'Finance_Chatbot_Project')
  assert.equal((parseDocumentRequest('open artificial intelligence', types) as { terms: Record<string, string> }).terms.q, 'artificial intelligence')
})

test('but never a question, or a request for a page, menu or tab', () => {
  assert.equal(parseDocumentRequest('open the leave requests page', types), null)
  assert.equal(parseDocumentRequest('open the settings menu', types), null)
  assert.equal(parseDocumentRequest('open what changed this week?', types), null)
  assert.equal(parseDocumentRequest('show me the summary', types), null)
})

test('a question about documents is not a request to fetch one', () => {
  assert.equal(parseDocumentRequest('How many documents are there?', types), null)
  assert.equal(parseDocumentRequest('what is the weather', types), null)
  assert.equal(parseDocumentRequest('show me leave requests', types), null)
})

// ---- the whole lookup -------------------------------------------------------------------

test('several documents for one person: ALL are listed, none is opened', async () => {
  const d = deps(() => [hit(1, { title: 'Resume' }), hit(2, { title: 'Experience Letter', document_type: 'form_16' }), hit(3, { title: 'ID Proof' })])
  const out = await resolveEntity("Show me Rahul Patel's documents", [documentLibraryProvider(d.value)], ctx())
  assert.equal(out?.kind, 'many')
  const matches = out?.kind === 'many' ? out.matches : []
  assert.equal(matches.length, 3)
  assert.equal(matches[0].subtitle, 'Rahul Patel')
  assert.ok(matches[0].details.some((detail) => detail.label === 'Type' && detail.value === 'Resume'))
  // the person was searched by NAME against the real API, not matched client-side
  assert.equal(d.calls.at(-1)?.owner_name, 'Rahul Patel')
})

test('exactly one document opens directly', async () => {
  const out = await resolveEntity("show Rahul Patel's resume", [documentLibraryProvider(deps(() => [hit(5)]).value)], ctx())
  assert.equal(out?.kind, 'one')
})

test('no document says so', async () => {
  const out = await resolveEntity('show documents for Nobody Here', [documentLibraryProvider(deps(() => []).value)], ctx())
  assert.equal(out?.kind, 'none')
})

test('"my documents" asks for the signed-in user\'s own, by id from the session', async () => {
  const d = deps(() => [hit(1, { owner_id: 7 })])
  await resolveEntity('show my documents', [documentLibraryProvider(d.value)], ctx())
  assert.equal(d.calls.at(-1)?.owner_id, 7)
})

test('nothing matches the whole phrase: documents with SOME of the words are listed, never opened', async () => {
  const d = deps((filters) => {
    if (filters.q === 'artificial') return [hit(1, { title: 'Science notes' }), hit(2, { title: 'Other' })]
    if (filters.q === 'intelligence') return [hit(2, { title: 'Other' }), hit(3, { title: 'LMS plan' })]
    return []
  })
  const out = await resolveEntity('open artificial intelligence document', [documentLibraryProvider(d.value)], ctx())
  assert.equal(out?.kind, 'similar')
  const matches = out?.kind === 'similar' ? out.matches : []
  assert.deepEqual(matches.map((m) => m.id), ['2', '3', '1'])
  assert.deepEqual(matches[0].details[0], { label: 'Contains', value: 'artificial, intelligence' })
})

test('a single partial match is still only offered, not opened', async () => {
  const d = deps((filters) => (filters.q === 'artificial' ? [hit(9)] : []))
  const out = await resolveEntity('open artificial intelligence document', [documentLibraryProvider(d.value)], ctx())
  assert.equal(out?.kind, 'similar')
})

test('a one-word request has no partial matches to offer', async () => {
  const out = await resolveEntity('open payroll document', [documentLibraryProvider(deps(() => []).value)], ctx())
  assert.equal(out?.kind, 'none')
})

test('a name that is no person falls back to a title search', async () => {
  const d = deps((filters) => (filters.q === 'Triz Website Project' ? [hit(8, { title: 'Triz_Website_Project' })] : []))
  const out = await resolveEntity('show documents for Triz Website Project', [documentLibraryProvider(d.value)], ctx())
  assert.equal(out?.kind, 'one')
})

test('"this user" gets a question back with real owners to pick from', async () => {
  const d = deps(() => [hit(1, { owner_name: 'Anita Rao' }), hit(2, { owner_name: 'Vikram Shah' }), hit(3, { owner_name: 'Anita Rao' })])
  const out = await resolveEntity("show me this user's document", [documentLibraryProvider(d.value)], ctx())
  assert.equal(out?.kind, 'clarify')
  assert.deepEqual(out?.kind === 'clarify' ? out.clarify.choices.map((choice) => choice.message) : [], ['Show documents for Anita Rao', 'Show documents for Vikram Shah'])
})

test('a failing API is an error with its reason, not "no documents"', async () => {
  const failing: DocumentProviderDeps = { search: async () => { throw new Error('Unauthorized') } }
  const out = await resolveEntity('show my documents', [documentLibraryProvider(failing)], ctx())
  assert.equal(out?.kind, 'error')
})

test('it only applies on the Document Library page', async () => {
  const out = await resolveEntity("show Rahul Patel's documents", [documentLibraryProvider(deps(() => [hit(1)]).value)], ctx('/dashboard'))
  assert.equal(out, null)
})

// ---- opening and suggestions -----------------------------------------------------------

test('opening: tells the library which document when already there, else navigates with its id', () => {
  const provider = documentLibraryProvider(deps(() => []).value)
  const m = { id: '12', title: 'x', details: [] }
  assert.deepEqual(provider.open(m, ctx()), { kind: 'event', name: OPEN_DOCUMENT_EVENT, detail: { id: 12 } })
  assert.deepEqual(provider.open(m, ctx('/dashboard')), { kind: 'navigate', href: '/documents?open=12' })
})

test('suggestions are built from the documents that really exist, and each one is understood by the provider', async () => {
  const d = deps(() => [hit(1, { owner_id: 7, owner_name: 'Me Myself', title: 'Latest' }), hit(2, { owner_id: 3, owner_name: 'Rahul Patel', document_type: 'payslip' })])
  const provider = documentLibraryProvider(d.value)
  const suggestions = (await provider.suggestions!(ctx())) ?? []
  assert.ok(suggestions.includes('Show my documents'))
  assert.ok(suggestions.includes('Show documents for Rahul Patel'))
  assert.ok(suggestions.some((s) => s.startsWith('Show Payslip')))
  assert.ok(!suggestions.some((s) => s.includes('Me Myself')))
  for (const suggestion of suggestions) {
    const out = await resolveEntity(suggestion, [documentLibraryProvider(d.value)], ctx())
    assert.notEqual(out, null, `not understood: ${suggestion}`)
  }
})
