/**
 * Plain-language explanations for connector states and OAuth return results.
 *
 * Every message says what happened, why (when known) and who has to act. No provider
 * response, token or stack trace ever flows through here: the backend sends only a
 * fixed status / reason code.
 */

export type ConnectorTone = 'success' | 'warning' | 'danger' | 'muted'

export interface ConnectorStatusInfo {
  label: string
  tone: ConnectorTone
  /** What the user or administrator should do next; null when nothing is needed. */
  action: string | null
}

export interface ProviderReadinessLike {
  ready?: boolean
  readiness_message?: string | null
  missing_config?: string[]
}

export function connectorStatusInfo(
  status: string,
  options: { oauth: boolean; providerReady?: boolean; needsAccount?: boolean },
): ConnectorStatusInfo {
  if (options.oauth && options.providerReady === false) {
    return {
      label: 'Configuration Required',
      tone: 'warning',
      action: 'An administrator must complete the one-time provider setup before this platform can be connected.',
    }
  }
  switch (status) {
    case 'connected':
      return { label: 'Connected', tone: 'success', action: null }
    case 'rate_limited':
      return { label: 'Rate Limited', tone: 'warning', action: 'The platform is throttling requests. Syncing resumes automatically; no action is needed.' }
    case 'token_expired':
      return { label: 'Token Expired', tone: 'danger', action: 'Authorization expired or was revoked. Click Reconnect and approve access again.' }
    case 'permission_required':
      return options.needsAccount
        ? { label: 'Choose Account', tone: 'warning', action: 'Authorization succeeded. Choose the account to monitor to finish setup.' }
        : { label: 'Permission Missing', tone: 'danger', action: 'The platform did not grant the required permission. Reconnect and allow every requested permission.' }
    case 'error':
      return { label: 'Connection Error', tone: 'danger', action: 'See the message below. Retry; if it persists contact an administrator.' }
    case 'disconnected':
      return { label: 'Disconnected', tone: 'muted', action: options.oauth ? 'Click Connect to authorize again.' : 'Click Connect to re-enable this connector.' }
    case 'not_configured':
    default:
      return options.oauth
        ? { label: 'Authorization Required', tone: 'warning', action: 'Click Connect Account to sign in with the platform.' }
        : { label: 'Not synced yet', tone: 'muted', action: 'Click Sync Now to fetch the page for the first time.' }
  }
}

export interface OAuthReturn {
  result: 'success' | 'pending' | 'error'
  reason: string | null
  connectorId: number | null
}

/** Reads the `connector_oauth`, `reason` and `connector_id` parameters the OAuth callback redirects back with. */
export function parseOAuthReturn(search: string): OAuthReturn | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const result = params.get('connector_oauth')
  if (result !== 'success' && result !== 'pending' && result !== 'error') return null
  const id = Number(params.get('connector_id'))
  return {
    result,
    reason: params.get('reason'),
    connectorId: Number.isInteger(id) && id > 0 ? id : null,
  }
}

const OAUTH_ERRORS: Record<string, string> = {
  invalid_state:
    'The authorization session expired or was already used (it is valid for 10 minutes and works once). Click Connect to start again.',
  cancelled: 'Authorization was cancelled before it finished. Click Connect to try again.',
  provider_denied: 'The platform refused the request. Check that the app is approved for the permissions it asks for, then try again.',
  missing_code: 'The platform returned without an authorization code. Click Connect to try again.',
  permission_required: 'A required permission was not granted. Connect again and allow every requested permission.',
  token_expired: 'The platform rejected the authorization. Connect again.',
  rate_limited: 'The platform is rate limiting requests. Wait a few minutes and try again.',
  exchange_failed: 'The authorization could not be completed. Try again; if it persists contact an administrator.',
  connector_missing: 'This connector no longer exists. Add it again.',
  not_migrated: 'Connector storage is not set up on the server. Contact an administrator.',
  error: 'The platform returned an error. The connector card shows the details.',
}

export function oauthReturnMessage(value: OAuthReturn): { tone: 'success' | 'warning' | 'danger'; text: string } {
  if (value.result === 'success') {
    return { tone: 'success', text: 'Account connected. You can now sync this connector.' }
  }
  if (value.result === 'pending') {
    return { tone: 'warning', text: 'Authorization succeeded. Choose the account to monitor to finish setup.' }
  }
  return { tone: 'danger', text: OAUTH_ERRORS[value.reason ?? ''] ?? OAUTH_ERRORS.error }
}

/** Honest result for the "Test" button: derived from stored connector state, never from a simulated ping. */
export function connectorHealth(
  connector: { connection_status: string; last_error: string | null },
  oauth: boolean,
): { healthy: boolean; message: string } {
  if (connector.connection_status === 'connected') {
    return { healthy: true, message: 'The server reports this connector as connected. Use Sync Now to fetch fresh content.' }
  }
  const info = connectorStatusInfo(connector.connection_status, { oauth })
  return { healthy: false, message: connector.last_error || info.action || info.label }
}

export interface SyncRunLike {
  status: string
}

const ACTIVE_SYNC = new Set(['queued', 'running'])

/** True while a sync is waiting for a worker or running. History is newest first, as the API sends it. */
export function isSyncActive(history: SyncRunLike[]): boolean {
  return history.some((run) => ACTIVE_SYNC.has(run.status))
}

/** Newest sync's status, or null when the connector has never been synced. */
export function latestSyncStatus(history: SyncRunLike[]): string | null {
  return history[0]?.status ?? null
}

/** What the Sync Now button says and whether it may be pressed, from the server's own sync history. */
export function syncButtonState(history: SyncRunLike[]): { label: string; disabled: boolean; hint: string | null } {
  const latest = latestSyncStatus(history)
  if (latest === 'running') {
    return { label: 'Syncing…', disabled: true, hint: 'A sync is running. This page refreshes until it finishes.' }
  }
  if (latest === 'queued') {
    return { label: 'Queued', disabled: true, hint: 'A sync is queued and waiting for a worker. It is closed as failed with the worker command if none starts it within about 10 minutes.' }
  }
  return { label: 'Sync Now', disabled: false, hint: null }
}

/** Plain label and tone for a finished or running sync row. `partial` and `skipped` are not shown as in progress. */
export function syncRunDisplay(status: string): { label: string; tone: ConnectorTone } {
  switch (status) {
    case 'completed':
      return { label: 'Completed', tone: 'success' }
    case 'partial':
      return { label: 'Partial', tone: 'warning' }
    case 'skipped':
      return { label: 'Skipped', tone: 'muted' }
    case 'failed':
      return { label: 'Failed', tone: 'danger' }
    case 'running':
      return { label: 'Running', tone: 'warning' }
    case 'queued':
      return { label: 'Queued', tone: 'muted' }
    default:
      return { label: status, tone: 'muted' }
  }
}

/** The text shown after pressing Sync Now: the server's own message, or an honest queued line. Never "synced". */
export function syncRequestedMessage(serverMessage: string | null | undefined, connectorName: string): string {
  const text = (serverMessage ?? '').trim()
  return text !== '' ? text : `A sync for ${connectorName} was queued. It starts when a worker picks it up.`
}

/**
 * Connectors whose newest sync went from queued/running to completed or partial between two loads, i.e. new content may now exist.
 * Used to refresh the signals list once, when work finishes, rather than when it is merely queued.
 */
export function finishedSyncs(previous: Record<number, string>, current: Array<{ id: number; history: SyncRunLike[] }>): number[] {
  return current
    .filter((connector) => {
      const before = previous[connector.id]
      const now = latestSyncStatus(connector.history)
      return before !== undefined && ACTIVE_SYNC.has(before) && (now === 'completed' || now === 'partial')
    })
    .map((connector) => connector.id)
}

/** Snapshot for finishedSyncs(): connector id → newest sync status (connectors that never synced are left out). */
export function latestStatuses(connectors: Array<{ id: number; history: SyncRunLike[] }>): Record<number, string> {
  const snapshot: Record<number, string> = {}
  for (const connector of connectors) {
    const status = latestSyncStatus(connector.history)
    if (status !== null) snapshot[connector.id] = status
  }
  return snapshot
}
