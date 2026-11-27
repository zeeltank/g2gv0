import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_LAYOUT, isLayout, LAYOUT_PARAM, LAYOUT_STORAGE_KEY, LAYOUTS, readRememberedLayout, rememberLayout, resolveLayout, type LayoutStorage } from './layout'
import { readTab, writeTab } from '../../components/shared/scaffolds/url-tab'

/** The List | Grid choice: what the address names, what the browser remembers, and the list when neither says. */

const memory = (initial: Record<string, string> = {}): LayoutStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value } }
}
const refusing: LayoutStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }

describe('which layout is drawn', () => {
  it('keeps the list as the default, and offers exactly the list and the grid', () => {
    assert.deepEqual([...LAYOUTS], ['list', 'grid'])
    assert.equal(DEFAULT_LAYOUT, 'list')
    assert.equal(resolveLayout(null, null), 'list')
    assert.equal(resolveLayout(undefined, undefined), 'list')
  })

  it('lets the address win over what the browser remembered, in both directions', () => {
    assert.equal(resolveLayout('grid', 'list'), 'grid')
    assert.equal(resolveLayout('list', 'grid'), 'list', 'a link that says list opens the list for a person who last used the grid')
  })

  it('uses what the browser remembered when the address names nothing', () => {
    assert.equal(resolveLayout(null, 'grid'), 'grid')
    assert.equal(resolveLayout(null, 'list'), 'list')
  })

  it('takes anything that is not a layout, in the address or in storage, as nothing said', () => {
    for (const junk of ['', 'cards', 'GRID', 'grid ', '1', 'null']) {
      assert.equal(isLayout(junk), false, `"${junk}" is not a layout`)
      assert.equal(resolveLayout(junk, 'grid'), 'grid', `"${junk}" in the address falls to the memory`)
      assert.equal(resolveLayout('grid', junk), 'grid')
      assert.equal(resolveLayout(junk, junk), 'list')
    }
  })
})

describe('the address, read and written the way useUrlTab does', () => {
  it('names the layout in `layout`, leaves the list out of the address, and keeps every other parameter (search, filters, sort, page)', () => {
    assert.equal(LAYOUT_PARAM, 'layout')
    const base = new URLSearchParams('q=erp&type=service&sort=signals&dir=desc&page=3')
    assert.equal(writeTab(base, 'grid', 'list', LAYOUT_PARAM).toString(), 'q=erp&type=service&sort=signals&dir=desc&page=3&layout=grid')
    assert.equal(writeTab(new URLSearchParams('page=3&layout=grid'), 'list', 'list', LAYOUT_PARAM).toString(), 'page=3', 'back to the list: the parameter goes, the page stays')
    assert.equal(readTab(new URLSearchParams('layout=grid'), LAYOUTS, 'list', LAYOUT_PARAM), 'grid')
    assert.equal(readTab(new URLSearchParams('layout=cards'), LAYOUTS, 'list', LAYOUT_PARAM), 'list')
  })
})

describe('what the browser remembers', () => {
  it('reads back what was kept, and nothing for a browser that kept nothing', () => {
    const storage = memory()
    assert.equal(readRememberedLayout(storage), null)
    assert.equal(rememberLayout('grid', storage), true)
    assert.equal(storage.data[LAYOUT_STORAGE_KEY], 'grid')
    assert.equal(readRememberedLayout(storage), 'grid')
    assert.equal(rememberLayout('list', storage), true)
    assert.equal(readRememberedLayout(storage), 'list')
  })

  it('ignores a stored value that is not a layout', () => {
    assert.equal(readRememberedLayout(memory({ [LAYOUT_STORAGE_KEY]: 'cards' })), null)
    assert.equal(readRememberedLayout(memory({ [LAYOUT_STORAGE_KEY]: '' })), null)
  })

  it('does not fail where storage is absent or refuses (a private window, blocked site data): it remembers nothing and says so', () => {
    assert.equal(readRememberedLayout(refusing), null)
    assert.equal(rememberLayout('grid', refusing), false)
    assert.equal(readRememberedLayout(null), null)
    assert.equal(rememberLayout('grid', null), false)
  })
})
