import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'

import { hasContent, LIMITS, readPage } from './dom-snapshot'

function pageFrom(html: string): Element {
  const dom = new JSDOM(`<!doctype html><body><div id="root">${html}</div></body>`)
  return dom.window.document.getElementById('root')!
}

// The markup of a G2G list page: heading + description, a card with a counted heading,
// filter comboboxes, a search box and a table whose cells stack a name over a code.
const DEPARTMENT_PAGE = `
  <header><h1>Department Management</h1><p>Manage and organize departments and departmental hierarchy.</p></header>
  <section>
    <h2>Department Hierarchy (21)</h2>
    <input type="text" placeholder="Search department..." value="" />
  </section>
  <section>
    <h2>Department List (40)</h2>
    <input type="text" placeholder="Search department..." value="" />
    <button role="combobox">Status: All</button>
    <button role="combobox">Parent Department</button>
    <table>
      <thead><tr><th>Department</th><th>Head</th><th>Actions</th></tr></thead>
      <tbody>
        <tr><td><div>Artificial Intelligence</div><div>AI</div></td><td><span>Unassigned</span><span>No HOD</span></td><td><button>edit</button></td></tr>
        <tr><td><div>Development</div><div>D</div></td><td><span>Unassigned</span><span>No HOD</span></td><td><button>edit</button></td></tr>
        <tr aria-selected="true"><td><div>Devops</div><div>D</div></td><td><span>Asha Rao</span><span>HOD</span></td><td></td></tr>
      </tbody>
    </table>
  </section>`

test('reads the page title and description', () => {
  const snapshot = readPage(pageFrom(DEPARTMENT_PAGE))

  assert.equal(snapshot.title, 'Department Management')
  assert.equal(snapshot.description, 'Manage and organize departments and departmental hierarchy.')
})

test('reads counted section headings as metrics', () => {
  const { metrics } = readPage(pageFrom(DEPARTMENT_PAGE))

  assert.deepEqual(metrics, [
    { label: 'Department Hierarchy', value: 21 },
    { label: 'Department List', value: 40 },
  ])
})

test('reads the table under its heading, with the count the page states', () => {
  const { tables } = readPage(pageFrom(DEPARTMENT_PAGE))

  assert.equal(tables.length, 1)
  assert.equal(tables[0].title, 'Department List')
  assert.deepEqual(tables[0].columns, ['Department', 'Head', 'Actions'])
  assert.equal(tables[0].rowCount, 40)
  assert.equal(tables[0].rows.length, 3)
  assert.equal(tables[0].rows[0].Department, 'Artificial Intelligence · AI')
  assert.equal(tables[0].rows[0].Head, 'Unassigned · No HOD')
})

test('reads filter controls with their current value', () => {
  const { filters } = readPage(pageFrom(DEPARTMENT_PAGE))

  assert.deepEqual(filters[0], { label: 'Status', value: 'All' })
})

test('reads what the search box searches and what is typed in it', () => {
  const dom = pageFrom(DEPARTMENT_PAGE)
  ;(dom.querySelector('input') as HTMLInputElement).value = 'dev'

  const { search } = readPage(dom)

  assert.deepEqual(search, { query: 'dev', placeholder: 'Search department...' })
})

test('reads selected rows by their first cell', () => {
  assert.deepEqual(readPage(pageFrom(DEPARTMENT_PAGE)).selected, ['Devops · D'])
})

test('reads tabs and which one is active', () => {
  const { tabs } = readPage(
    pageFrom(`<h1>Settings</h1><div role="tablist"><button role="tab" aria-selected="true">General</button><button role="tab" aria-selected="false">Billing</button></div>`),
  )

  assert.deepEqual(tabs, [
    { label: 'General', active: true },
    { label: 'Billing', active: false },
  ])
})

test('ignores hidden content', () => {
  const { tables, title } = readPage(
    pageFrom(`<h1>Shown</h1><div hidden><h2>Hidden (9)</h2><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table></div>`),
  )

  assert.equal(title, 'Shown')
  assert.equal(tables.length, 0)
})

test('caps rows and cell length so a huge page cannot flood a prompt', () => {
  const rows = Array.from({ length: 200 }, (_, i) => `<tr><td>${'x'.repeat(500)}${i}</td></tr>`).join('')
  const { tables } = readPage(pageFrom(`<h1>Big</h1><table><thead><tr><th>Name</th></tr></thead><tbody>${rows}</tbody></table>`))

  assert.equal(tables[0].rows.length, LIMITS.rows)
  assert.equal(tables[0].rowCount, 200)
  assert.ok(tables[0].rows[0].Name.length <= LIMITS.cell)
})

test('a page with nothing readable reports no content', () => {
  assert.equal(hasContent(readPage(pageFrom('<div></div>'))), false)
})
