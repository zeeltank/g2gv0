import type { NextRequest } from 'next/server'
import { resolveApiBaseUrl } from '@/lib/api-config'
import { dbQuery } from '@/lib/mcp/server/datasource/mariadb'

export interface AuthenticatedTenant {
  userId: number
  tenantId: number
}

/**
 * Resolves who is calling, for Next routes that read the CRM tables directly.
 *
 * The token is checked by the Laravel API itself (`/account/me`), the same authority every other
 * endpoint uses, rather than by reading its token table from here: the API that issued the token
 * is not necessarily backed by the database this process queries. The tenant is then the verified
 * user's own `tbluser.sub_institute_id`, the rule `ResolvesApiIdentity` applies on the Laravel side.
 *
 * Anything the browser puts in the request body (`sub_institute_id`, `user_id`) is ignored, so a
 * caller cannot send, read or log against another organisation.
 *
 * Returns null when the token is missing, rejected, or its owner has no tenant.
 */
export async function resolveAuthenticatedTenant(request: NextRequest): Promise<AuthenticatedTenant | null> {
  const authorization = request.headers.get('authorization') || ''
  if (!/^Bearer\s+\S+/i.test(authorization)) return null

  let response: Response
  try {
    response = await fetch(`${resolveApiBaseUrl()}/account/me`, {
      cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: authorization },
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const body = await response.json().catch(() => null)
  const userId = Number(body?.data?.profile?.id)
  if (!Number.isInteger(userId) || userId <= 0) return null

  const rows = await dbQuery<Array<{ sub_institute_id: number | null }>>(
    'SELECT sub_institute_id FROM tbluser WHERE id = ? LIMIT 1',
    [userId],
  )
  const tenantId = Number(rows?.[0]?.sub_institute_id ?? 0)

  return tenantId > 0 ? { userId, tenantId } : null
}
