/*
 * Connector Settings: the provider application credentials an administrator enters in the app. Pure logic only (no network, no React), so the rules
 * that protect a saved secret are tested on their own.
 *
 * The server never sends a secret. A saved secret reaches the browser only as a boolean (`secret_saved`) and a fixed mask. The form therefore never
 * holds the real value: an empty secret field means "keep what is saved", and the mask is never sent back as if it were a new secret.
 */

export type SettingsProviderKey = 'youtube' | 'linkedin' | 'meta'
export type SettingsStatus = 'not_configured' | 'configuration_invalid' | 'authorization_required' | 'connected'

export interface ProviderSettings {
  provider: SettingsProviderKey
  label: string
  connector_types: string[]
  configured: boolean
  valid: boolean
  status: SettingsStatus
  source: 'database' | 'environment' | 'none'
  /** The client id of credentials saved here (not secret). Null when the credentials come from the server or are not set. */
  client_id: string | null
  secret_saved: boolean
  secret_mask: string | null
  /** Meta only: the Facebook Login for Business Configuration ID saved here (not secret). */
  login_config_id?: string | null
  updated_at: string | null
  missing_config: string[]
  invalid_config: string[]
  message: string | null
  redirect_uri: string | null
  requirements: string[]
  scopes: string[]
  approval: string | null
  connected_accounts: number
  can_remove: boolean
}

export interface SettingsTestResult {
  provider: SettingsProviderKey
  status: SettingsStatus
  local: { configured: boolean; valid: boolean; missing_config: string[]; invalid_config: string[]; message: string | null }
  provider_check: { result: 'accepted' | 'rejected' | 'unverified' | 'unreachable' | 'not_checked'; message: string }
  connected_accounts: number
  next_step: string
}

/** The four cards the screen shows. Facebook and Instagram are two cards served by ONE Meta application. */
export type CardKey = 'youtube' | 'linkedin' | 'facebook_page' | 'instagram_business'

export interface ProviderCard {
  key: CardKey
  provider: SettingsProviderKey
  connectorType: 'youtube' | 'linkedin' | 'facebook_page' | 'instagram_business'
  title: string
  summary: string
  settings: ProviderSettings
}

const CARDS: Array<Omit<ProviderCard, 'settings'>> = [
  { key: 'youtube', provider: 'youtube', connectorType: 'youtube', title: 'YouTube', summary: 'Reads the videos of a channel you authorise.' },
  { key: 'linkedin', provider: 'linkedin', connectorType: 'linkedin', title: 'LinkedIn', summary: 'Reads the posts of an organisation page you administer.' },
  { key: 'facebook_page', provider: 'meta', connectorType: 'facebook_page', title: 'Facebook', summary: 'Reads the posts of a Page you manage.' },
  { key: 'instagram_business', provider: 'meta', connectorType: 'instagram_business', title: 'Instagram', summary: 'Reads the media of a Business or Creator account. Uses the same Meta app as Facebook.' },
]

export function providerCards(providers: ProviderSettings[]): ProviderCard[] {
  const byProvider = new Map(providers.map((p) => [p.provider, p]))
  return CARDS.flatMap((card) => {
    const settings = byProvider.get(card.provider)
    return settings ? [{ ...card, settings }] : []
  })
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted'

/** What a card says about its provider. Configured is not connected: only a real connected account turns it green. */
export function cardStatus(settings: Pick<ProviderSettings, 'status' | 'source'>): { label: string; tone: Tone; hint: string } {
  switch (settings.status) {
    case 'not_configured':
      return { label: 'Setup Required', tone: 'warning', hint: 'Add the application credentials to start.' }
    case 'configuration_invalid':
      return { label: 'Configuration Invalid', tone: 'danger', hint: 'The saved values do not look valid. Check and save them again.' }
    case 'authorization_required':
      return { label: 'Ready to Connect', tone: 'info', hint: 'Credentials are in place. Connect an account to authorise access.' }
    case 'connected':
      return { label: 'Connected', tone: 'success', hint: 'At least one account is connected.' }
  }
}

/** One line for the header: how many providers can be connected (or already are). */
export function overallStatus(cards: ProviderCard[]): { label: string; tone: Tone } {
  if (cards.length === 0) return { label: 'Loading', tone: 'muted' }
  const ready = cards.filter((c) => c.settings.status === 'authorization_required' || c.settings.status === 'connected').length
  const invalid = cards.some((c) => c.settings.status === 'configuration_invalid')
  if (ready === cards.length) return { label: 'All providers ready', tone: 'success' }
  if (invalid) return { label: `${ready} of ${cards.length} ready · needs attention`, tone: 'danger' }
  return { label: `${ready} of ${cards.length} ready`, tone: ready === 0 ? 'warning' : 'info' }
}

export interface SettingsForm {
  clientId: string
  clientSecret: string
  /** Meta only. */
  loginConfigId?: string
}

export interface SavePayload {
  client_id?: string
  client_secret?: string
  login_config_id?: string
}

/**
 * What to send when Save is pressed, and why it may not be sent.
 *  - A field left empty is not sent: the saved value stays.
 *  - The client id is sent only when it differs from the saved one.
 *  - The secret is sent only when something was typed, and the mask is never a secret.
 *  - A first save needs both.
 */
export function buildSavePayload(form: SettingsForm, current: Pick<ProviderSettings, 'client_id' | 'secret_saved' | 'secret_mask' | 'source'> & { login_config_id?: string | null }): { payload: SavePayload; problems: string[] } {
  const id = form.clientId.trim()
  const secret = form.clientSecret.trim()
  const typedSecret = secret !== '' && secret !== (current.secret_mask ?? '')
  const savedHere = current.source === 'database'
  const payload: SavePayload = {}
  if (id !== '' && (!savedHere || id !== (current.client_id ?? ''))) payload.client_id = id
  if (typedSecret) payload.client_secret = secret
  const configId = (form.loginConfigId ?? '').trim()
  if (configId !== '' && configId !== (current.login_config_id ?? '')) payload.login_config_id = configId

  const problems: string[] = []
  if (!savedHere) {
    // Nothing saved in the app yet (the server may supply credentials, but a saved override needs both halves).
    if (id === '') problems.push('Enter the client ID.')
    if (!typedSecret) problems.push('Enter the client secret.')
  } else if (Object.keys(payload).length === 0) {
    problems.push('Nothing to save. Change a value, or close this window.')
  }
  return { payload, problems }
}

export function formFor(current: (Pick<ProviderSettings, 'client_id'> & { login_config_id?: string | null }) | null): SettingsForm {
  const configId = current?.login_config_id ?? ''
  return { clientId: current?.client_id ?? '', clientSecret: '', ...(configId !== '' ? { loginConfigId: configId } : {}) }
}

/** "Updated 12 Nov 2026" or null. Never throws on a bad date. */
export function updatedLabel(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return `Updated ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

/** The result of Test Configuration as two plain lines, kept separate: this app's settings, and what the provider said. */
export function describeTest(result: SettingsTestResult): { configuration: { text: string; tone: Tone }; provider: { text: string; tone: Tone } } {
  const configuration: { text: string; tone: Tone } = result.local.valid
    ? { text: 'Configuration is valid.', tone: 'success' }
    : result.local.configured
      ? { text: result.local.message ?? 'The saved values do not look valid.', tone: 'danger' }
      : { text: 'Not configured yet.', tone: 'warning' }
  const tone: Record<SettingsTestResult['provider_check']['result'], Tone> = { accepted: 'success', rejected: 'danger', unverified: 'muted', unreachable: 'warning', not_checked: 'muted' }
  return { configuration, provider: { text: result.provider_check.message, tone: tone[result.provider_check.result] } }
}
