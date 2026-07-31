const isProductionEnvironment = () => {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'production'
  }

  const hostname = window.location.hostname
  return !(
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.0.') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.test') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname)
  )
}

function normalizeApiBaseUrl(value: string | undefined) {
  return (value || '').trim().replace(/\/$/, '')
}

export function resolveApiBaseUrl() {
  const configuredBase = isProductionEnvironment()
    ? process.env.NEXT_PUBLIC_API_BASE_URL_PROD
    : process.env.NEXT_PUBLIC_API_BASE_URL_DEV

  const fallbackBase = process.env.NEXT_PUBLIC_API_URL || ''
  const rawBase = normalizeApiBaseUrl(configuredBase || fallbackBase)

  if (!rawBase) return '/api'

  return rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`
}

export function resolveWebBaseUrl() {
  const rawBase = resolveApiBaseUrl()
  if (rawBase === '/api') return ''
  return rawBase.endsWith('/api') ? rawBase.slice(0, -4) : rawBase
}

export function resolveHpApiBaseUrl() {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_HP_API_URL) || 'https://hp.triz.co.in'
}

export function resolveHpApiKey() {
  return process.env.NEXT_PUBLIC_HP_API_KEY || ''
}
