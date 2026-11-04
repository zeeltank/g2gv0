import type { LaravelContext } from '@/lib/laravel-context'
import type {
  ConnectorSyncInfo,
  DataConnectorInfo,
  DataConnectorResponse,
  DataConnectorsResponse,
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

export class DataConnectorMockApi {
  private readonly connectorsByTenant = new Map<string, DataConnectorInfo[]>()
  private nextConnectorId = 1
  private nextSyncId = 1

  list(context: LaravelContext): DataConnectorsResponse {
    return {
      status: 200,
      global_schedule_enabled: false,
      available,
      data: this.connectorsByTenant.get(context.subInstituteId) ?? [],
    }
  }

  create(context: LaravelContext, input: MockConnectorInput): { status: number; data: DataConnectorInfo } {
    const connector: DataConnectorInfo = {
      id: this.nextConnectorId++,
      type: input.type,
      name: input.name,
      url: input.url ?? null,
      external_account_id: input.external_account_id ?? null,
      account_name: null,
      product_key: input.product_key,
      offer_id: input.offer_id ?? null,
      customer_model: input.customer_model ?? 'b2b',
      regions: input.regions ?? null,
      connection_status: input.type === 'public_web_page' ? 'disconnected' : 'not_configured',
      sync_enabled: true,
      schedule_enabled: false,
      schedule_interval_minutes: 1440,
      schedule_timezone: 'UTC',
      next_sync_at: null,
      available_accounts: [],
      last_sync_at: null,
      last_successful_sync_at: null,
      last_error: null,
      history: [],
    }
    this.save(context, [...this.connectors(context), connector])
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

  delete(context: LaravelContext, id: number): { status: number; message: string } {
    this.find(context, id)
    this.save(context, this.connectors(context).filter((connector) => connector.id !== id))
    return { status: 200, message: 'Connector deleted successfully.' }
  }

  authorize(): never {
    throw new Error('OAuth is unavailable in connector mock mode. No provider account is connected.')
  }

  selectAccount(): never {
    throw new Error('No provider accounts are available in connector mock mode.')
  }

  saveSchedule(context: LaravelContext, id: number, input: MockConnectorSchedule): { status: number; data: DataConnectorInfo } {
    return this.updateConnector(context, id, (connector) => ({
      ...connector,
      ...input,
      next_sync_at: null,
    }))
  }

  configureLinkedInAccount(context: LaravelContext, id: number, accountId: string): { status: number; data: DataConnectorInfo } {
    return this.updateConnector(context, id, (connector) => ({
      ...connector,
      external_account_id: accountId,
    }))
  }

  sync(context: LaravelContext, id: number): DataConnectorResponse {
    const connector = this.find(context, id)
    if (!connector.sync_enabled) throw new Error('This connector is disabled and cannot be synced.')

    const now = new Date().toISOString()
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

  private connectors(context: LaravelContext): DataConnectorInfo[] {
    return this.connectorsByTenant.get(context.subInstituteId) ?? []
  }

  private save(context: LaravelContext, connectors: DataConnectorInfo[]): void {
    this.connectorsByTenant.set(context.subInstituteId, connectors)
  }

  private find(context: LaravelContext, id: number): DataConnectorInfo {
    const connector = this.connectors(context).find((item) => item.id === id)
    if (!connector) throw new Error('Mock connector not found for this tenant.')
    return connector
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
