/**
 * Follow-up state for the Conversational AI.
 *
 * Each chat request is stateless: the browser sends the message transcript, and
 * only the *text* of previous answers survives. That is not enough for a
 * follow-up like "show me their names" or "what about Division C", because the
 * filters and the resolved ids behind the previous answer are gone.
 *
 * So the last data-backed query of a session is remembered here and replayed
 * into the system prompt as conversation state. The model can then either reuse
 * those filters verbatim or change one of them.
 *
 * In-memory, per process, bounded - the same approach and lifetime as
 * ./history.service.ts, which already stores the message transcript this way.
 */

export interface FollowUpQueryState {
  dataset: string;
  moduleId?: string;
  label?: string;
  source?: string;
  filters: Record<string, unknown>;
  resolvedEntities: Array<{ kind: string; query: string; id: string; name: string }>;
  rowCount?: number;
  status: string;
  at: string;
}

export interface FollowUpSessionState {
  sessionId: string;
  userId: string;
  /** Most recent first. */
  queries: FollowUpQueryState[];
  updatedAt: string;
}

const MAX_TRACKED_QUERIES = 5;
const MAX_SESSIONS = 500;

const followUpSessions = new Map<string, FollowUpSessionState>();

function getSessionKey(userId: string, sessionId: string) {
  return `${userId}:${sessionId}`;
}

/** Cheap FIFO eviction so a long-running dev server cannot grow unbounded. */
function evictIfNeeded() {
  if (followUpSessions.size <= MAX_SESSIONS) return;

  const oldestKey = followUpSessions.keys().next().value;
  if (oldestKey) followUpSessions.delete(oldestKey);
}

export function recordFollowUpQuery(
  params: { userId: string; sessionId: string },
  query: Omit<FollowUpQueryState, "at">
) {
  const key = getSessionKey(params.userId, params.sessionId);
  const current = followUpSessions.get(key);

  const entry: FollowUpQueryState = { ...query, at: new Date().toISOString() };

  const next: FollowUpSessionState = {
    sessionId: params.sessionId,
    userId: params.userId,
    queries: [entry, ...(current?.queries ?? [])].slice(0, MAX_TRACKED_QUERIES),
    updatedAt: entry.at,
  };

  followUpSessions.delete(key);
  followUpSessions.set(key, next);
  evictIfNeeded();

  return next;
}

export function getFollowUpState(userId: string, sessionId: string) {
  return followUpSessions.get(getSessionKey(userId, sessionId)) || null;
}

export function clearFollowUpState(userId: string, sessionId?: string) {
  if (sessionId) {
    followUpSessions.delete(getSessionKey(userId, sessionId));
    return;
  }

  for (const key of [...followUpSessions.keys()]) {
    if (key.startsWith(`${userId}:`)) followUpSessions.delete(key);
  }
}

function describeFilters(filters: Record<string, unknown>) {
  const entries = Object.entries(filters).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      !(Array.isArray(value) && value.length === 0)
  );

  if (!entries.length) return "none";

  return entries
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("|") : String(value)}`)
    .join(", ");
}

/**
 * Renders the remembered queries for the system prompt. Kept terse - it is
 * context, not instructions.
 */
export function describeFollowUpState(
  state: FollowUpSessionState | null
): string | null {
  if (!state?.queries.length) return null;

  const lines = state.queries.map((query, index) => {
    const parts = [
      `${index === 0 ? "most recent" : `${index + 1} turns back`}: dataset=${query.dataset}`,
      `filters=${describeFilters(query.filters)}`,
      `outcome=${query.status}`,
    ];

    if (query.rowCount !== undefined) parts.push(`rows=${query.rowCount}`);

    if (query.resolvedEntities.length) {
      parts.push(
        `resolved=${query.resolvedEntities
          .map((entity) => `${entity.kind} "${entity.query}" -> id ${entity.id} (${entity.name})`)
          .join("; ")}`
      );
    }

    return `- ${parts.join(", ")}`;
  });

  return lines.join("\n");
}
