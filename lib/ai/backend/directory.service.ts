/**
 * Entity resolution for the Conversational AI.
 *
 * Laravel wants ids (department_id, employee_id, leave_type_id) while people
 * speak in names ("Engineering", "Rahul", "Sick Leave"). Every dataset call
 * therefore goes through here first.
 *
 * The lookup source is the *existing* `GET /api/leave/options` endpoint
 * (App\Http\Controllers\Api\Leave\LeaveOptionsController), which already
 * returns every active employee, department and leave type for the tenant in a
 * single round trip - the same call the Leave screens make to fill their
 * dropdowns. No new backend endpoint is needed for this.
 *
 * Ambiguity is never resolved by guessing. Two employees called "Rahul" produce
 * an `ambiguous` result carrying both candidates, and the assistant is expected
 * to ask which one is meant.
 */

import {
  laravelRequest,
  type LaravelRuntimeContext,
} from "./laravel-gateway";

export type EntityKind = "employee" | "department" | "leaveType";

export interface DirectoryEntry {
  id: string;
  name: string;
  employeeNo?: string | null;
  departmentId?: string | null;
  department?: string | null;
  code?: string | null;
}

export interface DirectorySnapshot {
  employees: DirectoryEntry[];
  departments: DirectoryEntry[];
  leaveTypes: DirectoryEntry[];
}

export type ResolutionResult =
  | { status: "resolved"; kind: EntityKind; match: DirectoryEntry }
  | {
      status: "ambiguous";
      kind: EntityKind;
      query: string;
      candidates: DirectoryEntry[];
    }
  | {
      status: "not_found";
      kind: EntityKind;
      query: string;
      suggestions: DirectoryEntry[];
    }
  | { status: "unavailable"; kind: EntityKind; query: string; message: string };

interface LeaveOptionsPayload {
  data?: {
    departments?: Array<{ value?: string; label?: string }>;
    employees?: Array<{
      value?: string;
      label?: string;
      employee_no?: string | null;
      department_id?: string | null;
      department?: string | null;
    }>;
    leave_types?: Array<{ value?: string; label?: string; code?: string | null }>;
  };
}

/**
 * The directory is stable within a conversation turn but can change between
 * them, so it is cached briefly per tenant rather than for the process
 * lifetime. Keyed by sub_institute_id because the payload is tenant scoped.
 */
const CACHE_TTL_MS = 60_000;
const snapshotCache = new Map<
  string,
  { snapshot: DirectorySnapshot; expiresAt: number }
>();

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function loadDirectorySnapshot(
  context: LaravelRuntimeContext
): Promise<
  { ok: true; snapshot: DirectorySnapshot } | { ok: false; message: string }
> {
  const cacheKey = String(context.subInstituteId || "unknown");
  const cached = snapshotCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, snapshot: cached.snapshot };
  }

  const result = await laravelRequest<LeaveOptionsPayload>(
    context,
    "/leave/options"
  );

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const data = result.data?.data ?? {};

  const snapshot: DirectorySnapshot = {
    employees: (data.employees ?? [])
      .filter((row) => row.value && row.label)
      .map((row) => ({
        id: String(row.value),
        name: String(row.label),
        employeeNo: row.employee_no ?? null,
        departmentId: row.department_id ?? null,
        department: row.department ?? null,
      })),
    departments: (data.departments ?? [])
      .filter((row) => row.value && row.label)
      .map((row) => ({ id: String(row.value), name: String(row.label) })),
    leaveTypes: (data.leave_types ?? [])
      .filter((row) => row.value && row.label)
      .map((row) => ({
        id: String(row.value),
        name: String(row.label),
        code: row.code ?? null,
      })),
  };

  snapshotCache.set(cacheKey, {
    snapshot,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return { ok: true, snapshot };
}

function entriesFor(snapshot: DirectorySnapshot, kind: EntityKind) {
  if (kind === "employee") return snapshot.employees;
  if (kind === "department") return snapshot.departments;
  return snapshot.leaveTypes;
}

/**
 * Match strategy, strongest first. The first tier that produces any hit wins,
 * so an exact name never loses to a substring match somewhere else.
 */
function matchEntries(entries: DirectoryEntry[], query: string) {
  const needle = normalize(query);
  if (!needle) return [];

  // An id or employee number was given directly.
  const byIdentifier = entries.filter(
    (entry) =>
      entry.id === query.trim() ||
      (entry.employeeNo && normalize(entry.employeeNo) === needle) ||
      (entry.code && normalize(entry.code) === needle)
  );
  if (byIdentifier.length) return byIdentifier;

  const exact = entries.filter((entry) => normalize(entry.name) === needle);
  if (exact.length) return exact;

  const startsWith = entries.filter((entry) =>
    normalize(entry.name).startsWith(needle)
  );
  if (startsWith.length) return startsWith;

  const contains = entries.filter((entry) =>
    normalize(entry.name).includes(needle)
  );
  if (contains.length) return contains;

  // "Rahul Sharma" typed as "sharma rahul", or a first name only.
  const tokens = needle.split(" ").filter(Boolean);
  if (tokens.length) {
    const tokenMatch = entries.filter((entry) => {
      const nameTokens = normalize(entry.name).split(" ").filter(Boolean);
      return tokens.every((token) =>
        nameTokens.some((nameToken) => nameToken.startsWith(token))
      );
    });
    if (tokenMatch.length) return tokenMatch;
  }

  return [];
}

/** A few near-misses to offer when nothing matched, so the reply is actionable. */
function suggestionsFor(entries: DirectoryEntry[], query: string) {
  const first = normalize(query).charAt(0);
  const pool = first
    ? entries.filter((entry) => normalize(entry.name).startsWith(first))
    : [];

  return (pool.length ? pool : entries).slice(0, 8);
}

export async function resolveEntity(
  context: LaravelRuntimeContext,
  kind: EntityKind,
  query: string,
  options?: { departmentId?: string }
): Promise<ResolutionResult> {
  const loaded = await loadDirectorySnapshot(context);

  if (!loaded.ok) {
    return { status: "unavailable", kind, query, message: loaded.message };
  }

  let entries = entriesFor(loaded.snapshot, kind);

  // "Rahul in Engineering" - narrow before matching so the department does the
  // disambiguation instead of the user having to pick from a list.
  if (kind === "employee" && options?.departmentId) {
    const scoped = entries.filter(
      (entry) => String(entry.departmentId ?? "") === String(options.departmentId)
    );
    if (scoped.length) entries = scoped;
  }

  const matches = matchEntries(entries, query);

  if (matches.length === 1) {
    return { status: "resolved", kind, match: matches[0] };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      kind,
      query,
      candidates: matches.slice(0, 10),
    };
  }

  return {
    status: "not_found",
    kind,
    query,
    suggestions: suggestionsFor(entries, query),
  };
}

export interface ResolvedFilterIds {
  departmentId?: string;
  employeeId?: string;
  leaveTypeId?: string;
}

export interface FilterResolutionOutcome {
  ids: ResolvedFilterIds;
  /** Resolutions that need the user to choose or correct something. */
  blocking: ResolutionResult[];
  /** Human readable trace of what each name resolved to. */
  resolved: Array<{ kind: EntityKind; query: string; id: string; name: string }>;
}

/**
 * Turns the names the model extracted from the question into the ids Laravel
 * expects. Values that already look like ids are passed straight through.
 */
export async function resolveFilterNames(
  context: LaravelRuntimeContext,
  names: {
    departmentName?: string;
    employeeName?: string;
    leaveTypeName?: string;
    departmentId?: string;
    employeeId?: string;
    leaveTypeId?: string;
  }
): Promise<FilterResolutionOutcome> {
  const outcome: FilterResolutionOutcome = {
    ids: {
      departmentId: names.departmentId,
      employeeId: names.employeeId,
      leaveTypeId: names.leaveTypeId,
    },
    blocking: [],
    resolved: [],
  };

  // Department first: it can disambiguate an employee name.
  if (names.departmentName && !outcome.ids.departmentId) {
    const result = await resolveEntity(context, "department", names.departmentName);

    if (result.status === "resolved") {
      outcome.ids.departmentId = result.match.id;
      outcome.resolved.push({
        kind: "department",
        query: names.departmentName,
        id: result.match.id,
        name: result.match.name,
      });
    } else {
      outcome.blocking.push(result);
    }
  }

  if (names.employeeName && !outcome.ids.employeeId) {
    const result = await resolveEntity(context, "employee", names.employeeName, {
      departmentId: outcome.ids.departmentId,
    });

    if (result.status === "resolved") {
      outcome.ids.employeeId = result.match.id;
      outcome.resolved.push({
        kind: "employee",
        query: names.employeeName,
        id: result.match.id,
        name: result.match.name,
      });
    } else {
      outcome.blocking.push(result);
    }
  }

  if (names.leaveTypeName && !outcome.ids.leaveTypeId) {
    const result = await resolveEntity(context, "leaveType", names.leaveTypeName);

    if (result.status === "resolved") {
      outcome.ids.leaveTypeId = result.match.id;
      outcome.resolved.push({
        kind: "leaveType",
        query: names.leaveTypeName,
        id: result.match.id,
        name: result.match.name,
      });
    } else {
      outcome.blocking.push(result);
    }
  }

  return outcome;
}
