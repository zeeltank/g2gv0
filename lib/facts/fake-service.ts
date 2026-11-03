import type { FactsApi, FactsQueueParams } from '../../services/facts/api-types'
import type { FactDecisionResult, FactEntityType } from '../../services/facts/types'
import { consentData, entityData, fact, queueData } from './fixtures'

export interface FakeCalls {
  entity: Array<{ type: FactEntityType; id: number | string }>
  queue: FactsQueueParams[]
  accept: Array<number | string>
  dismiss: Array<{ id: number | string; reason?: string }>
  consent: Array<{ type: FactEntityType; id: number | string }>
}

/**
 * A stand-in for the facts API for component tests. Every call is recorded exactly as the screen made it, and `overrides` replace what a method answers (or
 * throws). Nothing here touches the network.
 */
export function fakeFactsService(overrides: Partial<FactsApi> = {}) {
  const calls: FakeCalls = { entity: [], queue: [], accept: [], dismiss: [], consent: [] }
  const decided = (outcome: FactDecisionResult['data']['outcome']): FactDecisionResult => ({
    status: 1,
    data: { outcome, fact: fact(outcome === 'applied' ? { status: 'applied', decided_by_name: 'Anil Shah', column_written: true } : { status: 'dismissed', decided_by_name: 'Anil Shah' }) },
  })
  const service: FactsApi = {
    entity: async (type, id) => { calls.entity.push({ type, id }); return overrides.entity ? overrides.entity(type, id) : entityData() },
    queue: async (params) => { calls.queue.push(params); return overrides.queue ? overrides.queue(params) : queueData() },
    accept: async (id) => { calls.accept.push(id); return overrides.accept ? overrides.accept(id) : decided('applied') },
    dismiss: async (id, reason) => { calls.dismiss.push({ id, reason }); return overrides.dismiss ? overrides.dismiss(id, reason) : decided('dismissed') },
    consent: async (type, id) => { calls.consent.push({ type, id }); return overrides.consent ? overrides.consent(type, id) : consentData() },
  }
  return { service, calls }
}
