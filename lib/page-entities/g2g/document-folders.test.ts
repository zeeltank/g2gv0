import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  descendantIds,
  extensionOf,
  fileKindIn,
  findFoldersByName,
  flattenFolders,
  isFileKind,
  locationOf,
  nameMatches,
  normalizeName,
  type FolderNode,
} from './document-folders'

const tree: FolderNode[] = [
  { id: 1, name: 'Finance', parent_id: null, children: [{ id: 2, name: '2026', parent_id: 1, children: [{ id: 5, name: 'Q1 Reports', parent_id: 2, children: [] }] }] },
  { id: 3, name: 'Artificial  intelligence', parent_id: null, children: [] },
  { id: 4, name: 'ilovepdf_split-range', parent_id: null, children: [] },
  { id: 6, name: 'Finance Archive', parent_id: null, children: [] },
]

test('names are compared the way a person reads them', () => {
  assert.equal(normalizeName('Artificial  intelligence'), 'artificial intelligence')
  assert.equal(normalizeName('C10_2026-27_SSM_Science-33-40'), 'c10 2026 27 ssm science 33 40')
  assert.equal(nameMatches({ title: 'C10_2026-27_SSM_Science-33-40', original_file_name: null }, 'SSM Science 33 40'), true)
  assert.equal(nameMatches({ title: 'Budget', original_file_name: 'budget.xlsx' }, 'budget xlsx'), true)
  assert.equal(nameMatches({ title: 'Budget', original_file_name: null }, 'payroll'), false)
})

test('a folder\'s location is its real path through the tree', () => {
  assert.equal(locationOf(tree, 5), 'Document Library › Finance › 2026 › Q1 Reports')
  assert.equal(locationOf(tree, null), 'Document Library (top level)')
  assert.equal(locationOf(tree, 999), null)
  assert.equal(flattenFolders(tree).find((f) => f.node.id === 3)?.path[0], 'Artificial intelligence')
})

test('a folder and everything beneath it', () => {
  assert.deepEqual(descendantIds(tree, 1).sort(), [1, 2, 5])
  assert.deepEqual(descendantIds(tree, 4), [4])
  assert.deepEqual(descendantIds(tree, 999), [])
})

test('folders by name: exact wins, otherwise every word must fit', () => {
  assert.deepEqual(findFoldersByName(tree, 'finance').map((f) => f.node.id), [1])
  assert.deepEqual(findFoldersByName(tree, 'artificial intelligence').map((f) => f.node.id), [3])
  assert.deepEqual(findFoldersByName(tree, 'ilovepdf split range').map((f) => f.node.id), [4])
  assert.deepEqual(findFoldersByName(tree, 'archive').map((f) => f.node.id), [6])
  assert.deepEqual(findFoldersByName(tree, 'payroll'), [])
  assert.deepEqual(findFoldersByName(tree, ''), [])
})

test('file kinds are read from the sentence and from the real file', () => {
  assert.deepEqual(fileKindIn('open the excel file'), { kind: 'spreadsheet', rest: 'open the file' })
  assert.equal(fileKindIn('show the pdf')?.kind, 'pdf')
  assert.equal(fileKindIn('open the word document')?.kind, 'word')
  assert.equal(fileKindIn('open the budget'), null)
  assert.equal(extensionOf('Budget.XLSX'), 'xlsx')
  assert.equal(extensionOf(null), '')
  assert.equal(isFileKind({ original_file_name: 'a.csv' }, 'spreadsheet'), true)
  assert.equal(isFileKind({ original_file_name: 'a', mime_type: 'application/pdf' }, 'pdf'), true)
  assert.equal(isFileKind({ original_file_name: 'a.pdf' }, 'spreadsheet'), false)
})
