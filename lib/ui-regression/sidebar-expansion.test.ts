/**
 * REGRESSION: the sidebar collapses every branch after you open a page.
 *
 * The shell is rebuilt inside each page, so on a fresh mount `active` is still
 * the empty sentinel (or a default) while the sidebar seeds its expanded state -
 * nothing was left open, and nothing re-opened once `active` resolved. The
 * sidebar now re-opens the module and branch holding the active item whenever
 * the active item (or its module) becomes known.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installDom } from './dom-env'

const w = installDom()

const NONE = { moduleId: '', menuId: '', submenuId: '' }
// Organizational Management > Organization Setup > (Profile | Departments), and a second branch beside it.
const leaf = (id: string, label: string) => ({ id, label, children: [] })
const MODULES = [
  {
    id: '1', label: 'Organizational Management', short: 'Org', icon: null,
    children: [
      { id: '7', label: 'Organization Setup', children: [leaf('12', 'Organization Profile'), leaf('13', 'Department Management')] },
      { id: '8', label: 'User Management', children: [leaf('20', 'Users')] },
    ],
  },
  { id: '2', label: 'LMS', short: 'LMS', icon: null, children: [{ id: '30', label: 'Courses', children: [leaf('31', 'My Learning')] }] },
] as any[]
const PROFILE = { moduleId: '1', menuId: '7', submenuId: '12' }
const DEPARTMENTS = { moduleId: '1', menuId: '7', submenuId: '13' }

async function mount() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { GtgSidebar } = await import('@/components/shell/gtg-sidebar')
  const { act, createElement: h } = React

  // A brand-new container per test: re-rendering into an old root would carry the previous test's
  // expanded state across and let a broken sidebar pass.
  w.document.body.innerHTML = '<div id="root"></div>'
  const root = createRoot(w.document.getElementById('root')!)
  const render = (active: unknown, modules: any[] = MODULES) =>
    act(async () => {
      root.render(h(GtgSidebar as any, { active, modules, onSelect() {}, collapsed: false, onCollapsedChange() {} }))
    })

  // Only the desktop rail (the first <aside>) - the mobile drawer is a second copy of the tree.
  const rail = () => w.document.querySelector('aside') as HTMLElement
  const button = (label: string) =>
    (Array.from(rail().querySelectorAll('button')) as HTMLElement[]).find((b) => b.textContent?.trim() === label)
  const expanded = (label: string) => button(label)?.getAttribute('aria-expanded')

  return { act, render, button, expanded, rail }
}

test('opens the active page\'s module and branch once `active` resolves after mount', async () => {
  const { render, expanded, button } = await mount()

  await render(NONE)
  assert.equal(expanded('Organizational Management'), 'false', 'nothing is open before the page is known')

  await render(PROFILE)
  assert.equal(expanded('Organizational Management'), 'true', 'the module holding the page is open')
  assert.equal(expanded('Organization Setup'), 'true', 'the branch holding the page is open')
  assert.ok(button('Organization Profile'), 'the page itself is visible in the tree')
  assert.equal(button('Organization Profile')?.getAttribute('aria-current'), 'page')
  assert.equal(expanded('LMS'), 'false', 'unrelated modules stay shut')
})

test('is already open on the first render when the page is known up front', async () => {
  const { render, expanded } = await mount()
  await render(PROFILE)
  assert.equal(expanded('Organizational Management'), 'true')
  assert.equal(expanded('Organization Setup'), 'true')
})

test('opens once the menu tree arrives, when `active` was known before it', async () => {
  const { render, expanded } = await mount()
  await render(PROFILE, [])
  await render(PROFILE, MODULES)
  assert.equal(expanded('Organizational Management'), 'true')
  assert.equal(expanded('Organization Setup'), 'true')
})

test('keeps a branch the person opened by hand when they navigate', async () => {
  const { act, render, button, expanded } = await mount()
  await render(PROFILE)

  await act(async () => { button('User Management')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true })) })
  assert.equal(expanded('User Management'), 'true')

  await render(DEPARTMENTS)
  assert.equal(button('Department Management')?.getAttribute('aria-current'), 'page')
  assert.equal(expanded('Organization Setup'), 'true')
  assert.equal(expanded('User Management'), 'true', 'a hand-opened branch is not shut by navigating')
})
