import type { User } from '@/components/auth/gtg-auth'

export type LaravelContext = {
  token: string
  subInstituteId: string
  syear: string
  userId: string
}

function readStorageValue(keys: string[]) {
  if (typeof window === 'undefined') return ''

  for (const key of keys) {
    const value = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
    if (value) return value
  }

  return ''
}

function readJsonStorageValue(storageKey: string, keys: string[]) {
  if (typeof window === 'undefined') return ''

  const raw = window.localStorage.getItem(storageKey) ?? window.sessionStorage.getItem(storageKey)
  if (!raw) return ''

  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    for (const key of keys) {
      const value = data[key]
      if (typeof value === 'string' || typeof value === 'number') return String(value)
    }
  } catch {
    return ''
  }

  return ''
}

export function getLaravelContext(user?: User | null): LaravelContext {
  const token =
    readStorageValue(['token', 'authToken', 'access_token', 'laravel_token']) ||
    readJsonStorageValue('userData', ['token', 'access_token']) ||
    readJsonStorageValue('gtg-session', ['token']) ||
    process.env.NEXT_PUBLIC_HP_API_TOKEN ||
    ''

  const subInstituteId =
    readStorageValue(['sub_institute_id', 'subInstituteId']) ||
    readJsonStorageValue('userData', ['sub_institute_id', 'subInstituteId']) ||
    process.env.NEXT_PUBLIC_HP_SUB_INSTITUTE_ID ||
    '1'

  const syear =
    readStorageValue(['syear', 'school_year']) ||
    readJsonStorageValue('userData', ['syear', 'school_year']) ||
    process.env.NEXT_PUBLIC_HP_SYEAR ||
    String(new Date().getFullYear())

  const userId =
    readStorageValue(['user_id', 'userId']) ||
    readJsonStorageValue('userData', ['user_id', 'userId', 'id']) ||
    process.env.NEXT_PUBLIC_HP_USER_ID ||
    user?.id.replace(/\D/g, '') ||
    '1'

  return { token, subInstituteId, syear, userId }
}

export function withLaravelParams(context: LaravelContext, extra?: Record<string, string>) {
  return {
    token: context.token,
    sub_institute_id: context.subInstituteId,
    syear: context.syear,
    user_id: context.userId,
    type: 'API',
    ...extra,
  }
}
