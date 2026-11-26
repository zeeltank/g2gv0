import assert from 'node:assert/strict'
import { kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import { ApiError } from '../../services/core'
import type {
  DryRunResult, GtmWorkflow, RecipeInstallResult, RunDetail, WorkflowCatalog, WorkflowHealth, WorkflowRecipe, WorkflowRunRow,
} from '../../services/gtm/workflows'
import { catalog as catalogFixture, health as healthFixture, runDetail as runDetailFixture } from './fixtures'

/**
 * Test support for the Automations and Runs tabs: a fake browser with a signed-in administrator, the workflows service replaced by a fake that records what
 * it is asked, and the real tabs, drawers and scaffolds on top. It has no tests of its own and never touches the network.
 */

export type Kit = Awaited<ReturnType<typeof kit>>

export interface Calls {
  catalog: number
  list: number
  recipes: number
  health: number
  create: Array<Record<string, unknown>>
  update: Array<{ id: number; body: Record<string, unknown> }>
  setStatus: Array<{ id: number; status: string; confirm: boolean }>
  install: string[]
  test: Array<{ id: number; entityId: number }>
  runs: Array<Record<string, unknown>>
  approve: Array<{ id: number; note: string }>
  reject: Array<{ id: number; note: string }>
  retry: number[]
  cancel: number[]
  /** Every address the screen wrote, oldest first. */
  written: string[]
}

export interface World {
  catalog?: WorkflowCatalog
  items?: GtmWorkflow[]
  recipes?: WorkflowRecipe[] | 'fail'
  health?: WorkflowHealth | 'fail'
  /** The list call fails (a network error) this many times, then works. */
  listFailsTimes?: number
  /** Runs by status filter ('' = no filter). */
  runs?: WorkflowRunRow[]
  counts?: Record<string, number>
  detail?: RunDetail
  dryRun?: DryRunResult
  dryRunFails?: ApiError
  installResult?: RecipeInstallResult
  role?: 'administrator' | 'executive'
  /** The address the screen opens at, without the "?". */
  search?: string
  /** The leads a lead picker finds (default: one). */
  leads?: Array<{ id: string; firstName: string | null; lastName: string; company: string | null }>
  /** The status refusal for the next setStatus, if any. */
  statusRefusal?: ApiError
}

const ok = <T>(data: T) => ({ status: 1, data })

export async function mountTab(which: 'automations' | 'runs', world: World = {}) {
  const k = await kit()
  const calls: Calls = { catalog: 0, list: 0, recipes: 0, health: 0, create: [], update: [], setStatus: [], install: [], test: [], runs: [], approve: [], reject: [], retry: [], cancel: [], written: [] }
  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const { workflowsService } = await import('../../services/gtm/workflows')
  const state = { items: [...(world.items ?? [])], recipes: world.recipes, listFails: world.listFailsTimes ?? 0 }
  const requestedRuns = (status?: string) => (world.runs ?? []).filter((r) => !status || r.status === status)

  Object.assign(workflowsService, {
    catalog: async () => { calls.catalog += 1; return ok(world.catalog ?? catalogFixture()) },
    list: async () => {
      calls.list += 1
      if (state.listFails > 0) { state.listFails -= 1; throw new ApiError('Network error', 0) }
      return ok({ items: state.items })
    },
    recipes: async () => {
      calls.recipes += 1
      if (state.recipes === 'fail') throw new ApiError('Not found', 404)
      return ok({ items: state.recipes ?? [] })
    },
    installRecipe: async (key: string) => {
      calls.install.push(key)
      const made = world.installResult ?? { created: true, id: 99 }
      if (state.recipes && state.recipes !== 'fail') state.recipes = state.recipes.map((r) => (r.key === key ? { ...r, installed_workflow_id: 99 } : r))
      return ok(made)
    },
    health: async () => {
      calls.health += 1
      if (world.health === 'fail') throw new ApiError('Not found', 404)
      return ok(world.health ?? healthFixture())
    },
    create: async (body: Record<string, unknown>) => {
      calls.create.push(body)
      return ok({ workflow: { id: 100 + calls.create.length, name: String(body.name) } })
    },
    update: async (id: number, body: Record<string, unknown>) => { calls.update.push({ id, body }); return ok({ workflow: { id } }) },
    setStatus: async (id: number, status: string, confirm = false) => {
      calls.setStatus.push({ id, status, confirm })
      if (world.statusRefusal) throw world.statusRefusal
      state.items = state.items.map((w) => (w.id === id ? { ...w, status: status as GtmWorkflow['status'] } : w))
      return ok({ workflow: { id }, runs_cancelled: status === 'archived' ? 2 : 0 })
    },
    test: async (id: number, entityId: number) => {
      calls.test.push({ id, entityId })
      if (world.dryRunFails) throw world.dryRunFails
      return ok(world.dryRun ?? { dry_run: true, would_run: true, conditions: [], needs_approval: false, actions: [], facts: {} })
    },
    runs: async (params: Record<string, unknown> = {}) => {
      calls.runs.push(params)
      return ok({ items: requestedRuns(params.status as string | undefined), counts: world.counts ?? {} })
    },
    run: async () => ok(world.detail ?? runDetailFixture()),
    approve: async (id: number, note: string) => { calls.approve.push({ id, note }); return ok({ status: 'succeeded', run: null }) },
    reject: async (id: number, note: string) => { calls.reject.push({ id, note }); return ok({ status: 'rejected', run: null }) },
    retry: async (id: number) => { calls.retry.push(id); return ok({ status: 'queued', run: null }) },
    cancel: async (id: number) => { calls.cancel.push(id); return ok({ status: 'cancelled', run: null }) },
  })

  const { crmService } = await import('../../services/crm')
  const leads = world.leads ?? [{ id: '12', firstName: 'Asha', lastName: 'Rao', company: 'Acme School' }]
  Object.assign(crmService, { getLeads: async () => ({ status: 1, message: '', data: { items: leads, pagination: {} } }) })

  const { AuthContext } = await import('../../components/auth/gtg-auth')
  const router = await routerHarness(world.search ?? '', '/platform-services/workflow')
  const { AutomationsTab, RunsTab } = await import('../../app/platform-services/workflow/_components/automations')
  const auth = { user: { id: 2, role: world.role ?? 'administrator', name: 'Admin' } }
  const element = k.h(AuthContext.Provider, { value: auth as never }, router.wrap(k.h(which === 'automations' ? AutomationsTab : RunsTab)))
  await k.render(element)
  await k.tick(30)
  calls.written = router.written

  const button = (text: string) => k.all('button').find((b) => (b.textContent ?? '').trim() === text) as HTMLButtonElement | undefined
  const press = async (text: string) => { const b = button(text); assert.ok(b, `there is a "${text}" button`); await k.click(b!); await k.tick(30) }
  const rows = () => k.all('li[data-automation]')
  const runRows = () => k.all('li[data-run]')
  const dialog = () => k.one('[role="dialog"]')
  const alertDialog = () => k.one('[role="alertdialog"]')
  const choose = async (select: HTMLSelectElement, value: string) => {
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(30)
  }
  return { k, calls, router, state, button, press, rows, runRows, dialog, alertDialog, choose, workflowsService }
}

