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
  assert.ok(suggestions.some((s) => /^Show .+ documents$/.test(s) && !s.startsWith('Show my') && !s.startsWith('Show documents for')))
  assert.ok(!suggestions.some((s) => s.includes('Me Myself')))
  for (const suggestion of suggestions) {
    const out = await resolveEntity(suggestion, [documentLibraryProvider(d.value)], ctx())
    assert.notEqual(out, null, `not understood: ${suggestion}`)
  }
})

// =====================================================================================================
// Folders, locations, file kinds
// =====================================================================================================

import type { FolderNode } from './document-folders'
import { NAVIGATE_FOLDER_EVENT } from './documents'

const tree: FolderNode[] = [
  { id: 1, name: 'Finance', parent_id: null, owner_id: 7, children: [{ id: 2, name: '2026', parent_id: 1, owner_id: 7, children: [] }] },
  { id: 3, name: 'Artificial  intelligence', parent_id: null, owner_id: 9, visibility: 'department', children: [] },
  { id: 4, name: 'ilovepdf_split-range', parent_id: null, owner_id: 7, children: [] },
]

function deps2(respond: (filters: Record<string, unknown>) => DocumentHit[]) {
  const calls: Array<Record<string, unknown>> = []
  const value: DocumentProviderDeps = {
    search: async (_ctx, filters) => { calls.push(filters); return result(respond(filters)) },
    folderTree: async () => tree,
  }
  return { value, calls }
}
const ctxApp = (pathname = DOCUMENT_LIBRARY_PAGE, recent: { id: number; title: string } | null = null) => ({
  pathname, menuId: 9, moduleKey: null, app: { laravel, recent } as G2gEntityApp,
})

test('"where is X" asks for its location, and a single match is revealed, not opened', () => {
  const p = parseDocumentRequest('Where is C10_2026-27_SSM_Science-33-40?', types) as { kind: string; terms: Record<string, string>; onSingle: string }
  assert.equal(p.terms.mode, 'locate')
  assert.equal(p.terms.q, 'C10_2026-27_SSM_Science-33-40')
  assert.equal(p.onSingle, 'reveal')
  assert.equal((parseDocumentRequest('which folder is the budget file in', types) as { terms: Record<string, string> }).terms.q, 'budget')
})

test('"where is this file" names no file', () => {
  assert.deepEqual(parseDocumentRequest('Where is this file?', types), { kind: 'which' })
})

test('opening a folder, by the words people use', () => {
  for (const sentence of ['open the Artificial intelligence folder', 'go to the Artificial intelligence folder', 'show me the Artificial intelligence folder', 'open folder Artificial intelligence']) {
    const p = parseDocumentRequest(sentence, types) as { terms: Record<string, string> }
    assert.equal(p.terms.mode, 'folder', sentence)
    assert.equal(p.terms.folder, 'Artificial intelligence', sentence)
  }
  assert.equal((parseDocumentRequest("what's in the Finance folder", types) as { terms: Record<string, string> }).terms.mode, 'folder')
  assert.equal((parseDocumentRequest('files in the Finance folder', types) as { terms: Record<string, string> }).terms.folder, 'Finance')
})

test('a file inside a named folder is searched only there', () => {
  const t = (parseDocumentRequest('open the budget report in the Finance folder', types) as { terms: Record<string, string> }).terms
  assert.equal(t.mode, 'files')
  assert.equal(t.folder, 'Finance')
  assert.equal(t.q, 'budget report')
})

test('file kinds: "the excel file" is by real extension, not by name', () => {
  const t = (parseDocumentRequest('open the excel file', types) as { terms: Record<string, string> }).terms
  assert.equal(t.fileKind, 'spreadsheet')
  assert.equal(t.q, undefined)
  const inFolder = (parseDocumentRequest('open the excel file in the Finance folder', types) as { terms: Record<string, string> }).terms
  assert.equal(inFolder.fileKind, 'spreadsheet')
  assert.equal(inFolder.folder, 'Finance')
})

test('a folder is found by name the way a person reads it (spacing, underscores)', async () => {
  for (const sentence of ['open the artificial intelligence folder', 'open the ilovepdf split range folder']) {
    const out = await resolveEntity(sentence, [documentLibraryProvider(deps2(() => []).value)], ctxApp())
    assert.equal(out?.kind, 'one', sentence)
  }
  const out = await resolveEntity('open the Artificial intelligence folder', [documentLibraryProvider(deps2(() => []).value)], ctxApp())
  assert.equal(out?.kind === 'one' ? out.match.kind : '', 'folder')
  assert.equal(out?.kind === 'one' ? out.match.location : '', 'Document Library › Artificial intelligence')
})

test('a folder that does not exist says so', async () => {
  const out = await resolveEntity('open the Payroll folder', [documentLibraryProvider(deps2(() => []).value)], ctxApp())
  assert.equal(out?.kind, 'none')
})

test('opening a folder: event when already in the library, else a link with the folder id', () => {
  const provider = documentLibraryProvider(deps2(() => []).value)
  const folder = { id: '3', title: 'x', details: [], kind: 'folder', meta: { folderId: '3', scope: 'visible' } }
  assert.deepEqual(provider.open(folder, ctxApp()), { kind: 'event', name: NAVIGATE_FOLDER_EVENT, detail: { folderId: 3, highlightDocumentId: undefined, scope: 'visible' } })
  assert.deepEqual(provider.open(folder, ctxApp('/dashboard')), { kind: 'navigate', href: '/documents?folder=3&scope=visible' })
})

test('every file says WHERE it is, from the real folder tree', async () => {
  const d = deps2(() => [hit(10, { title: 'Budget', folder_id: 2 }), hit(11, { title: 'Loose file', folder_id: null }), hit(12, { title: 'Hidden', folder_id: 999 }), hit(13, { title: 'Payslip', folder_id: 1, source_system: 'staff_document' })])
  const out = await resolveEntity('show documents for Rahul Patel', [documentLibraryProvider(d.value)], ctxApp())
  const m = out?.kind === 'many' ? out.matches : []
  assert.equal(m.find((x) => x.id === '10')?.location, 'Document Library › Finance › 2026')
  assert.equal(m.find((x) => x.id === '11')?.location, 'Document Library (top level)')
  assert.equal(m.find((x) => x.id === '12')?.revealable, false)
  assert.equal(m.find((x) => x.id === '13')?.location, 'Stored in staff_document')
  assert.equal(m.find((x) => x.id === '13')?.revealable, false)
})

test('"where is X": ONE match is revealed - the folder, with the file highlighted', async () => {
  const d = deps2(() => [hit(10, { title: 'Budget', folder_id: 2, owner_id: 7 })])
  const provider = documentLibraryProvider(d.value)
  const out = await resolveEntity('where is Budget', [provider], ctxApp())
  assert.equal(out?.kind, 'one')
  assert.equal(out?.kind === 'one' ? out.query.onSingle : '', 'reveal')
  const match = out?.kind === 'one' ? out.match : null
  assert.equal(match?.location, 'Document Library › Finance › 2026')
  assert.deepEqual(provider.reveal!(match!, ctxApp()), { kind: 'event', name: NAVIGATE_FOLDER_EVENT, detail: { folderId: 2, highlightDocumentId: 10, scope: 'mine' } })
  assert.deepEqual(provider.reveal!(match!, ctxApp('/dashboard')), { kind: 'navigate', href: '/documents?folder=2&scope=mine&highlight=10' })
})

test('"where is X" for a top-level file reveals the top level', async () => {
  const provider = documentLibraryProvider(deps2(() => [hit(11, { title: 'Loose', folder_id: null, owner_id: 3 })]).value)
  const out = await resolveEntity('where is Loose', [provider], ctxApp())
  const match = out?.kind === 'one' ? out.match : null
  assert.deepEqual(provider.reveal!(match!, ctxApp()), { kind: 'event', name: NAVIGATE_FOLDER_EVENT, detail: { folderId: null, highlightDocumentId: 11, scope: 'visible' } })
})

test('"where is this file" uses the file the chat last opened, or asks with real choices', async () => {
  const d = deps2((filters) => (filters.q ? [hit(10, { title: 'Budget', folder_id: 1 })] : [hit(20, { title: 'First' }), hit(21, { title: 'Second' })]))
  const known = await resolveEntity('where is this file?', [documentLibraryProvider(d.value)], ctxApp(DOCUMENT_LIBRARY_PAGE, { id: 10, title: 'Budget' }))
  assert.equal(known?.kind, 'one')
  const unknown = await resolveEntity('where is this file?', [documentLibraryProvider(d.value)], ctxApp())
  assert.equal(unknown?.kind, 'clarify')
  assert.deepEqual(unknown?.kind === 'clarify' ? unknown.clarify.choices.map((c) => c.message) : [], ['Where is First?', 'Where is Second?'])
})

test('a file inside a folder is searched in that folder and its subfolders only', async () => {
  const d = deps2((filters) => (filters.folder_id === 2 ? [hit(30, { title: 'Budget plan', folder_id: 2 })] : []))
  const out = await resolveEntity('open the budget plan in the Finance folder', [documentLibraryProvider(d.value)], ctxApp())
  assert.equal(out?.kind, 'one')
  const searched = d.calls.map((c) => c.folder_id).filter((id) => id !== undefined)
  assert.deepEqual([...new Set(searched)].sort(), [1, 2])
})

test('a name typed with spaces finds a file named with underscores', async () => {
  const d = deps2((filters) => (filters.q === 'SSM_Science_33' ? [hit(40, { title: 'C10_SSM_Science_33', folder_id: 4 })] : []))
  const out = await resolveEntity('open the SSM Science 33 document', [documentLibraryProvider(d.value)], ctxApp())
  assert.equal(out?.kind, 'one')
})

test('when a document NAME fits, broader content matches are dropped - the exact file opens', async () => {
  const d = deps2(() => [hit(50, { title: 'Budget 2026' }), hit(51, { title: 'Meeting notes' }), hit(52, { title: 'Hiring plan' })])
  const out = await resolveEntity('open Budget 2026', [documentLibraryProvider(d.value)], ctxApp())
  assert.equal(out?.kind, 'one')
  assert.equal(out?.kind === 'one' ? out.match.id : '', '50')
})

test('"the excel file": only spreadsheets, by real extension and mime type', async () => {
  const d = deps2(() => [
    hit(60, { title: 'Budget', original_file_name: 'budget.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    hit(61, { title: 'Report', original_file_name: 'report.pdf', mime_type: 'application/pdf' }),
    hit(62, { title: 'Data', original_file_name: 'data.csv', mime_type: 'text/csv' }),
  ])
  const out = await resolveEntity('show the excel files', [documentLibraryProvider(d.value)], ctxApp())
  assert.equal(out?.kind, 'many')
  assert.deepEqual(out?.kind === 'many' ? out.matches.map((m) => m.id).sort() : [], ['60', '62'])
})

test('suggestions include the real folders and a "where is" question, and each is understood', async () => {
  const d = deps2(() => [hit(1, { owner_id: 7, title: 'Latest', owner_name: 'Me' })])
  const provider = documentLibraryProvider(d.value)
  const suggestions = (await provider.suggestions!(ctxApp())) ?? []
  assert.ok(suggestions.includes('Open the Finance folder'))
  assert.ok(suggestions.includes('Open the Artificial intelligence folder'))
  assert.ok(suggestions.includes('Where is Latest?'))
  for (const suggestion of suggestions) {
    const out = await resolveEntity(suggestion, [documentLibraryProvider(deps2(() => [hit(1, { owner_id: 7, title: 'Latest' })]).value)], ctxApp())
    assert.notEqual(out, null, `not understood: ${suggestion}`)
  }
})

test('every file-type word is removed from the sentence, so none becomes a fake file name', () => {
  const t = (parseDocumentRequest('open the csv spreadsheet', types) as { terms: Record<string, string> }).terms
  assert.equal(t.fileKind, 'spreadsheet')
  assert.equal(t.q, undefined)
})

test('a kind-only request reads the most the API allows before filtering by kind', async () => {
  const d = deps2(() => [hit(70, { original_file_name: 'a.csv', mime_type: 'text/csv' })])
  const out = await resolveEntity('open the csv spreadsheet', [documentLibraryProvider(d.value)], ctxApp())
  assert.equal(out?.kind, 'one')
  assert.equal(d.calls.at(-1)?.per_page, 100)
})

test('folder wording reads correctly when nothing is found', async () => {
  const out = await resolveEntity('open the Payroll folder', [documentLibraryProvider(deps2(() => []).value)], ctxApp())
  assert.equal(out?.kind === 'none' ? out.query.summary : '', 'folders named "Payroll"')
})
