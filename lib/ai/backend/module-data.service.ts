/**
 * Dataset executor for the Conversational AI.
 *
 * Flow for one data-backed question:
 *
 *   dataset id + spoken filters
 *     -> resolve names to ids (directory.service, via GET /api/leave/options)
 *     -> build the params the target Laravel controller expects (module-catalog)
 *     -> call the existing Laravel route (laravel-gateway)
 *     -> return a structured, size-bounded result
 *
 * The return value is always structured and always states what happened. There
 * is no path through this module that produces invented rows: an unreachable
 * endpoint, an empty table and an ambiguous employee name each come back as
 * their own explicit outcome for the model to report.
 */

import {
  buildDatasetPath,
  getDataset,
  type DatasetDefinition,
  type DatasetFilters,
} from "./module-catalog";
import {
  resolveFilterNames,
  type FilterResolutionOutcome,
  type ResolutionResult,
} from "./directory.service";
import {
  isEmptyPayload,
  laravelRequest,
  unwrapLaravelData,
  type LaravelRuntimeContext,
} from "./laravel-gateway";

/** Guard rail so a wide register query cannot blow up the model context. */
const MAX_ROWS_RETURNED = 50;

export interface ModuleDataRequest {
  dataset: string;
  filters?: DatasetFilters & {
    departmentName?: string;
    employeeName?: string;
    leaveTypeName?: string;
  };
}

export type ModuleDataOutcome =
  | {
      status: "success";
      dataset: string;
      moduleId: string;
      label: string;
      source: string;
      appliedFilters: Record<string, unknown>;
      resolvedEntities: FilterResolutionOutcome["resolved"];
      rowCount?: number;
      truncated?: boolean;
      data: unknown;
    }
  | {
      status: "empty";
      dataset: string;
      moduleId: string;
      source: string;
      appliedFilters: Record<string, unknown>;
      resolvedEntities: FilterResolutionOutcome["resolved"];
      message: string;
    }
  | {
      status: "needs_clarification";
      dataset: string;
      /** Ambiguous / unknown names the user has to choose between or correct. */
      clarifications: ResolutionResult[];
      message: string;
    }
  | {
      status: "missing_parameter";
      dataset: string;
      missing: string[];
      message: string;
    }
  | {
      status: "unavailable";
      dataset: string;
      source?: string;
      reason: string;
      message: string;
    };

function countRows(value: unknown) {
  if (Array.isArray(value)) return value.length;
  return undefined;
}

/** Caps array payloads (including one level of nesting) at MAX_ROWS_RETURNED. */
function boundPayload(value: unknown): { data: unknown; truncated: boolean } {
  if (Array.isArray(value) && value.length > MAX_ROWS_RETURNED) {
    return { data: value.slice(0, MAX_ROWS_RETURNED), truncated: true };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    let truncated = false;
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(item) && item.length > MAX_ROWS_RETURNED) {
        output[key] = item.slice(0, MAX_ROWS_RETURNED);
        truncated = true;
      } else {
        output[key] = item;
      }
    }

    return { data: output, truncated };
  }

  return { data: value, truncated: false };
}

function describeClarification(result: ResolutionResult) {
  if (result.status === "ambiguous") {
    const names = result.candidates
      .map((candidate) =>
        candidate.department
          ? `${candidate.name} (${candidate.department})`
          : candidate.name
      )
      .join(", ");

    return `"${result.query}" matches more than one ${result.kind}: ${names}. Ask the user which one they mean.`;
  }

  if (result.status === "not_found") {
    const suggestions = result.suggestions.map((entry) => entry.name).join(", ");
    return suggestions
      ? `No ${result.kind} named "${result.query}" exists in this organisation. Closest existing records: ${suggestions}.`
      : `No ${result.kind} named "${result.query}" exists in this organisation.`;
  }

  if (result.status === "unavailable") {
    return `The ${result.kind} directory could not be read, so "${result.query}" could not be resolved. ${result.message}`;
  }

  return "";
}

/** Only forward filters the target controller actually honours. */
function pickSupportedFilters(
  dataset: DatasetDefinition,
  filters: DatasetFilters
): DatasetFilters {
  const supported = new Set<string>(dataset.supportedFilters);
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    if (supported.has(key)) output[key] = value;
  }

  return output as DatasetFilters;
}

export async function fetchModuleData(
  context: LaravelRuntimeContext,
  request: ModuleDataRequest
): Promise<ModuleDataOutcome> {
  const dataset = getDataset(request.dataset);

  if (!dataset) {
    return {
      status: "unavailable",
      dataset: request.dataset,
      reason: "unknown_dataset",
      message: `"${request.dataset}" is not a dataset this system exposes. Call listModules to see what is available.`,
    };
  }

  const incoming = request.filters ?? {};

  const resolution = await resolveFilterNames(context, {
    departmentName: incoming.departmentName,
    employeeName: incoming.employeeName,
    leaveTypeName: incoming.leaveTypeName,
    departmentId: incoming.departmentId,
    employeeId: incoming.employeeId,
    leaveTypeId: incoming.leaveTypeId,
  });

  // A name the user gave could not be pinned to exactly one record. Do not
  // silently pick one, and do not query with the filter dropped either.
  if (resolution.blocking.length) {
    return {
      status: "needs_clarification",
      dataset: dataset.id,
      clarifications: resolution.blocking,
      message: resolution.blocking.map(describeClarification).join(" "),
    };
  }

  const defaults = {
    userId: context.userId,
    subInstituteId: context.subInstituteId,
    syear: context.syear,
  };

  /**
   * Overwrite the spoken names with the canonical ones from the directory, so
   * endpoints that filter by name receive exactly the string stored in the
   * database ("HR" typed by the user becomes "Human Resources" if that is what
   * hrms_departments holds).
   */
  const canonicalNames: Partial<DatasetFilters> = {};
  for (const entity of resolution.resolved) {
    if (entity.kind === "department") canonicalNames.departmentName = entity.name;
    if (entity.kind === "employee") canonicalNames.employeeName = entity.name;
    if (entity.kind === "leaveType") canonicalNames.leaveTypeName = entity.name;
  }

  const mergedFilters: DatasetFilters = {
    ...incoming,
    ...resolution.ids,
    ...canonicalNames,
  };

  const effectiveFilters = pickSupportedFilters(dataset, mergedFilters);

  const { path, missing } = buildDatasetPath(dataset, mergedFilters, defaults);

  if (missing.length) {
    return {
      status: "missing_parameter",
      dataset: dataset.id,
      missing,
      message: `${dataset.label} needs ${missing.join(", ")} before it can be read. Ask the user for it.`,
    };
  }

  const params = dataset.buildParams?.(mergedFilters, defaults) ?? {};
  const body = dataset.buildBody?.(mergedFilters, defaults);

  const result = await laravelRequest(context, path, {
    transport: dataset.transport ?? "api",
    method: dataset.method ?? "GET",
    bearer: dataset.bearer,
    params,
    body,
  });

  const appliedFilters: Record<string, unknown> = { ...effectiveFilters };

  if (!result.ok) {
    if (result.reason === "empty") {
      return {
        status: "empty",
        dataset: dataset.id,
        moduleId: dataset.moduleId,
        source: path,
        appliedFilters,
        resolvedEntities: resolution.resolved,
        message: "The backend returned no matching records for these filters.",
      };
    }

    return {
      status: "unavailable",
      dataset: dataset.id,
      source: path,
      reason: result.reason,
      message: result.message,
    };
  }

  const unwrapped = unwrapLaravelData(result.data);

  if (isEmptyPayload(unwrapped)) {
    return {
      status: "empty",
      dataset: dataset.id,
      moduleId: dataset.moduleId,
      source: path,
      appliedFilters,
      resolvedEntities: resolution.resolved,
      message: "The backend returned no matching records for these filters.",
    };
  }

  const bounded = boundPayload(unwrapped);

  return {
    status: "success",
    dataset: dataset.id,
    moduleId: dataset.moduleId,
    label: dataset.label,
    source: path,
    appliedFilters,
    resolvedEntities: resolution.resolved,
    rowCount: countRows(unwrapped),
    truncated: bounded.truncated,
    data: bounded.data,
  };
}
