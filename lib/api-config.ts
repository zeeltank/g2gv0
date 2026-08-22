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

/**
 * The host serving `/get-kaba`.
 *
 * This is deliberately its own variable rather than `resolveApiBaseUrl()`,
 * because the two are NOT the same deployment - measured:
 *
 *     hp.triz.co.in/get-kaba   -> 200
 *     erp.triz.co.in/get-kaba  -> 404      (NEXT_PUBLIC_API_BASE_URL_PROD)
 *
 * so folding this into the main base URL would fix local and break production.
 *
 * The previous `|| 'https://hp.triz.co.in'` fallback is gone. With the variable
 * unset it silently sent every local Competency Rating request to a remote
 * production host, carrying a local tenant's ids - which is why that tab 404ed
 * on localhost. An unset value is now loud instead of quietly cross-origin.
 */
export function resolveHpApiBaseUrl() {
  const configured = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_HP_API_URL)

  if (!configured) {
    throw new Error(
      'NEXT_PUBLIC_HP_API_URL is not set. It must name the host that serves /get-kaba ' +
        '- your own backend locally, and hp.triz.co.in in production. See lib/api-config.ts.',
    )
  }

  return configured
}

// `resolveHpApiKey()` REMOVED 2026-08-12. It had TWO consumers, both removed
// with it:
//   app/api/jobrole-tasks/route.ts          deleted (dead route, see its REMOVED.md)
//   services/organization/employee-profile-service.ts   api_key param dropped
//
// I first wrote "its only consumer" here after grepping app/ components/ lib/
// hooks/ - and missing services/. THE SEARCH SCOPE WAS THE ERROR, not the
// finding: a claim about a population made from part of it.
//
// THE LARAVEL BACKEND HAS NO INBOUND api_key MECHANISM. All four backend
// mentions of api_key are OUTBOUND third-party keys (gemini, google/youtube,
// deepseek, gamma). Sending one to hp_erp attached a credential nobody reads.
//
// A CREDENTIAL NOBODY CHECKS IS WORSE THAN NONE, because it reads as protection:
// a developer deciding whether an endpoint needs a guard would see a key on the
// wire and move on. Removing it is not a security change - nothing was
// protecting anything - it removes a FALSE SIGNAL.
