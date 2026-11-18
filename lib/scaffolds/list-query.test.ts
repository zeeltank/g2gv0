import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cleanPage, listQueryString, patchListQuery, readListQuery, writeListQuery,
  type ListQuery, type ListQueryConfig,
} from '../../components/shared/scaffolds/list-query'

const config: ListQueryConfig = {
  sort: 'name',
  sortKeys: ['name', 'created_at'],
  dir: 'asc',
  filters: { status: { default: 'active', allowed: ['active', 'archived', 'all'] }, owner: { default: '' } },
}
const read = (qs: string, c: ListQueryConfig = config) => readListQuery(new URLSearchParams(qs), c)

describe('reading a list state from the URL', () => {
  it('gives the defaults for an empty URL', () => {
    assert.deepEqual(read(''), { q: '', sort: 'name', dir: 'asc', page: 1, filters: { status: 'active', owner: '' } })
  })

  it('reads every parameter it owns', () => {
    assert.deepEqual(read('q=  scholar  &sort=created_at&dir=desc&page=3&status=archived&owner=7'), {
      q: 'scholar', sort: 'created_at', dir: 'desc', page: 3, filters: { status: 'archived', owner: '7' },
    })
  })

  it('falls back to the default for a value that is not allowed, so a hostile URL never reaches the screen', () => {
    const q = read('sort=password&dir=sideways&status=deleted&page=-4')
    assert.equal(q.sort, 'name')
    assert.equal(q.dir, 'asc')
    assert.equal(q.filters.status, 'active')
    assert.equal(q.page, 1)
  })

  it('accepts any sort key when the config does not list them, and keeps a filter value when it lists none', () => {
    const open: ListQueryConfig = { sort: 'id', filters: { kind: { default: '' } } }
    assert.equal(read('sort=anything&kind=whatever', open).sort, 'anything')
    assert.equal(read('kind=whatever', open).filters.kind, 'whatever')
  })

  it('treats a list with no sorting as having an empty sort', () => {
    assert.equal(read('', {}).sort, '')
  })

  it('refuses a filter named after one of its own parameters (a mistake in the screen, found at once)', () => {
    assert.throws(() => read('', { filters: { page: { default: '' } } }), /reserved/)
  })
})

describe('page numbers', () => {
  it('accepts whole numbers from 1 up and nothing else', () => {
    assert.equal(cleanPage('1'), 1)
    assert.equal(cleanPage('42'), 42)
    assert.equal(cleanPage(7), 7)
    for (const bad of ['0', '-1', '1.5', '2abc', '', ' 3', 'NaN', null, undefined, 0, -2, 2.5, Number.NaN, 1e9, '100001']) {
      assert.equal(cleanPage(bad as never), 1, String(bad))
    }
  })
})

describe('changing the list state', () => {
  const start: ListQuery = read('q=abc&page=4&sort=created_at&status=archived')

  it('goes back to page 1 when the search, the sort, the direction or a filter really changes', () => {
    assert.equal(patchListQuery(start, { q: 'abcd' }, config).page, 1)
    assert.equal(patchListQuery(start, { sort: 'name' }, config).page, 1)
    assert.equal(patchListQuery(start, { dir: 'desc' }, config).page, 1)
    assert.equal(patchListQuery(start, { filters: { status: 'all' } }, config).page, 1)
  })

  it('keeps the page when nothing really changed (a re-typed identical search, the same filter again)', () => {
    assert.equal(patchListQuery(start, { q: '  abc ' }, config).page, 4)
    assert.equal(patchListQuery(start, { filters: { status: 'archived' } }, config).page, 4)
    assert.equal(patchListQuery(start, { sort: 'created_at', dir: 'asc' }, config).page, 4)
  })

  it('takes the page the caller names, even together with a change', () => {
    assert.equal(patchListQuery(start, { page: 2 }, config).page, 2)
    assert.equal(patchListQuery(start, { q: 'x', page: 5 }, config).page, 5)
    assert.equal(patchListQuery(start, { page: -3 }, config).page, 1)
  })

  it('cleans what it is given: a filter value that is not allowed becomes the default, an unknown filter is ignored', () => {
    assert.equal(patchListQuery(start, { filters: { status: 'bogus' } }, config).filters.status, 'active')
    assert.deepEqual(patchListQuery(start, { filters: { nonsense: 'x' } }, config).filters, start.filters)
  })

  it('does not change the state it was given', () => {
    const before = JSON.stringify(start)
    patchListQuery(start, { q: 'z', filters: { status: 'all' } }, config)
    assert.equal(JSON.stringify(start), before)
  })
})

describe('writing a list state to the URL', () => {
  it('leaves the defaults out, so the default view has a clean URL', () => {
    assert.equal(listQueryString(read(''), config), '')
  })

  it('writes only what differs from the defaults, in a fixed order', () => {
    const q = read('')
    q.q = 'scholar'; q.sort = 'created_at'; q.dir = 'desc'; q.page = 2; q.filters.status = 'archived'
    assert.equal(listQueryString(q, config), 'q=scholar&sort=created_at&dir=desc&page=2&status=archived')
  })

  it('writes the direction on its own when only that differs', () => {
    const q = read('')
    q.dir = 'desc'
    assert.equal(listQueryString(q, config), 'dir=desc')
  })

  it('keeps parameters it does not own and removes the ones it does when they return to their default', () => {
    const out = writeListQuery(new URLSearchParams('tab=usage&q=old&page=3&status=archived'), read(''), config)
    assert.equal(out.toString(), 'tab=usage')
  })

  it('does not write a blank search', () => {
    const q = read('')
    q.q = '   '
    assert.equal(listQueryString(q, config), '')
  })

  it('reads back exactly what it wrote', () => {
    const cases = ['', 'q=a%20b', 'sort=created_at&dir=desc', 'page=9', 'status=all&owner=12', 'q=x&sort=created_at&dir=desc&page=2&status=archived&owner=3']
    for (const qs of cases) {
      const first = read(qs)
      assert.deepEqual(read(listQueryString(first, config)), first, qs)
    }
  })
})
