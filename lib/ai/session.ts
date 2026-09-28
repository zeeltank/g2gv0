'use client';

/**
 * The signed-in session, for the AI clients ported from LMS_K12 (the field assistant).
 *
 * Same export and shape as LMS_K12's `lib/ai/session.ts`; read from G2G's own session
 * (`readLaravelSession`) rather than LMS_K12's `userData`/`menuContext` keys. The token is
 * a Sanctum token, and the backend derives the organisation and user from it.
 */

import { readLaravelSession } from '@/lib/laravel-session';

export interface AiSession {
  /** Bearer token for `/api/ai/*`. */
  token: string;
  /** The signed-in organisation. Empty string when the session does not carry one. */
  instituteId: string;
  /** The signed-in user. Empty string when the session does not carry one. */
  userId: string;
  /** Per-deployment API host, when one is named. G2G resolves it from env instead. */
  baseUrl: string;
}

export function readAiSession(): AiSession | null {
  if (typeof window === 'undefined') return null;

  const session = readLaravelSession();

  if (!session?.token) return null;

  const record = session as unknown as Record<string, unknown>;

  return {
    token: String(session.token),
    instituteId: String(record.sub_institute_id ?? ''),
    userId: String(record.user_id ?? ''),
    baseUrl: '',
  };
}
