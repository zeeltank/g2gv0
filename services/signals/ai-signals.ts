import { apiClient } from '@/services/core'

/**
 * The AI signal sources in Signals > Ingestion Engine > Connectors: Claude, ChatGPT / GPT, DeepSeek and Gemini.
 *
 * The organisation's own scheduled tasks DELIVER finished signals to G2G; G2G imports them. Nothing here runs a model or fetches from a platform.
 * The organisation and the user come from the bearer token the shared client sends, never from a parameter. The delivery secret is returned ONCE, by
 * `enable` (the first time) and `rotate`; every later answer carries only a short hint of it.
 */
export type AiProviderKey = 'claude' | 'gpt' | 'deepseek' | 'gemini'

export type AiSlotState = 'not_configured' | 'no_secret' | 'off' | 'syncing' | 'error' | 'waiting' | 'pending' | 'ok'

/** A signal in a delivery that the quality checks rejected: which one, why, and how to fix the scheduled task. */
export interface AiRejection {
  index: number | null
  label: string | null
  reason_code: string | null
  reason: string | null
  hint: string | null
}

/** A look-alike organisation that was NOT merged with an existing one: a person decides whether they are the same. */
export interface AiLookAlike {
  index: number | null
  label: string | null
  id: number | null
  name: string | null
  similarity: number | null
}

export interface AiDeliverySummary {
  id: number
  status: 'received' | 'importing' | 'imported' | 'partial' | 'failed'
  via: 'webhook' | 'manual'
  delivery_ref: string | null
  records: number
  imported: number
  updated: number
  duplicate: number
  failed: number
  /** Signals not yet imported (a delivery that is still waiting or being imported). */
  pending: number
  message: string | null
  /** Why each rejected signal was rejected (the first 20), and how many more there are. */
  rejections: AiRejection[]
  rejections_more: number
  look_alikes: AiLookAlike[]
  received_at: string | null
  imported_at: string | null
}

export interface AiSignalSlot {
  provider: AiProviderKey
  label: string
  connector_id: number | null
  configured: boolean
  enabled: boolean
  state: AiSlotState
  state_label: string
  delivery_url: string
  token_hint: string | null
  token_created_at?: string | null
  last_received_at: string | null
  last_sync_at: string | null
  last_successful_sync_at?: string | null
  last_sync_status: string | null
  last_sync_message: string | null
  /** Set when an import has waited over a minute and no queue worker has taken it: what is missing, in words. */
  worker_hint?: string | null
  totals: { deliveries: number; imported: number; updated: number; duplicate: number; failed: number; failed_deliveries: number; waiting: number }
  recent: AiDeliverySummary[]
}

export interface AiSignalsOverview {
  status: number
  tables_migrated: boolean
  notice?: string
  delivery_url: string
  data: AiSignalSlot[]
}

export interface AiSecretAnswer {
  status: number
  /** The secret, in the answer ONCE (null when the source already had one). Never stored or logged by the screen. */
  secret: string | null
  data: AiSignalSlot
}

export interface AiSyncAnswer {
  status: number
  message: string
  data?: AiSignalSlot
  results?: Record<string, string>
}

/** What the screen needs from the server. Components take this shape, so a test can hand them a fake. */
export interface AiSignalsApi {
  list(): Promise<AiSignalsOverview>
  enable(provider: AiProviderKey, productKey?: string | null): Promise<AiSecretAnswer>
  rotate(provider: AiProviderKey): Promise<AiSecretAnswer>
  toggle(provider: AiProviderKey, enabled: boolean): Promise<{ status: number; data: AiSignalSlot }>
  sync(provider: AiProviderKey): Promise<AiSyncAnswer>
  syncAll(): Promise<AiSyncAnswer & { data?: never }>
  submit(provider: AiProviderKey, payload: string): Promise<AiSyncAnswer>
}

const root = '/signals/ingestion/ai-signals'

export const aiSignalsService: AiSignalsApi = {
  list: () => apiClient.get<AiSignalsOverview>(root),
  enable: (provider, productKey) => apiClient.post<AiSecretAnswer>(`${root}/${provider}/enable`, productKey ? { product_key: productKey } : {}),
  rotate: (provider) => apiClient.post<AiSecretAnswer>(`${root}/${provider}/token`, {}),
  toggle: (provider, enabled) => apiClient.put(`${root}/${provider}`, { enabled }),
  sync: (provider) => apiClient.post<AiSyncAnswer>(`${root}/${provider}/sync`, {}),
  syncAll: () => apiClient.post(`${root}/sync-all`, {}),
  submit: (provider, payload) => apiClient.post<AiSyncAnswer>(`${root}/${provider}/deliveries`, { payload }),
}
