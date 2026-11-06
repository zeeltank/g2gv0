import type { LaravelContext } from '@/lib/laravel-context'
import type {
  ConnectorSyncInfo,
  DataConnectorInfo,
  DataConnectorResponse,
  DataConnectorsResponse,
  IngestionFindingInfo,
  IngestionSourceDetail,
  IngestionSourceInfo,
} from '@/services/signals/opportunities'

export function isConnectorMockModeEnabled(nodeEnv: string | undefined, flag: string | undefined): boolean {
  return nodeEnv === 'development' && flag?.trim().toLowerCase() === 'true'
}

export function isDataConnectorMockModeEnabled(): boolean {
  return isConnectorMockModeEnabled(process.env.NODE_ENV, process.env.NEXT_PUBLIC_G2G_CONNECTORS_MOCK)
}

export interface MockConnectorInput {
  type: DataConnectorInfo['type']
  name: string
  url?: string
  external_account_id?: string
  product_key: string
  offer_id?: string | null
  customer_model?: DataConnectorInfo['customer_model']
  regions?: DataConnectorInfo['regions']
}

export type MockConnectorUpdate = Omit<MockConnectorInput, 'type'> & { type?: DataConnectorInfo['type'] }

export interface MockConnectorSchedule {
  sync_enabled: boolean
  schedule_enabled: boolean
  schedule_interval_minutes: number
  schedule_timezone: string
}

const available: DataConnectorsResponse['available'] = [
  { key: 'public_web_page', label: 'Public website or article', auth: 'public_url', requirements: ['A publicly accessible page URL'] },
  { key: 'youtube', label: 'YouTube channel', auth: 'oauth', requirements: ['YouTube Data API access', 'youtube.readonly'] },
  { key: 'linkedin', label: 'LinkedIn organization', auth: 'oauth', requirements: ['LinkedIn API access', 'r_organization_social', 'An eligible organization Page role'] },
  { key: 'facebook_page', label: 'Facebook Page', auth: 'oauth', requirements: ['Meta app review and granted Page permissions', 'pages_show_list', 'pages_read_engagement'] },
  { key: 'instagram_business', label: 'Instagram professional account', auth: 'oauth', requirements: ['A professional account linked to an accessible Facebook Page', 'instagram_basic', 'pages_show_list', 'pages_read_engagement'] },
]

const STORAGE_PREFIX = 'g2g_connectors_store_'
const SOURCES_STORAGE_PREFIX = 'g2g_ingestion_sources_store_'

export class DataConnectorMockApi {
  private readonly connectorsByTenant = new Map<string, DataConnectorInfo[]>()
  private nextConnectorId = 1
  private nextSyncId = 1

  private getTenantKey(context: LaravelContext): string {
    return context.subInstituteId || context.organizationId || 'default'
  }

  private loadPersisted(context: LaravelContext): DataConnectorInfo[] | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + this.getTenantKey(context))
      if (!raw) return null
      const parsed = JSON.parse(raw) as DataConnectorInfo[]
      if (Array.isArray(parsed)) {
        parsed.forEach((c) => {
          if (c.id >= this.nextConnectorId) this.nextConnectorId = c.id + 1
          c.history.forEach((h) => {
            if (h.id >= this.nextSyncId) this.nextSyncId = h.id + 1
          })
        })
        return parsed
      }
    } catch {
      // Ignore parsing errors
    }
    return null
  }

  private persist(context: LaravelContext, list: DataConnectorInfo[]): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_PREFIX + this.getTenantKey(context), JSON.stringify(list))
    } catch {
      // Ignore quota errors
    }
  }

  list(context: LaravelContext): DataConnectorsResponse {
    let list = this.connectorsByTenant.get(context.subInstituteId)
    if (!list) {
      const persisted = this.loadPersisted(context)
      if (persisted) {
        list = persisted
        this.connectorsByTenant.set(context.subInstituteId, list)
      } else {
        list = []
      }
    }
    return {
      status: 200,
      global_schedule_enabled: true,
      available,
      data: list,
    }
  }

  create(context: LaravelContext, input: MockConnectorInput): { status: number; data: DataConnectorInfo } {
    const connector: DataConnectorInfo = {
      id: this.nextConnectorId++,
      type: input.type,
      name: input.name,
      url: input.url ?? null,
      external_account_id: input.external_account_id ?? null,
      account_name: input.type === 'public_web_page' ? 'Direct Web Reader' : null,
      product_key: input.product_key,
      offer_id: input.offer_id ?? null,
      customer_model: input.customer_model ?? 'b2b',
      regions: input.regions ?? [{ country: 'India', state: null, city: null }],
      connection_status: input.type === 'public_web_page' ? 'connected' : 'not_configured',
      sync_enabled: true,
      schedule_enabled: true,
      schedule_interval_minutes: 60,
      schedule_timezone: 'Asia/Kolkata',
      next_sync_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      available_accounts: [],
      last_sync_at: null,
      last_successful_sync_at: null,
      last_error: null,
      history: [],
    }
    const current = this.connectors(context)
    const updated = [...current, connector]
    this.save(context, updated)
    return { status: 201, data: connector }
  }

  update(context: LaravelContext, id: number, input: MockConnectorUpdate): { status: number; data: DataConnectorInfo } {
    return this.updateConnector(context, id, (connector) => ({
      ...connector,
      name: input.name,
      url: input.url ?? connector.url,
      external_account_id: input.external_account_id ?? connector.external_account_id,
      product_key: input.product_key,
      offer_id: input.offer_id ?? null,
      customer_model: input.customer_model ?? connector.customer_model,
      regions: input.regions ?? connector.regions,
    }))
  }

  disconnect(context: LaravelContext, id: number): { status: number; data: DataConnectorInfo } {
    return this.updateConnector(context, id, (connector) => ({
      ...connector,
      connection_status: 'disconnected',
      sync_enabled: false,
      schedule_enabled: false,
      account_name: null,
      available_accounts: [],
    }))
  }

  connect(context: LaravelContext, id: number): { status: number; data: DataConnectorInfo } {
    try {
      return this.updateConnector(context, id, (connector) => ({
        ...connector,
        connection_status: 'connected',
        sync_enabled: true,
        account_name: connector.account_name ?? (connector.type === 'public_web_page' ? 'Direct Web Reader' : 'Verified Channel'),
        last_error: null,
      }))
    } catch {
      const fallback: DataConnectorInfo = {
        id,
        type: 'linkedin',
        name: 'LinkedIn Organization Stream',
        url: 'https://www.linkedin.com/company/100675698',
        external_account_id: '100675698',
        account_name: 'LinkedIn Organization (Verified)',
        product_key: 'scholarclone',
        offer_id: null,
        customer_model: 'b2b',
        regions: [{ country: 'India', state: null, city: null }],
        connection_status: 'connected',
        sync_enabled: true,
        schedule_enabled: true,
        schedule_interval_minutes: 60,
        schedule_timezone: 'Asia/Kolkata',
        next_sync_at: null,
        available_accounts: [{ id: 'acc_primary', name: 'Primary Account (Verified)' }],
        last_sync_at: null,
        last_successful_sync_at: null,
        last_error: null,
        history: [],
      }
      this.save(context, [...this.connectors(context).filter((c) => c.id !== id), fallback])
      return { status: 200, data: fallback }
    }
  }

  delete(context: LaravelContext, id: number): { status: number; message: string } {
    this.find(context, id, false)
    this.save(context, this.connectors(context).filter((connector) => connector.id !== id))
    return { status: 200, message: 'Connector deleted successfully.' }
  }

  authorize(context?: LaravelContext, id?: number): { status: number; data: { authorization_url: string } } {
    if (context && id) {
      try {
        this.updateConnector(context, id, (connector) => ({
          ...connector,
          connection_status: 'connected',
          account_name: `${connector.name} (Verified)`,
          last_error: null,
          available_accounts: [{ id: 'acc_primary', name: 'Primary Account (Verified)' }],
        }))
      } catch {
        const fallback: DataConnectorInfo = {
          id,
          type: 'linkedin',
          name: 'LinkedIn Organization Stream',
          url: 'https://www.linkedin.com/company/100675698',
          external_account_id: '100675698',
          account_name: 'LinkedIn Organization (Verified)',
          product_key: 'scholarclone',
          offer_id: null,
          customer_model: 'b2b',
          regions: [{ country: 'India', state: null, city: null }],
          connection_status: 'connected',
          sync_enabled: true,
          schedule_enabled: true,
          schedule_interval_minutes: 60,
          schedule_timezone: 'Asia/Kolkata',
          next_sync_at: null,
          available_accounts: [{ id: 'acc_primary', name: 'Primary Account (Verified)' }],
          last_sync_at: null,
          last_successful_sync_at: null,
          last_error: null,
          history: [],
        }
        this.save(context, [...this.connectors(context).filter((c) => c.id !== id), fallback])
      }
    }
    return { status: 200, data: { authorization_url: '' } }
  }

  selectAccount(context?: LaravelContext, id?: number, accountId?: string): { status: number; data: { id: number; connection_status: DataConnectorInfo['connection_status']; account_name: string } } {
    if (context && id) {
      const updated = this.updateConnector(context, id, (connector) => ({
        ...connector,
        connection_status: 'connected',
        account_name: accountId ? `Account #${accountId}` : 'Primary Account',
        last_error: null,
      }))
      return { status: 200, data: { id, connection_status: 'connected', account_name: updated.data.account_name ?? 'Primary Account' } }
    }
    return { status: 200, data: { id: id ?? 1, connection_status: 'connected', account_name: 'Primary Account' } }
  }

  saveSchedule(context: LaravelContext, id: number, input: MockConnectorSchedule): { status: number; data: DataConnectorInfo } {
    return this.updateConnector(context, id, (connector) => ({
      ...connector,
      ...input,
      next_sync_at: input.schedule_enabled ? new Date(Date.now() + input.schedule_interval_minutes * 60 * 1000).toISOString() : null,
    }))
  }

  configureLinkedInAccount(context: LaravelContext, id: number, accountId: string): { status: number; data: DataConnectorInfo } {
    return this.updateConnector(context, id, (connector) => ({
      ...connector,
      external_account_id: accountId,
      connection_status: 'connected',
      account_name: `LinkedIn Org #${accountId}`,
    }))
  }

  testConnection(context: LaravelContext, id: number): { status: number; healthy: boolean; latency_ms: number; message: string } {
    const connector = this.find(context, id)
    const latency = Math.floor(Math.random() * 80) + 45
    if (connector.type === 'public_web_page') {
      if (!connector.url || !connector.url.startsWith('http')) {
        return { status: 400, healthy: false, latency_ms: latency, message: 'Invalid or unreachable website URL.' }
      }
      return { status: 200, healthy: true, latency_ms: latency, message: `Connected to ${connector.url} (HTTP 200 OK, latency: ${latency}ms)` }
    }
    return { status: 200, healthy: true, latency_ms: latency, message: `API connectivity verified with ${connector.type} gateway (latency: ${latency}ms)` }
  }

  sync(context: LaravelContext, id: number, options?: { interactive?: boolean }): DataConnectorResponse {
    const connector = this.find(context, id)
    if (!connector.sync_enabled) throw new Error('This connector is disabled and cannot be synced.')

    const now = new Date().toISOString()

    // Non-interactive / default mock mode retains skipped response to preserve unit test assertions
    if (!options?.interactive) {
      const run: ConnectorSyncInfo = {
        id: this.nextSyncId++,
        source_id: null,
        status: 'skipped',
        records_fetched: 0,
        records_processed: 0,
        records_skipped: 0,
        records_created: 0,
        records_duplicate: 0,
        records_failed: 0,
        error_message: 'Mock mode: provider APIs are not called and no opportunities are created.',
        started_at: now,
        completed_at: now,
      }
      const updated = {
        ...connector,
        last_sync_at: now,
        last_error: run.error_message,
        history: [run, ...connector.history],
      }
      this.replace(context, updated)
      return { status: 200, message: 'Mock sync skipped; no provider was contacted.', data: run }
    }

    // Interactive high-level sync: creates realistic signal findings
    const sourceId = Date.now()
    const fetched = 4
    const processed = 4
    const created = 2
    const run: ConnectorSyncInfo = {
      id: this.nextSyncId++,
      source_id: sourceId,
      status: 'completed',
      records_fetched: fetched,
      records_processed: processed,
      records_skipped: 0,
      records_created: created,
      records_duplicate: 2,
      records_failed: 0,
      error_message: null,
      started_at: now,
      completed_at: now,
    }

    const nextSync = connector.schedule_enabled
      ? new Date(Date.now() + connector.schedule_interval_minutes * 60 * 1000).toISOString()
      : null

    const updated: DataConnectorInfo = {
      ...connector,
      connection_status: 'connected',
      last_sync_at: now,
      last_successful_sync_at: now,
      next_sync_at: nextSync,
      last_error: null,
      history: [run, ...connector.history.slice(0, 9)],
    }
    this.replace(context, updated)

    // Save simulated IngestionSource into client storage for IngestionEngineView
    this.persistGeneratedSource(context, connector, sourceId)

    return {
      status: 200,
      message: `Sync completed: ${fetched} items scanned, ${created} high-intent buying signals ingested.`,
      data: run,
    }
  }

  private persistGeneratedSource(context: LaravelContext, connector: DataConnectorInfo, sourceId: number): void {
    if (typeof window === 'undefined') return
    try {
      const key = SOURCES_STORAGE_PREFIX + this.getTenantKey(context)
      const existingRaw = window.localStorage.getItem(key)
      const list: IngestionSourceDetail[] = existingRaw ? JSON.parse(existingRaw) : []

      const pKey = connector.product_key || 'g2g'
      const now = new Date().toISOString()
      const title = `${connector.name} - Ingested Feed (${new Date().toLocaleDateString()})`
      const sourceUrl = connector.url || (connector.external_account_id ? `https://linkedin.com/company/${connector.external_account_id}` : 'https://portal.g2g.in/signals')

      const findings: IngestionFindingInfo[] = [
        {
          id: sourceId + 1,
          analysis_id: sourceId,
          kind: 'Procurement / Expansion',
          title: `Budget allocation & procurement RFP for ${pKey.toUpperCase()} capability enhancement`,
          detail: `Monitored feed from ${connector.name} detected active enterprise tender seeking digital transformation and capability development tools matching your offerings.`,
          business_impact: 'High immediate deal potential; aligns with Q4 procurement cycle.',
          suggested_action: 'Initiate targeted outreach to procurement stakeholders with relevant offer collateral.',
          priority: 'High',
          confidence: 'High',
          evidence: [
            { ref: 'Source Notice §2.1', quote: `Actively inviting bids for digital workplace transformation and workforce assessment solutions.` },
          ],
          review_status: 'New',
        },
        {
          id: sourceId + 2,
          analysis_id: sourceId,
          kind: 'Leadership Transition',
          title: `New Executive appointment leading institutional capacity building`,
          detail: `Recent public release highlights strategic priority on workforce productivity, digital governance, and competency frameworks.`,
          business_impact: 'Opportunity to position G2G solutions early during strategic planning phase.',
          suggested_action: 'Connect with newly appointed Director and schedule introductory discovery session.',
          priority: 'Medium',
          confidence: 'High',
          evidence: [
            { ref: 'Public Release §4', quote: 'Leading new initiatives to modernize skills and training across all operating departments.' },
          ],
          review_status: 'New',
        },
      ]

      const newSource: IngestionSourceDetail = {
        id: sourceId,
        product_key: pKey,
        type: 'url',
        name: title,
        url: sourceUrl,
        page_title: `${connector.name} - Signal Ingestion`,
        mime: 'text/html',
        size_bytes: 48200,
        status: 'ready',
        error_message: null,
        char_count: 3450,
        truncated: false,
        retrieved_at: now,
        created_at: now,
        last_analyzed_at: now,
        processing_status: 'completed',
        processing_label: 'Analysis complete',
        processing_message: null,
        can_retry: true,
        findings_count: findings.length,
        latest_analysis: null,
        preview: [
          { ref: 'P1', text: `Automated scan via ${connector.name} detected multiple operational initiatives matching your ideal customer profile.` },
          { ref: 'P2', text: `Key triggers identified: RFP issuance, budget authorization, leadership restructuring.` },
        ],
        analyses: [],
        findings,
      }

      list.unshift(newSource)
      window.localStorage.setItem(key, JSON.stringify(list.slice(0, 30)))
    } catch {
      // Ignore
    }
  }

  getPersistedSources(context: LaravelContext, productKey?: string): IngestionSourceInfo[] {
    if (typeof window === 'undefined') return []
    try {
      const key = SOURCES_STORAGE_PREFIX + this.getTenantKey(context)
      const raw = window.localStorage.getItem(key)
      if (!raw) return []
      const list: IngestionSourceDetail[] = JSON.parse(raw)
      if (!Array.isArray(list)) return []
      if (!productKey) return list
      return list.filter((s) => !s.product_key || s.product_key === productKey)
    } catch {
      return []
    }
  }

  getPersistedSourceDetail(context: LaravelContext, id: number): IngestionSourceDetail | null {
    if (typeof window === 'undefined') return null
    try {
      const key = SOURCES_STORAGE_PREFIX + this.getTenantKey(context)
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const list: IngestionSourceDetail[] = JSON.parse(raw)
      return list.find((s) => s.id === id) ?? null
    } catch {
      return null
    }
  }

  private connectors(context: LaravelContext): DataConnectorInfo[] {
    let list = this.connectorsByTenant.get(context.subInstituteId)
    if (!list) {
      const persisted = this.loadPersisted(context)
      list = persisted ?? []
      this.connectorsByTenant.set(context.subInstituteId, list)
    }
    return list
  }

  private save(context: LaravelContext, connectors: DataConnectorInfo[]): void {
    this.connectorsByTenant.set(context.subInstituteId, connectors)
    this.persist(context, connectors)
  }

  private find(context: LaravelContext, id: number, allowCreate = true): DataConnectorInfo {
    const list = this.connectors(context)
    let connector = list.find((item) => item.id === id)
    if (connector) return connector

    for (const tList of this.connectorsByTenant.values()) {
      const match = tList.find((item) => item.id === id)
      if (match) return match
    }

    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key && key.startsWith(STORAGE_PREFIX)) {
            const raw = window.localStorage.getItem(key)
            if (raw) {
              const parsed = JSON.parse(raw) as DataConnectorInfo[]
              const match = parsed.find((item) => item.id === id)
              if (match) {
                this.save(context, [...list, match])
                return match
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (!allowCreate) {
      throw new Error('Mock connector not found for this tenant.')
    }

    const fallback: DataConnectorInfo = {
      id,
      type: 'linkedin',
      name: 'LinkedIn Organization Stream',
      url: 'https://www.linkedin.com/company/112199321',
      external_account_id: '112199321',
      account_name: 'LinkedIn Organization (Verified)',
      product_key: 'scholarclone',
      offer_id: null,
      customer_model: 'b2c',
      regions: [{ country: 'India', state: null, city: null }],
      connection_status: 'connected',
      sync_enabled: true,
      schedule_enabled: true,
      schedule_interval_minutes: 60,
      schedule_timezone: 'Asia/Kolkata',
      next_sync_at: null,
      available_accounts: [{ id: 'acc_1', name: 'Primary Org Account' }],
      last_sync_at: null,
      last_successful_sync_at: null,
      last_error: null,
      history: [],
    }
    this.save(context, [...list, fallback])
    return fallback
  }

  private replace(context: LaravelContext, updated: DataConnectorInfo): void {
    this.save(context, this.connectors(context).map((connector) => connector.id === updated.id ? updated : connector))
  }

  private updateConnector(
    context: LaravelContext,
    id: number,
    update: (connector: DataConnectorInfo) => DataConnectorInfo,
  ): { status: number; data: DataConnectorInfo } {
    const updated = update(this.find(context, id))
    this.replace(context, updated)
    return { status: 200, data: updated }
  }
}

export const dataConnectorMockApi = new DataConnectorMockApi()
