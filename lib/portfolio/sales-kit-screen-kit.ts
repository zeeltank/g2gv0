import assert from 'node:assert/strict'
import { kit } from '../scaffolds/dom-test-kit'
import { fakeSalesKitService, type KitFakeOptions } from '../../services/product-master/kit-fake-service'
import type { KitState } from '../../components/domain/portfolio/product-sales-kit-data'

/**
 * Test support for the Sales Kit tab: the real panel in a fake browser, reading and writing through the in-memory fake service (services/product-master/kit-fake-service.ts), with the
 * browser's downloads and blob addresses captured so a test sees what was saved and what was released. It has no tests of its own and never touches the network. Import it first in the
 * test file, and load the components from inside each test (they need the fake DOM).
 */

export type Kit = Awaited<ReturnType<typeof kit>>

export const PRODUCT_ID = 1

export interface OpenOptions extends KitFakeOptions {
  /** Mount the panel with this state instead of reading the fake service (for the loading and the failed states). */
  state?: KitState
  onRetry?: () => void
}

export async function openKit(options: OpenOptions = {}) {
  const k = await kit()
  const fake = fakeSalesKitService(options)
  const { useSalesKit } = await import('../../components/domain/portfolio/product-sales-kit-data')
  const { ProductSalesKit } = await import('../../components/domain/portfolio/product-sales-kit')
  const { accountService } = await import('../../services/account')

  // The preview of a PDF or a picture goes through the existing DocumentViewer, which reads the Document Library's own download.
  const previewed: number[] = []
  const realFetchDocument = accountService.fetchDocument
  Object.assign(accountService, { fetchDocument: async (id: number) => { previewed.push(id); return new Blob(['%PDF'], { type: 'application/pdf' }) } })

  // Downloads and blob addresses: what was saved (name and bytes) and which addresses were made and released.
  const saved: Array<{ name: string; blob: Blob }> = []
  const made: string[] = []
  const released: string[] = []
  const realCreate = URL.createObjectURL
  const realRevoke = URL.revokeObjectURL
  const realClick = k.w.HTMLAnchorElement.prototype.click
  const blobs = new Map<string, Blob>()
  let counter = 0
  URL.createObjectURL = ((blob: Blob) => { const url = `blob:test/${++counter}`; blobs.set(url, blob); made.push(url); return url }) as typeof URL.createObjectURL
  URL.revokeObjectURL = ((url: string) => { released.push(url) }) as typeof URL.revokeObjectURL
  k.w.HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) { if (this.download) saved.push({ name: this.download, blob: blobs.get(this.href)! }) }

  const retried = { count: 0 }
  function Harness() {
    const kitState = useSalesKit(fake.service, PRODUCT_ID, options.state === undefined)
    return k.h(ProductSalesKit, {
      productId: PRODUCT_ID,
      state: options.state ?? kitState.state,
      onReload: kitState.reload,
      onRetry: () => { retried.count += 1; options.onRetry?.(); kitState.retry() },
      service: fake.service,
    })
  }
  await k.render(k.h(Harness))
  await k.tick(30)

  const settle = (ms = 30) => k.tick(ms)
  const press = async (target: Element | null | undefined, wait = 25) => {
    assert.ok(target, 'the control to press exists')
    await k.click(target)
    await k.tick(wait)
  }
  const button = (label: string, within: ParentNode = k.w.document) => Array.from(within.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
  /** The entry whose title is `title`: its tile, or the featured card. */
  const entry = (title: string) => k.all('[data-kit-entry]').find((el) => el.querySelector('h3')?.textContent === title) ?? null
  const titles = () => k.all('[data-kit-entry] h3').map((h) => h.textContent)
  const chip = (label: string) => k.all('[role="group"][aria-label="Show"] button').find((b) => b.textContent?.startsWith(label)) as HTMLButtonElement | undefined
  const dialog = () => k.all('[role="dialog"]').pop() ?? null
  const confirmDialog = () => k.all('[role="alertdialog"]').pop() ?? null

  /** Types into a box the way a person does, so React's onChange runs. */
  const type = async (field: Element | null | undefined, text: string) => {
    assert.ok(field, 'the box to type in exists')
    const proto = field.tagName === 'TEXTAREA' ? k.w.HTMLTextAreaElement.prototype : k.w.HTMLInputElement.prototype
    const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
    await k.act(async () => { set.call(field, text); field.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
  }
  /** The box a label names, inside a dialog. */
  const field = (label: string, within: ParentNode = k.w.document) => {
    const text = Array.from(within.querySelectorAll('label')).find((l) => l.textContent?.replace(/\s*\*$/, '').trim() === label)
    return (text?.htmlFor ? k.w.document.getElementById(text.htmlFor) : null) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  }
  const openMenu = async (name: string) => {
    const trigger = k.all('button').find((b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name)
    assert.ok(trigger, `the "${name}" menu button exists`)
    await k.act(async () => { trigger.dispatchEvent(new k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await k.tick(15)
  }
  const menuItems = () => k.all('[role="menuitem"]').map((item) => item.textContent?.trim())
  const menuItem = (text: string) => k.all('[role="menuitem"]').find((item) => item.textContent?.trim() === text)
  /** Chooses files the way the file box does: its `files`, then a change. */
  const choose = async (files: File[]) => {
    const input = k.one('input[type="file"]') as HTMLInputElement | null
    assert.ok(input, 'the file box exists')
    Object.defineProperty(input, 'files', { value: files, configurable: true })
    await k.act(async () => { input.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(25)
  }
  /** Drops files on the panel, or drags something that is not a file over it. */
  const drop = async (target: Element, files: File[], types: string[] = ['Files']) => {
    for (const name of ['dragenter', 'dragover', 'drop'] as const) {
      await k.act(async () => {
        const event = new k.w.Event(name, { bubbles: true, cancelable: true })
        Object.defineProperty(event, 'dataTransfer', { value: { types, files, dropEffect: 'none' } })
        target.dispatchEvent(event)
      })
    }
    await k.tick(25)
  }

  return {
    k, fake, calls: fake.calls, service: fake.service, previewed, saved, made, released, retried, settle, press, button, entry, titles, chip, dialog, confirmDialog, type, field, openMenu, menuItems, menuItem, choose, drop,
    restore: () => {
      URL.createObjectURL = realCreate
      URL.revokeObjectURL = realRevoke
      k.w.HTMLAnchorElement.prototype.click = realClick
      Object.assign(accountService, { fetchDocument: realFetchDocument })
    },
  }
}
