/**
 * Department-level competency insight.
 *
 * "Which department needs the most training?" needs a department *name* next to
 * a department-level metric. The overall numbers already came from the existing
 * `GET /api/kpis` (EmployeeSkillCoverageMatrixController::getKpiMetrics), and
 * that same endpoint already accepts a `department` filter which it matches
 * against `tbluser.department_id`. So the department-level figures are obtained
 * by asking the *existing* endpoint once per department - no new backend route,
 * no duplicated scoring, no second source of truth.
 *
 * `trainingUrgencyIndex` is the backend's own definition of training priority
 * (min(100, criticalDeficiencies * 5 + avgSkillGap * 10)), so it is the ranking
 * metric rather than anything invented here. Where the endpoint cannot be read,
 * `GET /api/skill-gaps` provides a per-department gap to rank by instead.
 *
 * Department names and ids come from the live directory, so any number of
 * departments works and nothing is hardcoded.
 */

import { fetchModuleData } from "./module-data.service";
import type { LaravelRuntimeContext } from "./laravel-gateway";
import type { DirectorySnapshot } from "./directory.service";

/** Pseudo dataset id, so follow-ups can reuse this insight like any dataset. */
export const DEPARTMENT_TRAINING_DATASET = "competency.department_training_needs";

/** Bounded so a large tenant cannot fan out into hundreds of calls. */
const MAX_DEPARTMENTS = 25;
const CONCURRENCY = 5;

export interface DepartmentCompetencyMetrics {
  departmentId?: string;
  departmentName: string;
  overallSkillCoverage?: number;
  avgSkillGap?: number;
  criticalDeficiencies?: number;
  trainingUrgencyIndex?: number;
  /** Worst skill for the department, when /api/skill-gaps could be read. */
  topGapSkill?: string;
  topGapValue?: number;
}

export interface DepartmentTrainingInsight {
  status: "success" | "unavailable";
  /** Ranked worst-first by `rankedBy`. */
  departments: DepartmentCompetencyMetrics[];
  /** The institute-wide metrics, exactly as the existing flow already returned. */
  overall?: Record<string, number>;
  /** Human readable name of the metric used for ranking. */
  rankedBy?:
    | "training urgency index"
    | "average skill gap"
    | "skill gap"
    | "critical deficiencies"
    | "skill coverage";
  rankedByKey?: keyof DepartmentCompetencyMetrics;
  sources: string[];
  message?: string;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** Keeps only the numeric metrics, so the overall block stays reportable. */
function pickMetrics(payload: unknown): Record<string, number> | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;

  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const numeric = toNumber(value);
    if (numeric !== undefined) output[key] = numeric;
  }

  return Object.keys(output).length ? output : undefined;
}

/** Runs the fan-out a few at a time rather than all at once. */
async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  limit: number,
  worker: (item: TItem) => Promise<TResult>
): Promise<TResult[]> {
  const results: TResult[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    results[index] = await worker(items[index]);
    return runNext();
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runNext())
  );

  return results;
}

/**
 * Reads the departments to report on. The directory is the same live list the
 * Leave screens use; /departments-management is the fallback when the directory
 * could not be loaded.
 */
async function resolveDepartments(
  context: LaravelRuntimeContext,
  directory: DirectorySnapshot | null
): Promise<Array<{ id?: string; name: string }>> {
  const fromDirectory = (directory?.departments ?? [])
    .filter((entry) => entry.name)
    .map((entry) => ({ id: entry.id, name: entry.name }));

  if (fromDirectory.length) return fromDirectory;

  const outcome = await fetchModuleData(context, {
    dataset: "organization.departments",
  });

  if (outcome.status !== "success") return [];

  const payload = outcome.data as
    | { main_departments?: Array<Record<string, unknown>> }
    | Array<Record<string, unknown>>
    | undefined;

  const rows = Array.isArray(payload)
    ? payload
    : (payload?.main_departments ?? []);

  return rows
    .map((row) => ({
      id: row.id !== undefined ? String(row.id) : undefined,
      name: String(row.department ?? row.name ?? "").trim(),
    }))
    .filter((entry) => entry.name);
}

/** Per-department gap and worst skill from the existing /api/skill-gaps route. */
async function loadSkillGapsByDepartment(context: LaravelRuntimeContext) {
  const outcome = await fetchModuleData(context, {
    dataset: "competency.skill_gaps",
  });

  if (outcome.status !== "success" || !Array.isArray(outcome.data)) {
    return { available: false as const, byDepartment: new Map<string, { skill?: string; gap?: number }>() };
  }

  const byDepartment = new Map<string, { skill?: string; gap?: number }>();

  for (const row of outcome.data as Array<Record<string, unknown>>) {
    const department = String(row.department ?? "").trim();
    if (!department) continue;

    const gap = toNumber(row.gap);
    const existing = byDepartment.get(department);

    // The endpoint already returns the worst skill per department, but guard in
    // case more than one row per department ever comes back.
    if (!existing || (gap ?? 0) > (existing.gap ?? 0)) {
      byDepartment.set(department, {
        skill: row.skill ? String(row.skill) : undefined,
        gap,
      });
    }
  }

  return { available: true as const, byDepartment };
}

/** Label used when explaining which metric drove the ranking. */
const METRIC_LABELS: Record<string, DepartmentTrainingInsight["rankedBy"]> = {
  trainingUrgencyIndex: "training urgency index",
  avgSkillGap: "average skill gap",
  criticalDeficiencies: "critical deficiencies",
  overallSkillCoverage: "skill coverage",
};

export async function loadDepartmentTrainingInsight(
  context: LaravelRuntimeContext,
  directory: DirectorySnapshot | null,
  /** Metric the question named, if any. Defaults to the backend's own score. */
  preferredMetric?: keyof DepartmentCompetencyMetrics
): Promise<DepartmentTrainingInsight> {
  const sources: string[] = [];

  // 1. The institute-wide metrics the current flow already returns. Fetched
  //    first and kept regardless of what the department fan-out produces, so
  //    adding department detail can never remove these numbers.
  const overallOutcome = await fetchModuleData(context, {
    dataset: "competency.skill_coverage_kpis",
  });

  const overall =
    overallOutcome.status === "success" ? pickMetrics(overallOutcome.data) : undefined;

  if (overallOutcome.status === "success") sources.push("/kpis");

  // 2. Per-department metrics from the same endpoint, one department at a time.
  const departments = (
    await resolveDepartments(context, directory)
  ).slice(0, MAX_DEPARTMENTS);

  if (!departments.length) {
    return {
      status: overall ? "success" : "unavailable",
      departments: [],
      overall,
      sources,
      message: "No departments could be read, so department level metrics are unavailable.",
    };
  }

  const skillGaps = await loadSkillGapsByDepartment(context);
  if (skillGaps.available) sources.push("/skill-gaps");

  const perDepartment = await mapWithConcurrency(
    departments,
    CONCURRENCY,
    async (department): Promise<DepartmentCompetencyMetrics | null> => {
      // No id means the endpoint cannot be filtered - skip rather than send a
      // name to a parameter compared against department_id.
      if (!department.id) return null;

      const outcome = await fetchModuleData(context, {
        dataset: "competency.skill_coverage_kpis",
        filters: { departmentId: department.id },
      });

      if (outcome.status !== "success") return null;

      const metrics = pickMetrics(outcome.data);
      if (!metrics) return null;

      const gapRow = skillGaps.byDepartment.get(department.name);

      return {
        departmentId: department.id,
        departmentName: department.name,
        overallSkillCoverage: metrics.overallSkillCoverage,
        avgSkillGap: metrics.avgSkillGap,
        criticalDeficiencies: metrics.criticalDeficiencies,
        trainingUrgencyIndex: metrics.trainingUrgencyIndex,
        topGapSkill: gapRow?.skill,
        topGapValue: gapRow?.gap,
      };
    }
  );

  let resolved = perDepartment.filter(
    (entry): entry is DepartmentCompetencyMetrics => entry !== null
  );

  /**
   * A department with no competency records at all scores 0 on every metric.
   * Ranking those as "needs no training" would be wrong, but reporting them as
   * the top need would be worse, so they are dropped from the ranking.
   */
  const withSignal = resolved.filter(
    (entry) =>
      (entry.trainingUrgencyIndex ?? 0) > 0 ||
      (entry.avgSkillGap ?? 0) > 0 ||
      (entry.criticalDeficiencies ?? 0) > 0 ||
      (entry.topGapValue ?? 0) > 0
  );

  if (withSignal.length) resolved = withSignal;

  // 3. If the per-department endpoint gave nothing, fall back to ranking on the
  //    per-department gaps from /api/skill-gaps.
  if (!resolved.length && skillGaps.available && skillGaps.byDepartment.size) {
    const fromGaps = [...skillGaps.byDepartment.entries()].map(([name, row]) => ({
      departmentName: name,
      departmentId: departments.find((entry) => entry.name === name)?.id,
      topGapSkill: row.skill,
      topGapValue: row.gap,
      avgSkillGap: row.gap,
    }));

    return {
      status: "success",
      departments: fromGaps.sort(
        (left, right) => (right.topGapValue ?? 0) - (left.topGapValue ?? 0)
      ),
      overall,
      rankedBy: "skill gap",
      rankedByKey: "topGapValue",
      sources,
    };
  }

  if (!resolved.length) {
    return {
      status: overall ? "success" : "unavailable",
      departments: [],
      overall,
      sources,
      message:
        "Department level competency metrics could not be read from the backend.",
    };
  }

  /**
   * Rank by the metric the question named, falling back to the backend's own
   * training priority score (trainingUrgencyIndex), then to the average gap.
   * A metric is only used if the payload actually carried it.
   */
  const hasMetric = (key: keyof DepartmentCompetencyMetrics) =>
    resolved.some((entry) => entry[key] !== undefined);

  const rankedByKey: keyof DepartmentCompetencyMetrics =
    preferredMetric && hasMetric(preferredMetric)
      ? preferredMetric
      : hasMetric("trainingUrgencyIndex")
        ? "trainingUrgencyIndex"
        : "avgSkillGap";

  // Always sorted worst-first for the chosen metric; the composer reverses when
  // the question asked for the lowest instead of the highest.
  const ranked = [...resolved].sort((left, right) => {
    const primary =
      ((right[rankedByKey] as number) ?? 0) - ((left[rankedByKey] as number) ?? 0);
    if (primary !== 0) return primary;
    return (right.avgSkillGap ?? 0) - (left.avgSkillGap ?? 0);
  });

  return {
    status: "success",
    departments: ranked,
    overall,
    rankedBy: METRIC_LABELS[rankedByKey] ?? "training urgency index",
    rankedByKey,
    sources,
  };
}
