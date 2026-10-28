/**
 * REGRESSION: the page stops responding to clicks after a popup closes.
 *
 * Opening a Dialog / ConfirmDialog from a row-actions menu (or a right-click
 * menu) used to leave `pointer-events: none` on <body> once both had closed, so
 * the screen looked normal and swallowed every click until it was refreshed.
 * Cause: a MODAL Radix menu and a modal Radix dialog share dismissable-layer's
 * module-level `originalBodyPointerEvents`, and their overlapping teardowns
 * write the wrong value back. The shared `DropdownMenu` / `ContextMenu`
 * wrappers are non-modal by default now, which removes the overlap.
 *
 * If you change those wrappers back to modal, the menu cases below go red.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, setAnimateClosed } from './dom-env'

const w = installDom()

async function scenarios() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const dd = await import('@/components/ui/dropdown-menu')
  const dlg = await import('@/components/ui/dialog')
  const cm = await import('@/components/ui/context-menu')
  const confirm = await import('@/components/ui/confirm-dialog')
  const { act, useState, createElement: h, Fragment } = React

  const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
  const finishExitAnimations = () => act(async () => {
    for (const el of Array.from(w.document.querySelectorAll('[data-state="closed"]')) as Element[]) {
      const event = new w.Event('animationend', { bubbles: true }) as any
      event.animationName = 'fade-out'
      el.dispatchEvent(event)
    }
    await new Promise((r) => setTimeout(r, 0))
  })
  const press = (el: Element, key: string) =>
    act(async () => { el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })) })
  const click = (el: Element) =>
    act(async () => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })) })
  const byId = (id: string) => w.document.getElementById(id) as HTMLElement

  const EditDialog = ({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) =>
    h(dlg.Dialog, { open, onOpenChange: setOpen },
      h(dlg.DialogContent, null,
        h(dlg.DialogTitle, null, 'Edit'),
        h('button', { id: 'save', onClick: () => setOpen(false) }, 'Save')))

  return {
    React, createRoot, act, tick, finishExitAnimations,
    cases: [
      {
        name: 'plain button opens a Dialog (control)',
        Component: () => {
          const [open, setOpen] = useState(false)
          return h(Fragment, null, h('button', { id: 'go', onClick: () => setOpen(true) }, 'open'), h(EditDialog, { open, setOpen }))
        },
        steps: async () => { await click(byId('go')); await tick(5); await click(byId('save')) },
      },
      {
        name: 'row-actions menu opens an Edit dialog',
        Component: () => {
          const [open, setOpen] = useState(false)
          return h(Fragment, null,
            h(dd.DropdownMenu, null,
              h(dd.DropdownMenuTrigger, { id: 'trigger' }, 'actions'),
              h(dd.DropdownMenuContent, null, h(dd.DropdownMenuItem, { id: 'item', onSelect: () => setOpen(true) }, 'Edit'))),
            h(EditDialog, { open, setOpen }))
        },
        steps: async () => {
          const trigger = byId('trigger'); trigger.focus(); await press(trigger, 'Enter'); await tick(5)
          await click(byId('item')); await tick(5); await click(byId('save'))
        },
      },
      {
        name: 'row-actions menu opens a ConfirmDialog',
        Component: () => {
          const [open, setOpen] = useState(false)
          return h(Fragment, null,
            h(dd.DropdownMenu, null,
              h(dd.DropdownMenuTrigger, { id: 'trigger' }, 'actions'),
              h(dd.DropdownMenuContent, null, h(dd.DropdownMenuItem, { id: 'item', onSelect: () => setOpen(true) }, 'Delete'))),
            h(confirm.ConfirmDialog as any, { open, onOpenChange: setOpen, title: 'Delete?', description: 'Sure?', confirmLabel: 'Yes', onConfirm: () => setOpen(false) }))
        },
        steps: async () => {
          const trigger = byId('trigger'); trigger.focus(); await press(trigger, 'Enter'); await tick(5)
          await click(byId('item')); await tick(5)
          const cancel = (Array.from(w.document.querySelectorAll('button')) as HTMLElement[]).find((b) => b.textContent === 'Cancel')
          assert.ok(cancel, 'the ConfirmDialog did not open')
          await click(cancel)
        },
      },
      {
        name: 'right-click menu opens a Rename dialog',
        Component: () => {
          const [open, setOpen] = useState(false)
          return h(Fragment, null,
            h(cm.ContextMenu, null,
              h(cm.ContextMenuTrigger, { id: 'trigger' }, 'row'),
              h(cm.ContextMenuContent, null, h(cm.ContextMenuItem, { id: 'item', onSelect: () => setOpen(true) }, 'Rename'))),
            h(EditDialog, { open, setOpen }))
        },
        steps: async () => {
          await act(async () => { byId('trigger').dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 })) })
          await tick(5); await click(byId('item')); await tick(5); await click(byId('save'))
        },
      },
      {
        name: 'one dialog hands over to the next',
        Component: () => {
          const [a, setA] = useState(false)
          const [b, setB] = useState(false)
          return h(Fragment, null,
            h('button', { id: 'go', onClick: () => setA(true) }, 'open'),
            h(dlg.Dialog, { open: a, onOpenChange: setA }, h(dlg.DialogContent, null, h(dlg.DialogTitle, null, 'A'), h('button', { id: 'next', onClick: () => { setA(false); setB(true) } }, 'Next'))),
            h(dlg.Dialog, { open: b, onOpenChange: setB }, h(dlg.DialogContent, null, h(dlg.DialogTitle, null, 'B'), h('button', { id: 'save', onClick: () => setB(false) }, 'Done'))))
        },
        steps: async () => { await click(byId('go')); await tick(5); await click(byId('next')); await tick(5); await click(byId('save')) },
      },
    ],
  }
}

for (const animated of [false, true]) {
  test(`<body> is clickable again once every popup has closed (${animated ? 'with' : 'without'} exit animations)`, async () => {
    const { React, createRoot, act, tick, finishExitAnimations, cases } = await scenarios()
    setAnimateClosed(animated)

    for (const { name, Component, steps } of cases) {
      w.document.body.style.pointerEvents = ''
      w.document.body.innerHTML = '<div id="root"></div>'
      const root = createRoot(w.document.getElementById('root')!)
      await act(async () => { root.render(React.createElement(Component)) })

      await steps()
      await tick(5); await finishExitAnimations(); await finishExitAnimations(); await tick(30)

      const openLayers = w.document.querySelectorAll('[role="dialog"],[role="alertdialog"],[role="menu"]').length
      assert.equal(openLayers, 0, `${name}: a popup is still open`)
      assert.notEqual(w.document.body.style.pointerEvents, 'none', `${name}: <body> was left at pointer-events:none - the page would ignore every click`)

      await act(async () => { root.unmount() })
    }
  })
}
