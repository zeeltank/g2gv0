import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { peopleRightsFrom } from '../../components/domain/crm/people/people-rights'
import { menuWith } from './kit'

/** The rights on the Contacts menu rows, read from the raw menu answer (not from the sidebar's tree, which folds those rows away). */

describe('the rights on people', () => {
  it('are none when the menu has no Contacts row (revoking deletes the row)', () => {
    assert.deepEqual(peopleRightsFrom(menuWith(null)), { view: false, add: false, edit: false, delete: false })
    assert.deepEqual(peopleRightsFrom(undefined), { view: false, add: false, edit: false, delete: false })
  })

  it('are the flags the server put on the row', () => {
    assert.deepEqual(peopleRightsFrom(menuWith({ view: true })), { view: true, add: false, edit: false, delete: false })
    assert.deepEqual(peopleRightsFrom(menuWith({ view: true, add: true, edit: false, delete: true })), { view: true, add: true, edit: false, delete: true })
  })

  it('treat a row with can_view 0 as no view right', () => {
    assert.equal(peopleRightsFrom(menuWith({ view: false, add: true })).view, false)
  })

  it('take either Contacts row (marketing or support): the middleware\'s `|` is "or", so the rights are the union', () => {
    const rows = [{ id: 1, label: 'M', icon: null, access_link: '/module/crm/marketing/contacts', page_type: 'page', sort_order: 1, can_view: 1, can_edit: 1 }, { id: 2, label: 'S', icon: null, access_link: '/module/crm/support/contacts/', page_type: 'page', sort_order: 2, can_view: 1, can_delete: 1 }]
    assert.deepEqual(peopleRightsFrom(rows as never), { view: true, add: false, edit: true, delete: true })
  })

  it('give view only to a row that carries no can_* flags at all (an older server): the server still answers 403 to a write it does not allow', () => {
    const rows = [{ id: 1, label: 'M', icon: null, access_link: '/module/crm/marketing/contacts', page_type: 'page', sort_order: 1 }]
    assert.deepEqual(peopleRightsFrom(rows as never), { view: true, add: false, edit: false, delete: false })
  })

  it('find the row at any depth, whichever key holds the children', () => {
    const tree = [{ id: 1, label: 'Root', icon: null, access_link: null, page_type: null, sort_order: 1, submenus: [{ id: 2, label: 'Mid', icon: null, access_link: null, page_type: null, sort_order: 1, menus: [{ id: 3, label: 'Contacts', icon: null, access_link: '/module/crm/marketing/contacts', page_type: 'page', sort_order: 1, can_view: 1, can_add: 1 }] }] }]
    assert.equal(peopleRightsFrom(tree as never).add, true)
  })
})
