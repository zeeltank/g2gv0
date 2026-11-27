import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { DocumentFolderNode } from '@/services/account'
import { folderOwnedByOthers } from './folder-owner'

const node = (id: number, owner: number | null, children: DocumentFolderNode[] = [], parent: number | null = null): DocumentFolderNode => ({ id, name: `Folder ${id}`, parent_id: parent, owner_id: owner, department_id: null, visibility: 'organization', children })

// Sales Kit (owned by nobody) > ScholarClone; "Mine" owned by user 7; "Theirs" owned by user 9.
const tree: DocumentFolderNode[] = [
  node(1, null, [node(2, null, [], 1)]),
  node(3, 7),
  node(4, 9, [node(5, 9, [], 4)]),
]

describe('folderOwnedByOthers', () => {
  it('is false at the root, so My Drive keeps listing only my own documents there', () => {
    assert.equal(folderOwnedByOthers(tree, null, 7), false)
    assert.equal(folderOwnedByOthers(tree, 0, 7), false)
  })

  it('is false for my own folder and for a folder inside it', () => {
    assert.equal(folderOwnedByOthers(tree, 3, 7), false)
  })

  it('is true for an organisation folder with no owner, at any depth (the Sales Kit folder and its product folder)', () => {
    assert.equal(folderOwnedByOthers(tree, 1, 7), true)
    assert.equal(folderOwnedByOthers(tree, 2, 7), true)
  })

  it('is true for somebody else\'s folder, at any depth', () => {
    assert.equal(folderOwnedByOthers(tree, 4, 7), true)
    assert.equal(folderOwnedByOthers(tree, 5, 7), true)
  })

  it('is false while the folder is not in the tree yet, and when the caller is unknown the folder is not mine', () => {
    assert.equal(folderOwnedByOthers(tree, 99, 7), false)
    assert.equal(folderOwnedByOthers(tree, 3, null), true)
  })
})

describe('the Document Library request', () => {
  const view = readFileSync('components/domain/documents/document-library-view.tsx', 'utf8').replace(/\r\n/g, '\n')

  it('leaves the owner filter off inside a folder that is not mine, and still applies it elsewhere in My Drive', () => {
    assert.match(view, /folderOwnedByOthers\(folderTree, currentFolderId, myId\)/)
    assert.match(view, /owner_id: scope === 'mine' && myId && !inSharedFolder \? myId : undefined/)
  })

  it('re-reads the page when the tree arrives, because whose folder it is comes from the tree', () => {
    const deps = view.slice(view.indexOf('  }, [\n    resolveContext,\n    debouncedQuery,'), view.indexOf('  useEffect(() => {\n    queueMicrotask(() => {\n      void load()'))
    assert.match(deps, /\bfolderTree\b/)
  })
})
