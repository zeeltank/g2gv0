import type { OrgAccountsApi, OrgCreateCrmRequest, OrgListParams, OrgPatchRequest } from '../../services/org-accounts/api-types'
import type { OrgLinkRequest } from '../../services/org-accounts/types'
import { listResponse, meta, org360, suggestions } from './fixtures'

export interface FakeCalls {
  list: OrgListParams[]
  get: Array<number | string>
  forCrm: Array<number | string>
  suggestions: Array<number | string | undefined>
  link: OrgLinkRequest[]
  patch: Array<{ id: number | string; body: OrgPatchRequest }>
  create: Array<{ id: number | string; body: OrgCreateCrmRequest | undefined }>
}

/**
 * A stand-in for the Organisation 360 API for component tests. Every call is recorded exactly as the screen made it, and `overrides` replace what a method
 * answers (or throws). Nothing here touches the network.
 */
export function fakeService(overrides: Partial<OrgAccountsApi> = {}) {
  const calls: FakeCalls = { list: [], get: [], forCrm: [], suggestions: [], link: [], patch: [], create: [] }
  const service: OrgAccountsApi = {
    list: async (params) => { calls.list.push(params); return overrides.list ? overrides.list(params) : listResponse() },
    meta: async () => (overrides.meta ? overrides.meta() : { status: 1, data: meta() }),
    suggestions: async (identityId) => { calls.suggestions.push(identityId); return overrides.suggestions ? overrides.suggestions(identityId) : { status: 1, data: suggestions() } },
    get: async (id) => { calls.get.push(id); return overrides.get ? overrides.get(id) : { status: 1, data: org360() } },
    forCrm: async (id) => { calls.forCrm.push(id); return overrides.forCrm ? overrides.forCrm(id) : { status: 1, created: false, data: org360() } },
    link: async (body) => { calls.link.push(body); return overrides.link ? overrides.link(body) : { status: 1, data: null } },
    patch: async (id, body) => { calls.patch.push({ id, body }); return overrides.patch ? overrides.patch(id, body) : { status: 1, data: {} } },
    createCrmOrganisation: async (id, body) => {
      calls.create.push({ id, body })
      return overrides.createCrmOrganisation ? overrides.createCrmOrganisation(id, body) : { status: 1, data: { created: true, crm_organization_id: 91, restored: false } }
    },
  }
  return { service, calls }
}
