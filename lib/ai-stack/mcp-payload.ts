/**
 * Reading an MCP tool envelope, without knowing which tool sent it.
 *
 * WHY THIS LIVES HERE AND NOT INSIDE A SCREEN
 *
 * The Knowledge Base tab's Check button needs two things out of a tool's answer: how many
 * rows the whole result set holds, and the rows themselves. The module example panel needs
 * the same two, on every module, automatically. That is one piece of knowledge about the
 * shape of an MCP payload, and two copies of it is how the second one starts disagreeing
 * with the first about what a row count is.
 *
 * DELIBERATELY DEFENSIVE RATHER THAN TYPED
 *
 * Different tools return their payload under different keys, and none of this may invent
 * a number it did not read. A shape it does not recognise reports "answered, no count" and
 * an empty row list, which is honest — better than claiming zero rows because the count
 * was somewhere else.
 */

/** One tool's rows, as the generic records the UI renders. */
export type McpRow = Record<string, unknown>;

/**
 * The longest array of objects in a payload.
 *
 * A payload often carries several arrays — a list of rows beside a list of unresolved
 * filters. The longest is the answer; the others describe the query, and picking one of
 * those is how a check reports the number of search terms it used.
 */
export function firstList(source: Record<string, unknown> | undefined): McpRow[] | null {
  if (!source) return null;

  let best: McpRow[] | null = null;

  for (const value of Object.values(source)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    if (typeof value[0] !== 'object' || value[0] === null) continue;
    if (!best || value.length > best.length) best = value as McpRow[];
  }

  return best;
}

/** The three places a tool may put its answer, in the order they are trusted. */
function envelopes(payload: Record<string, unknown> | null): (Record<string, unknown> | undefined)[] {
  if (!payload) return [];
  return [payload, payload.data as Record<string, unknown> | undefined, payload.result as Record<string, unknown> | undefined];
}

/**
 * Turn an MCP envelope into a row count and a short sentence.
 *
 * `count` is read BEFORE any array, and that ordering matters. Every tool in this platform
 * reports `count` as the whole result set before its own limit, while the array beside it
 * is the page. Finding the array first would report a fifty-row page of eight hundred
 * records as "50 rows", which is the number these panels exist to stop people believing.
 */
export function summariseMcpPayload(payload: Record<string, unknown> | null): { rows: number | null; detail: string } {
  if (!payload) return { rows: null, detail: '' };

  const result = payload.result as Record<string, unknown> | undefined;
  const data = payload.data as Record<string, unknown> | undefined;

  const error = payload.error ?? result?.error;
  if (typeof error === 'string' && error.trim()) return { rows: null, detail: error };

  for (const source of [payload, data, result]) {
    const count = source?.count ?? source?.total;
    if (typeof count === 'number') {
      const list = firstList(source);
      return {
        rows: count,
        detail: list && list.length !== count ? `${list.length} shown` : '',
      };
    }
  }

  for (const source of [payload, data, result]) {
    const list = firstList(source);
    if (list) {
      const first = list[0];
      const keys = first ? Object.keys(first).slice(0, 4) : [];
      return { rows: list.length, detail: keys.length ? keys.join(', ') : '' };
    }
  }

  return { rows: null, detail: '' };
}

/**
 * The records a tool actually returned, for a panel that shows real rows.
 *
 * Separate from `summariseMcpPayload` because the count and the rows answer different
 * questions and are not always both present: a tool may report eight hundred matches and
 * return a summary shape, or return rows and report no total. Neither call fabricates the
 * other's answer.
 */
export function mcpRows(payload: Record<string, unknown> | null): McpRow[] {
  for (const source of envelopes(payload)) {
    const list = firstList(source);
    if (list) return list;
  }

  return [];
}

/** The error a tool reported, if it reported one, as a sentence rather than a code. */
export function mcpError(payload: Record<string, unknown> | null): string {
  if (!payload) return '';

  const result = payload.result as Record<string, unknown> | undefined;
  const error = payload.error ?? result?.error;

  return typeof error === 'string' && error.trim() ? error : '';
}
