/**
 * Deterministic answer composer.
 *
 * Turns the rows a backend endpoint actually returned into a conversational
 * sentence, with no LLM involved. This is what makes a database-backed question
 * survive an exhausted Gemini quota.
 *
 * Every number and every name in the output is read out of the payload. The
 * only fixed strings are connectives ("followed by", "I couldn't find"). There
 * are no fallback values, no sample rows and no invented labels: when a field is
 * missing the composer drops it rather than substituting anything.
 */

import type { ModuleDataOutcome } from "../backend/module-data.service";
import type {
  DepartmentCompetencyMetrics,
  DepartmentTrainingInsight,
} from "../backend/department-insight.service";
import type { AnswerShape } from "./question-planner.service";

/**
 * Per-dataset presentation hints. These name which *fields* to read - they
 * carry no values. Datasets without a hint fall back to shape inference.
 */
interface PresentationHint {
  /** Field holding the human label for a row. */
  labelKeys?: string[];
  /** Numeric field to rank/report by. */
  valueKeys?: string[];
  /** Extra field mentioned alongside the value, e.g. the skill behind a gap. */
  detailKeys?: string[];
  /** What one row is called, e.g. "department". */
  noun?: string;
  nounPlural?: string;
  /** Rendered after the value, e.g. "%" or "days". */
  unit?: string;
  /** How the metric reads in a sentence, e.g. "a skill gap of". */
  valueLabel?: string;
  /** Higher is worse (gaps) vs higher is better (coverage). */
  higherIsWorse?: boolean;
}

const PRESENTATION: Record<string, PresentationHint> = {
  "competency.skill_gaps": {
    labelKeys: ["department"],
    valueKeys: ["gap"],
    detailKeys: ["skill", "category"],
    noun: "department",
    nounPlural: "departments",
    valueLabel: "a skill gap of",
    higherIsWorse: true,
  },
  "competency.skill_coverage_kpis": {
    noun: "metric",
    nounPlural: "metrics",
  },
  "competency.department_skills": {
    labelKeys: ["department", "title", "skill"],
    noun: "skill",
    nounPlural: "skills",
  },
  "competency.user_skills": {
    labelKeys: ["title", "skill", "name"],
    valueKeys: ["skill_level", "proficiency_level"],
    noun: "skill",
    nounPlural: "skills",
  },
  "leave.requests": {
    labelKeys: ["employee_name"],
    detailKeys: ["department", "leave_type", "from_date", "to_date", "status"],
    noun: "leave request",
    nounPlural: "leave requests",
  },
  "leave.department_summary": {
    labelKeys: ["department"],
    valueKeys: ["requests", "pending"],
    noun: "department",
    nounPlural: "departments",
    valueLabel: "requests:",
    higherIsWorse: true,
  },
  "leave.type_distribution": {
    labelKeys: ["leave_type"],
    valueKeys: ["leave_count"],
    noun: "leave type",
    nounPlural: "leave types",
    valueLabel: "used",
    unit: "times",
    higherIsWorse: true,
  },
  "leave.upcoming_holidays": {
    labelKeys: ["name", "holiday_name"],
    detailKeys: ["from_date", "day"],
    noun: "holiday",
    nounPlural: "holidays",
  },
  "organization.departments": {
    labelKeys: ["department"],
    noun: "department",
    nounPlural: "departments",
  },
  "organization.employees": {
    labelKeys: ["first_name", "employee_name", "name"],
    detailKeys: ["employee_no", "email"],
    noun: "employee",
    nounPlural: "employees",
  },
  "reports.department_sizes": {
    labelKeys: ["department"],
    valueKeys: ["employee_count", "count", "total", "size"],
    noun: "department",
    nounPlural: "departments",
    valueLabel: "with",
    unit: "employees",
    higherIsWorse: false,
  },
  "reports.department_distribution": {
    labelKeys: ["department"],
    valueKeys: ["count", "total", "employee_count"],
    noun: "department",
    nounPlural: "departments",
    valueLabel: "with",
    unit: "employees",
  },
  "talent.job_applications": {
    labelKeys: ["first_name", "name", "candidate_name"],
    detailKeys: ["status"],
    noun: "application",
    nounPlural: "applications",
  },
  "talent.job_postings": {
    labelKeys: ["title"],
    detailKeys: ["department_name", "status"],
    noun: "job posting",
    nounPlural: "job postings",
  },
  "lms.enrolled_courses": {
    labelKeys: ["subject_name", "title", "name", "course_name"],
    detailKeys: ["enrollment_status"],
    // The endpoint returns the caller's *enrolments*, not the whole catalogue
    // (the LMS catalogue has no token authenticated API), so the wording says so
    // rather than implying it is every course available.
    noun: "enrolled course",
    nounPlural: "enrolled courses",
  },
  "task.counts": {
    noun: "task",
    nounPlural: "tasks",
  },
};

const GENERIC_LABEL_KEYS = [
  "department",
  "department_name",
  "name",
  "title",
  "label",
  "employee_name",
  "full_name",
  "skill",
  "leave_type",
  "subject_name",
  "course_name",
  "first_name",
];

const GENERIC_VALUE_KEYS = [
  "gap",
  "count",
  "total",
  "value",
  "score",
  "requests",
  "employee_count",
  "leave_count",
  "days",
  "percentage",
  "percent",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Finds the row column a follow-up is asking about, by matching the question's
 * words against the keys the rows actually have. Driven entirely by the payload
 * shape, so it works for any dataset.
 */
export function detectRequestedColumn(
  question: string,
  data: unknown
): string | undefined {
  const rows = extractRows(data);
  if (!rows?.length) return undefined;

  const words = new Set(
    question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );

  const candidates = Object.keys(rows[0]).filter(
    (key) => !/^id$|_id$/i.test(key) && typeof rows[0][key] === "string"
  );

  return candidates.find((key) => {
    const singular = key.replace(/_/g, " ").toLowerCase();
    const plural = `${singular}s`;
    return words.has(singular) || words.has(plural);
  });
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

function humanizeKey(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
}

/** Picks the first present, non-empty field from a candidate list. */
function pickField(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text && text.toLowerCase() !== "null") return text;
  }
  return null;
}

function pickNumericField(
  row: Record<string, unknown>,
  keys: string[]
): { key: string; value: number } | null {
  for (const key of keys) {
    const value = toNumber(row[key]);
    if (value !== null) return { key, value };
  }
  return null;
}

/** Infers a label/value pair from the row's own shape. */
function inferKeys(rows: Record<string, unknown>[]) {
  const sample = rows[0] ?? {};
  const keys = Object.keys(sample);

  const labelKey =
    GENERIC_LABEL_KEYS.find((key) => keys.includes(key)) ??
    keys.find(
      (key) => typeof sample[key] === "string" && !/^id$|_id$|date|time/i.test(key)
    ) ??
    null;

  const valueKey =
    GENERIC_VALUE_KEYS.find((key) => toNumber(sample[key]) !== null) ??
    keys.find(
      (key) => key !== labelKey && !/^id$|_id$/i.test(key) && toNumber(sample[key]) !== null
    ) ??
    null;

  return { labelKey, valueKey };
}

function labelFor(row: Record<string, unknown>, hint: PresentationHint, inferred: string | null) {
  const keys = [...(hint.labelKeys ?? []), ...(inferred ? [inferred] : []), ...GENERIC_LABEL_KEYS];
  // "first_name" alone reads oddly - join the name parts when they exist.
  const composed = [row.first_name, row.middle_name, row.last_name]
    .filter((part) => part !== null && part !== undefined && String(part).trim())
    .join(" ")
    .trim();

  const direct = pickField(row, keys);
  if (direct && composed && keys[0] === "first_name") return composed;
  return direct ?? (composed || null);
}

function detailFor(row: Record<string, unknown>, hint: PresentationHint) {
  if (!hint.detailKeys?.length) return null;

  const parts = hint.detailKeys
    .map((key) => {
      const value = row[key];
      if (value === null || value === undefined) return null;
      const text = String(value).trim();
      return text && text.toLowerCase() !== "null" ? text : null;
    })
    .filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function describeValue(value: number, hint: PresentationHint) {
  const parts = [hint.valueLabel, formatNumber(value), hint.unit].filter(Boolean);
  return parts.join(" ");
}

/** Flattens the first array found inside an object payload. */
function extractRows(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) {
    return data.filter(isRecord) as Record<string, unknown>[];
  }

  if (isRecord(data)) {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value.some(isRecord)) {
        return value.filter(isRecord) as Record<string, unknown>[];
      }
    }
  }

  return null;
}

/** Reports the scalar fields of an object payload, e.g. dashboard KPI blocks. */
function composeScalarSummary(
  data: Record<string, unknown>,
  subject: string
): string | null {
  const entries = Object.entries(data)
    .map(([key, value]) => ({ key, number: toNumber(value), raw: value }))
    .filter(
      (entry) =>
        entry.number !== null &&
        !/^id$|_id$|^year$|^status$|^status_code$/i.test(entry.key)
    );

  if (!entries.length) return null;

  const parts = entries
    .slice(0, 8)
    .map((entry) => `${humanizeKey(entry.key)}: ${formatNumber(entry.number as number)}`);

  return `Here is the current ${subject}: ${parts.join(", ")}.`;
}

function joinRanked(
  items: Array<{ label: string; value?: string; detail?: string | null }>
) {
  return items
    .map((item, index) => {
      const bits = [item.label];
      if (item.value) bits.push(item.value);
      const line = bits.join(" — ");
      const withDetail = item.detail ? `${line} (${item.detail})` : line;
      return `${index + 1}. ${withDetail}`;
    })
    .join("\n");
}

export interface ComposedAnswer {
  message: string;
  /** True when the sentence was built from real returned rows. */
  dataBacked: boolean;
  rowCount?: number;
}

/**
 * Builds the reply for a successful dataset read. `subject` is a plain-English
 * description of what was fetched, taken from the dataset label.
 */
export function composeDataAnswer(
  outcome: Extract<ModuleDataOutcome, { status: "success" }>,
  shape: AnswerShape,
  /**
   * Field to label rows by, when the question asked for a specific column of
   * the same rows - e.g. "show me the skills" after a per-department gap query.
   */
  labelKeyOverride?: string
): ComposedAnswer {
  const baseHint = PRESENTATION[outcome.dataset] ?? {};
  const hint: PresentationHint = labelKeyOverride
    ? {
        ...baseHint,
        labelKeys: [labelKeyOverride],
        // The overridden column becomes the label, so stop repeating it as detail.
        detailKeys: baseHint.detailKeys?.filter((key) => key !== labelKeyOverride),
        noun: labelKeyOverride.replace(/_/g, " "),
        nounPlural: `${labelKeyOverride.replace(/_/g, " ")}s`,
      }
    : baseHint;

  const subject = (hint.nounPlural ?? outcome.label ?? "records").toLowerCase();
  const rows = extractRows(outcome.data);

  const scopeSuffix = describeScope(outcome.appliedFilters, outcome.resolvedEntities);

  if (rows && rows.length) {
    const inferred = inferKeys(rows);
    const valueKeys = [...(hint.valueKeys ?? []), ...(inferred.valueKey ? [inferred.valueKey] : [])];

    const items = rows.map((row) => {
      const label = labelFor(row, hint, inferred.labelKey);
      const numeric = valueKeys.length ? pickNumericField(row, valueKeys) : null;

      return {
        label: label ?? "(unnamed)",
        rawValue: numeric?.value ?? null,
        value: numeric ? describeValue(numeric.value, hint) : undefined,
        detail: detailFor(row, hint),
      };
    });

    const named = items.filter((item) => item.label !== "(unnamed)");
    const usable = named.length ? named : items;

    if (shape === "count") {
      return {
        message: `There ${rows.length === 1 ? "is" : "are"} ${rows.length} ${
          rows.length === 1 ? hint.noun ?? "record" : subject
        }${scopeSuffix}.${
          usable.length <= 5
            ? ` ${usable.length === 1 ? "It is" : "They are"}: ${usable
                .map((item) => item.label)
                .join(", ")}.`
            : ""
        }`,
        dataBacked: true,
        rowCount: rows.length,
      };
    }

    if (shape === "ranking") {
      const hasValues = usable.some((item) => item.rawValue !== null);
      const ranked = hasValues
        ? [...usable].sort((left, right) => (right.rawValue ?? 0) - (left.rawValue ?? 0))
        : usable;

      const top = ranked.slice(0, Math.min(5, ranked.length));
      const lead = top[0];

      // A single row is not a ranking - and repeating the scope after the label
      // it already names ("Engineering ... for Engineering") reads badly.
      if (top.length === 1 && lead) {
        const detail = lead.detail ? ` (${lead.detail})` : "";
        return {
          message: lead.value
            ? `${lead.label} has ${lead.value}${detail}.`
            : `${lead.label}${detail}.`,
          dataBacked: true,
          rowCount: rows.length,
        };
      }

      const headline =
        hasValues && lead?.value
          ? `${lead.label} tops the list with ${lead.value}${scopeSuffix}.`
          : `${lead?.label} comes first${scopeSuffix}.`;

      return {
        message:
          top.length > 1
            ? `${headline}\n\n${joinRanked(top)}${
                outcome.truncated ? "\n\nShowing the first rows only." : ""
              }`
            : headline,
        dataBacked: true,
        rowCount: rows.length,
      };
    }

    // A one-row list reads better as a sentence than as a list of one.
    if (usable.length === 1) {
      const only = usable[0];
      const detail = only.detail ? ` (${only.detail})` : "";
      return {
        message: only.value
          ? `${only.label} — ${only.value}${detail}.`
          : `${only.label}${detail}.`,
        dataBacked: true,
        rowCount: rows.length,
      };
    }

    const listed = usable.slice(0, 10);

    return {
      message: `${rows.length} ${
        rows.length === 1 ? hint.noun ?? "record" : subject
      }${scopeSuffix}:\n\n${joinRanked(listed)}${
        rows.length > listed.length
          ? `\n\n…and ${rows.length - listed.length} more. Ask me to narrow it down.`
          : ""
      }`,
      dataBacked: true,
      rowCount: rows.length,
    };
  }

  if (isRecord(outcome.data)) {
    const summary = composeScalarSummary(outcome.data, `${subject}${scopeSuffix}`);
    if (summary) {
      return { message: summary, dataBacked: true };
    }
  }

  const single = toNumber(outcome.data);
  if (single !== null) {
    return {
      message: `The current ${subject}${scopeSuffix} is ${formatNumber(single)}.`,
      dataBacked: true,
    };
  }

  // Reached the backend, got a payload, but nothing presentable in it.
  return {
    message: `I retrieved the ${subject}${scopeSuffix}, but the response didn't contain any values I can report.`,
    dataBacked: false,
  };
}

/** " for Engineering", " between 2026-08-01 and 2026-08-31" - only what applied. */
function describeScope(
  filters: Record<string, unknown>,
  resolved: Array<{ kind: string; name: string }>
) {
  const parts: string[] = [];

  const entityNames = resolved.map((entity) => entity.name);
  if (entityNames.length) parts.push(`for ${entityNames.join(" and ")}`);

  const status = filters.status;
  if (Array.isArray(status) && status.length) {
    parts.push(`with status ${status.join(" or ")}`);
  }

  const from = filters.fromDate;
  const to = filters.toDate;
  if (from && to && from === to) parts.push(`on ${String(from)}`);
  else if (from && to) parts.push(`between ${String(from)} and ${String(to)}`);
  else if (from) parts.push(`from ${String(from)}`);

  return parts.length ? ` ${parts.join(", ")}` : "";
}

/** The honest reply when the backend answered but had nothing to return. */
export function composeEmptyAnswer(
  outcome: Extract<ModuleDataOutcome, { status: "empty" }>,
  datasetLabel?: string
): ComposedAnswer {
  const hint = PRESENTATION[outcome.dataset] ?? {};
  // The dataset label names what was searched for; nounPlural names the rows it
  // would have returned. For "nothing found" the former reads correctly
  // ("no skill gaps"), the latter does not ("no departments").
  const subject = (datasetLabel ?? hint.nounPlural ?? "records").toLowerCase();
  const scope = describeScope(outcome.appliedFilters, outcome.resolvedEntities);

  return {
    message: `I couldn't find any ${subject}${scope} in the system.`,
    dataBacked: true,
    rowCount: 0,
  };
}

export function composeClarificationAnswer(
  outcome: Extract<ModuleDataOutcome, { status: "needs_clarification" }>
): ComposedAnswer {
  const lines = outcome.clarifications.map((clarification) => {
    if (clarification.status === "ambiguous") {
      const names = clarification.candidates
        .map((candidate) =>
          candidate.department
            ? `${candidate.name} (${candidate.department})`
            : candidate.name
        )
        .join(", ");
      return `There is more than one ${clarification.kind} matching "${clarification.query}": ${names}. Which one did you mean?`;
    }

    if (clarification.status === "not_found") {
      const suggestions = clarification.suggestions.map((entry) => entry.name);
      return suggestions.length
        ? `I couldn't find a ${clarification.kind} called "${clarification.query}". Did you mean one of these: ${suggestions.slice(0, 5).join(", ")}?`
        : `I couldn't find a ${clarification.kind} called "${clarification.query}".`;
    }

    if (clarification.status === "unavailable") {
      return `I couldn't check "${clarification.query}" right now because the ${clarification.kind} directory was unreachable.`;
    }

    // 'resolved' never reaches this list, but keep the reply safe if it does.
    return `I need one more detail about the ${clarification.kind} before I can look that up.`;
  });

  return { message: lines.join("\n\n"), dataBacked: true };
}

export function composeUnavailableAnswer(
  outcome: Extract<ModuleDataOutcome, { status: "unavailable" | "missing_parameter" }>,
  datasetLabel?: string
): ComposedAnswer {
  const subject = datasetLabel ? datasetLabel.toLowerCase() : "that information";

  if (outcome.status === "missing_parameter") {
    return {
      message: `To look up ${subject} I need ${outcome.missing.join(" and ")}. Could you tell me which one you mean?`,
      dataBacked: true,
    };
  }

  if (outcome.reason === "session_missing" || outcome.reason === "unauthenticated") {
    return {
      message: `I couldn't read ${subject} because the session with the G2G backend isn't valid any more. Please sign in again and ask me once more.`,
      dataBacked: true,
    };
  }

  if (outcome.reason === "forbidden") {
    return {
      message: `Your role doesn't have access to ${subject}.`,
      dataBacked: true,
    };
  }

  return {
    message: `I couldn't retrieve ${subject} from the system right now (${outcome.reason.replace(/_/g, " ")}). I'd rather tell you that than guess at the numbers.`,
    dataBacked: true,
  };
}

/* ------------------------------------------------------------------------- *
 * Department level competency answers
 * ------------------------------------------------------------------------- */

/** "training urgency index of 78, an average skill gap of 0.82" - real values only. */
function describeDepartmentMetrics(
  department: DepartmentCompetencyMetrics,
  rankedByKey?: keyof DepartmentCompetencyMetrics
) {
  const parts: string[] = [];

  // Lead with whatever the ranking used, so the sentence justifies the ranking.
  if (rankedByKey === "trainingUrgencyIndex" && department.trainingUrgencyIndex !== undefined) {
    parts.push(`a training urgency index of ${formatNumber(department.trainingUrgencyIndex)}`);
  }

  if (department.avgSkillGap !== undefined) {
    parts.push(`an average skill gap of ${formatNumber(department.avgSkillGap)}`);
  }

  if (
    rankedByKey !== "trainingUrgencyIndex" &&
    department.trainingUrgencyIndex !== undefined
  ) {
    parts.push(`a training urgency index of ${formatNumber(department.trainingUrgencyIndex)}`);
  }

  if (department.criticalDeficiencies !== undefined) {
    parts.push(
      `${formatNumber(department.criticalDeficiencies)} critical deficienc${
        department.criticalDeficiencies === 1 ? "y" : "ies"
      }`
    );
  }

  if (department.overallSkillCoverage !== undefined) {
    parts.push(`${formatNumber(department.overallSkillCoverage)}% skill coverage`);
  }

  if (department.topGapSkill && department.topGapValue !== undefined) {
    parts.push(
      `its widest single gap being ${department.topGapSkill} (${formatNumber(department.topGapValue)})`
    );
  }

  return parts;
}

/** Renders the institute-wide metrics the existing flow already returned. */
function describeOverallMetrics(overall?: Record<string, number>) {
  if (!overall) return null;

  const parts = Object.entries(overall)
    .filter(([key]) => !/^id$|_id$|^status$/i.test(key))
    .map(([key, value]) => {
      const label = humanizeKey(key);
      // Coverage is a percentage in this payload; the rest are plain numbers.
      const suffix = /coverage/i.test(key) ? "%" : "";
      return `${label} ${formatNumber(value)}${suffix}`;
    });

  return parts.length ? parts.join(", ") : null;
}

export interface DepartmentAnswerOptions {
  /** 'top' names the leader, 'list' shows the ranking, 'others' skips the leader. */
  mode?: "top" | "list" | "others" | "why";
  /** Ascending for "lowest skill coverage" style questions. */
  ascending?: boolean;
}

/**
 * Builds the department-level reply. Every name and number is read from the
 * insight, which in turn came from the existing backend endpoints.
 */
export function composeDepartmentTrainingAnswer(
  insight: DepartmentTrainingInsight,
  options: DepartmentAnswerOptions = {}
): ComposedAnswer {
  const { mode = "top", ascending = false } = options;
  const overallLine = describeOverallMetrics(insight.overall);

  // No department detail: keep returning exactly what the existing flow did.
  if (!insight.departments.length) {
    if (overallLine) {
      return {
        message: `I couldn't break the training need down by department, but here are the current organisation-wide figures: ${overallLine}.`,
        dataBacked: true,
      };
    }

    return {
      message:
        insight.message ??
        "I couldn't retrieve competency metrics from the system right now.",
      dataBacked: true,
    };
  }

  const ordered = ascending ? [...insight.departments].reverse() : insight.departments;

  if (mode === "list" || mode === "others") {
    const rows = mode === "others" ? ordered.slice(1) : ordered;

    if (!rows.length) {
      return {
        message: "That was the only department with competency data recorded.",
        dataBacked: true,
        rowCount: 0,
      };
    }

    const lines = rows.map((department, index) => {
      const metrics = describeDepartmentMetrics(department, insight.rankedByKey);
      return `${index + 1}. ${department.departmentName}${
        metrics.length ? ` — ${metrics.join(", ")}` : ""
      }`;
    });

    const heading =
      mode === "others"
        ? `The other departments, still ranked by ${insight.rankedBy ?? "training need"}:`
        : `Departments ranked by ${insight.rankedBy ?? "training need"}:`;

    return {
      message: `${heading}\n\n${lines.join("\n")}${
        overallLine ? `\n\nOrganisation-wide: ${overallLine}.` : ""
      }`,
      dataBacked: true,
      rowCount: rows.length,
    };
  }

  const leader = ordered[0];
  const metrics = describeDepartmentMetrics(leader, insight.rankedByKey);
  const runnerUp = ordered[1];

  /**
   * Phrase the headline around the metric that actually drove the ranking, so
   * "lowest skill coverage" is not reported as "needs the most training".
   */
  const lead = (() => {
    const name = leader.departmentName;

    if (insight.rankedByKey === "overallSkillCoverage") {
      return ascending
        ? `${name} has the lowest skill coverage`
        : `${name} has the highest skill coverage`;
    }

    if (insight.rankedByKey === "criticalDeficiencies") {
      return ascending
        ? `${name} has the fewest critical deficiencies`
        : `${name} has the most critical deficiencies`;
    }

    if (insight.rankedByKey === "avgSkillGap") {
      return ascending
        ? `${name} has the smallest average skill gap`
        : `${name} has the biggest average skill gap`;
    }

    return ascending
      ? `${name} needs the least training`
      : `${name} needs the most training`;
  })();

  const sentence = metrics.length
    ? `${lead}, with ${metrics.join(", ")}.`
    : `${lead}.`;

  if (mode === "why") {
    return {
      message: `${sentence} That is the highest ${
        insight.rankedBy ?? "training need"
      } of any department${
        runnerUp
          ? `; next is ${runnerUp.departmentName} with ${
              describeDepartmentMetrics(runnerUp, insight.rankedByKey)[0] ?? "a lower score"
            }`
          : ""
      }.${overallLine ? `\n\nOrganisation-wide: ${overallLine}.` : ""}`,
      dataBacked: true,
      rowCount: insight.departments.length,
    };
  }

  const runnerUpLine = runnerUp
    ? ` Next is ${runnerUp.departmentName}${
        describeDepartmentMetrics(runnerUp, insight.rankedByKey)[0]
          ? ` with ${describeDepartmentMetrics(runnerUp, insight.rankedByKey)[0]}`
          : ""
      }.`
    : "";

  return {
    message: `${sentence}${runnerUpLine}${
      overallLine ? `\n\nOrganisation-wide: ${overallLine}.` : ""
    }`,
    dataBacked: true,
    rowCount: insight.departments.length,
  };
}

/** Reply for a topic this installation has no module for. */
export function composeUnsupportedTopicAnswer(topic: string): ComposedAnswer {
  const article = /^[aeiou]/i.test(topic) ? "an" : "a";

  return {
    message: `This G2G installation doesn't have ${article} ${topic} module, so there's no ${topic} data for me to read. I can help with people and departments, attendance, leave, learning, competencies and skill gaps, recruitment, tasks and workforce reports.`,
    dataBacked: true,
  };
}
