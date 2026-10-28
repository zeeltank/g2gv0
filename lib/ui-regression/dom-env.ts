/**
 * A minimal browser for tests that render real Radix components.
 *
 * `npm test` runs under plain node, so these tests build a jsdom window and
 * publish the handful of globals React, Radix and the menus read. Import this
 * BEFORE react-dom, and import the components dynamically afterwards.
 *
 * `node --test` runs each file in its own process, so touching globals here
 * does not leak into any other test.
 */
import { JSDOM } from 'jsdom'

const GLOBALS = [
  'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'getComputedStyle',
  'KeyboardEvent', 'MouseEvent', 'Event', 'CustomEvent', 'DocumentFragment', 'HTMLInputElement', 'SVGElement',
  'FocusEvent', 'requestAnimationFrame', 'cancelAnimationFrame', 'NodeFilter', 'HTMLButtonElement',
  'HTMLDivElement', 'HTMLSpanElement', 'HTMLAnchorElement', 'HTMLFormElement', 'HTMLTextAreaElement',
  'HTMLSelectElement', 'ShadowRoot', 'Text', 'Comment', 'DOMException', 'AbortController',
]

/** While true, anything in `data-state="closed"` reports a running exit animation, as it does in a real browser. */
let animateClosed = false
export function setAnimateClosed(value: boolean) {
  animateClosed = value
}

export function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    pretendToBeVisual: true,
    url: 'http://localhost/',
  })
  const w = dom.window as any
  const g = globalThis as any

  for (const key of GLOBALS) {
    try {
      Object.defineProperty(g, key, { value: w[key], configurable: true, writable: true })
    } catch {
      /* a few of these are read-only on some Node versions; the rest are enough */
    }
  }
  g.IS_REACT_ACT_ENVIRONMENT = true

  g.ResizeObserver = w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  g.DOMRect = class {
    x = 0; y = 0; width = 0; height = 0; top = 0; left = 0; right = 0; bottom = 0
    static fromRect(rect: object = {}) {
      return Object.assign(new (g.DOMRect as any)(), rect)
    }
  }
  g.matchMedia = w.matchMedia = (query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  })

  const proto = w.Element.prototype
  proto.hasPointerCapture = () => false
  proto.setPointerCapture = () => {}
  proto.releasePointerCapture = () => {}
  proto.scrollIntoView = () => {}
  // jsdom fires focus events synchronously, so two stacked focus traps (a menu and the dialog it opens)
  // pull focus back and forth until the stack overflows. Focus is not what these tests are about.
  w.HTMLElement.prototype.focus = function focus(this: unknown) {
    Object.defineProperty(w.document, 'activeElement', { value: this, configurable: true })
  }

  const realGetComputedStyle = w.getComputedStyle.bind(w)
  g.getComputedStyle = w.getComputedStyle = (element: Element, ...rest: unknown[]) => {
    const style = realGetComputedStyle(element, ...rest)
    if (animateClosed && (element as HTMLElement).getAttribute?.('data-state') === 'closed') {
      return new Proxy(style, {
        get: (target: any, prop) =>
          prop === 'animationName' ? 'fade-out' : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop],
      })
    }
    return style
  }

  return w as Window & typeof globalThis & any
}
