/**
 * A minimal browser for the scaffold component tests (see lib/ui-regression/dom-env.ts). Importing this module installs the fake DOM, so it must come
 * before react-dom is loaded: import it first, then import React, react-dom and the components dynamically inside the test, as menu-dialog-pointer-events
 * does. `node --test` runs each file in its own process, so the globals do not leak between test files; within a file, call disposeAll() after each
 * test (afterEach) so one test's open dialog is not still on the page in the next.
 */
import { installDom } from '../ui-regression/dom-env'
import { h } from './h'

export const w = installDom()

const mounted: Array<{ unmount: () => Promise<void>; container: HTMLElement }> = []

/** Unmounts everything kit() mounted, which also removes the dialogs they portalled to <body>. */
export async function disposeAll() {
  for (const m of mounted.splice(0)) {
    await m.unmount()
    m.container.remove()
  }
}

export async function kit() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { act } = React
  const container = w.document.createElement('div')
  w.document.body.appendChild(container)
  const root = createRoot(container)
  let unmounted = false
  const unmount = async () => {
    if (unmounted) return
    unmounted = true
    await act(async () => { root.unmount() })
  }
  mounted.push({ unmount, container })

  const tick = (ms = 0) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) })
  const render = (element: unknown) => act(async () => { root.render(element as never) })
  const click = (el: Element) => act(async () => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })) })
  /** Presses a key on `target` (default: the focused element). Resolves to false when something called preventDefault on it, as a browser would see it. */
  const press = async (key: string, target?: Element) => {
    let delivered = true
    await act(async () => {
      const el = target ?? (w.document.activeElement as Element | null) ?? w.document.body
      delivered = el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    })
    return delivered
  }
  const all = (selector: string) => Array.from(w.document.querySelectorAll(selector)) as HTMLElement[]
  const one = (selector: string) => w.document.querySelector(selector) as HTMLElement | null
  /** The first element of this kind whose whole text is `text`. */
  const withText = (text: string, selector = 'button') => all(selector).find((el) => el.textContent?.trim() === text) ?? null
  const bodyText = () => w.document.body.textContent ?? ''

  return { React, w, act, root, tick, render, unmount, click, press, all, one, withText, bodyText, h }
}
