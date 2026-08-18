/**
 * Database-first execution.
 *
 * Runs a deterministic plan against the existing G2G backend and composes the
 * reply from whatever the backend returned - without touching the LLM. This is
 * the path that keeps system-data questions working when the Gemini quota is
 * exhausted.
 *
 * Order of operations:
 *   directory snapshot -> plan -> (follow-up merge) -> dataset call
 *   -> fallback datasets if the first is empty -> deterministic answer
 */

import {
  fetchModuleData,
  type ModuleDataOutcome,
} from "../backend/module-data.service";
import { getDataset, type DatasetFilters } from "../backend/module-catalog";
import {
  loadDirectorySnapshot,
  type DirectorySnapshot,
} from "../backend/directory.service";
import type { LaravelRuntimeContext } from "../backend/laravel-gateway";
import {
  planQuestion,
  type AnswerShape,
  type QuestionPlan,
} from "./question-planner.service";
import {
  composeClarificationAnswer,
  composeDataAnswer,
  composeDepartmentTrainingAnswer,
  detectRequestedColumn,
  composeEmptyAnswer,
  composeUnavailableAnswer,
  composeUnsupportedTopicAnswer,
  type ComposedAnswer,
  type DepartmentAnswerOptions,
} from "./answer-composer.service";
import {
  DEPARTMENT_TRAINING_DATASET,
  loadDepartmentTrainingInsight,
} from "../backend/department-insight.service";
import {
  getFollowUpState,
  recordFollowUpQuery,
  type FollowUpQueryState,
} from "./followup.service";

export interface DatabaseFirstContext extends LaravelRuntimeContext {
  sessionId: string;
  role?: string;
  allowedDatasets?: string[];
}

export interface DatabaseFirstResult {
  handled: boolean;
  plan: QuestionPlan;
  answer?: ComposedAnswer;
  outcome?: ModuleDataOutcome;
  datasetTried?: string[];
  /** Set when the deterministic path declined, so the caller can use the LLM. */
  reason?:
    | "advisory"
    | "no_rule_matched"
    | "no_readable_dataset"
    | "all_datasets_failed";
}

/**
 * Short, referential questions ("show me the skills", "what about Division C")
 * that only make sense against the previous query.
 */
const FOLLOW_UP_MARKERS =
  /^(and |what about|how about|why\b|how come\b|show (me )?(the|their|those|them|other|others|rest|remaining)|list (them|their)|their\b|those\b|that (one|department|employee)|same for|now for|drill|break.?down|more detail)/i;

/** Words that only make sense against the previous answer. */
const REFERENTIAL_WORDS = /\b(they|them|their|there|it|those|these|that one|the rest|others?)\b/i;

function looksLikeFollowUp(question: string) {
  const trimmed = question.trim();
  if (FOLLOW_UP_MARKERS.test(trimmed)) return true;

  // Short questions that lean on a pronoun or place-holder instead of a subject.
  return trimmed.split(/\s+/).length <= 8 && REFERENTIAL_WORDS.test(trimmed);
}

/**
 * Carries forward the filters of the previous query, letting anything the new
 * question specified win. This is what makes "what about Division C" change one
 * filter instead of resetting the whole query.
 */
function mergeFollowUpFilters(
  previous: FollowUpQueryState | undefined,
  current: DatasetFilters
): DatasetFilters {
  if (!previous) return current;

  const carried: DatasetFilters = {};
  const previousFilters = previous.filters as DatasetFilters;

  for (const key of [
    "departmentId",
    "departmentName",
    "employeeId",
    "employeeName",
    "leaveTypeId",
    "leaveTypeName",
    "status",
    "fromDate",
    "toDate",
  ] as const) {
    const value = previousFilters?.[key];
    if (value !== undefined && value !== null) {
      (carried as Record<string, unknown>)[key] = value;
    }
  }

  // A new entity in the current question replaces the whole previous entity,
  // id and name together, so a stale id can never outlive its name.
  const merged: DatasetFilters = { ...carried, ...current };

  if (current.departmentName && !current.departmentId) delete merged.departmentId;
  if (current.employeeName && !current.employeeId) delete merged.employeeId;
  if (current.leaveTypeName && !current.leaveTypeId) delete merged.leaveTypeId;

  return merged;
}

async function loadDirectory(
  context: DatabaseFirstContext
): Promise<DirectorySnapshot | null> {
  if (!context.token || !context.subInstituteId) return null;

  const loaded = await loadDirectorySnapshot(context);
  return loaded.ok ? loaded.snapshot : null;
}

function composeFor(
  outcome: ModuleDataOutcome,
  shape: AnswerShape,
  question: string,
  /**
   * Only follow-ups may re-label rows by a column named in the question. On a
   * first-time question the words overlap the dataset's own vocabulary too often
   * ("show skill gaps for Engineering" would relabel departments as skills).
   */
  allowColumnOverride: boolean
): ComposedAnswer {
  const label = getDataset(outcome.dataset)?.label;

  switch (outcome.status) {
    case "success":
      return composeDataAnswer(
        outcome,
        shape,
        allowColumnOverride
          ? detectRequestedColumn(question, outcome.data)
          : undefined
      );
    case "empty":
      return composeEmptyAnswer(outcome, label);
    case "needs_clarification":
      return composeClarificationAnswer(outcome);
    case "missing_parameter":
    case "unavailable":
      return composeUnavailableAnswer(outcome, label);
  }
}

/** Which slice of the department ranking the wording is asking for. */
function detectDepartmentAnswerMode(
  question: string,
  isFollowUp: boolean
): DepartmentAnswerOptions["mode"] {
  const lower = question.toLowerCase();

  if (/\bwhy\b|\bhow come\b|\breason\b/.test(lower)) return "why";
  if (/\bother\b|\brest\b|\bremaining\b|\bothers\b/.test(lower)) return "others";
  if (/\ball departments?\b|\blist\b|\brank\b|\bshow (me )?departments?\b|\bevery department\b|\beach department\b/.test(lower)) {
    return "list";
  }

  // A bare follow-up after the ranking usually wants the full picture.
  return isFollowUp ? "list" : "top";
}

/**
 * Department level competency answer, assembled from the existing
 * /api/kpis (overall and per department) and /api/skill-gaps endpoints.
 *
 * Returns null when there is nothing extra to add, so the caller falls back to
 * the behaviour that already works.
 */
async function runDepartmentTrainingInsight(
  context: DatabaseFirstContext,
  directory: DirectorySnapshot | null,
  question: string,
  plan: QuestionPlan,
  isFollowUp: boolean
): Promise<DatabaseFirstResult | null> {
  console.log("[conversation.tool]", {
    tool: "departmentTrainingInsight",
    sources: ["/kpis", "/kpis?department", "/skill-gaps"],
  });

  const insight = await loadDepartmentTrainingInsight(
    context,
    directory,
    plan.rankMetric
  );

  console.log("[conversation.data]", {
    dataset: DEPARTMENT_TRAINING_DATASET,
    status: insight.status,
    records: insight.departments.length,
    rankedBy: insight.rankedBy,
    sources: insight.sources,
  });

  // Nothing gained over the existing single-dataset answer - let it run.
  if (!insight.departments.length && !insight.overall) {
    console.log("[conversation.fallback] department insight empty, using generic path");
    return null;
  }

  const mode = detectDepartmentAnswerMode(question, isFollowUp);
  const answer = composeDepartmentTrainingAnswer(insight, {
    mode,
    ascending: plan.ascending,
  });

  const leader = insight.departments[0];

  // Remember the leading department so "what skills are missing there?" can
  // resolve "there" without the user naming it again.
  recordFollowUpQuery(
    { userId: context.userId || "anonymous", sessionId: context.sessionId },
    {
      dataset: DEPARTMENT_TRAINING_DATASET,
      moduleId: "m2",
      label: "Department training needs",
      source: insight.sources.join(", "),
      filters: leader?.departmentName
        ? { departmentName: leader.departmentName, departmentId: leader.departmentId }
        : {},
      resolvedEntities: leader?.departmentName
        ? [
            {
              kind: "department",
              query: leader.departmentName,
              id: leader.departmentId ?? "",
              name: leader.departmentName,
            },
          ]
        : [],
      rowCount: insight.departments.length,
      status: "success",
    }
  );

  console.log("[conversation.response] database-backed", {
    dataset: DEPARTMENT_TRAINING_DATASET,
    mode,
    departments: insight.departments.length,
    topDepartment: leader?.departmentName,
  });

  return {
    handled: true,
    plan,
    answer,
    datasetTried: [DEPARTMENT_TRAINING_DATASET],
  };
}

/**
 * Attempts to answer entirely from the backend.
 *
 * `handled: false` means the caller should use the LLM instead - it never means
 * "make something up".
 */
export async function tryAnswerFromDatabase(
  context: DatabaseFirstContext,
  question: string
): Promise<DatabaseFirstResult> {
  const directory = await loadDirectory(context);

  const plan = planQuestion(question, {
    directory,
    allowedDatasets: context.allowedDatasets,
  });

  console.log("[conversation.intent]", {
    capability: plan.capability,
    needsData: plan.needsData,
    advisory: plan.advisory,
    rule: plan.matchedRule,
    dataset: plan.dataset,
    confidence: plan.confidence,
  });

  if (plan.advisory) {
    return { handled: false, plan, reason: "advisory" };
  }

  if (plan.unsupportedTopic) {
    console.log("[conversation.response] unsupported-module", {
      topic: plan.unsupportedTopic,
    });
    return {
      handled: true,
      plan,
      answer: composeUnsupportedTopicAnswer(plan.unsupportedTopic),
    };
  }

  const followUpState = getFollowUpState(
    context.userId || "anonymous",
    context.sessionId
  );
  const previousQuery = followUpState?.queries[0];

  /* ------------------------------------------------------------------ *
   * Composite insight: department level competency questions.
   *
   * Runs when the planner asked for it, or when a follow-up refers back to a
   * previous department insight ("why?", "show me the other departments").
   * ------------------------------------------------------------------ */
  /**
   * A follow-up continues the insight only when it is still asking about the
   * *departments* ("why?", "show me the others"). A follow-up that asks about a
   * different attribute - "what skills are missing there?" - must go down the
   * normal dataset path, where the remembered department is applied as a filter.
   */
  const asksAboutTheRanking = /\bwhy\b|\bhow come\b|\bother|\brest\b|\bremaining\b/i.test(
    question
  );

  const followsDepartmentInsight =
    previousQuery?.dataset === DEPARTMENT_TRAINING_DATASET &&
    looksLikeFollowUp(question) &&
    (asksAboutTheRanking || !plan.dataset);

  if (plan.insight === "department_training" || followsDepartmentInsight) {
    const insightResult = await runDepartmentTrainingInsight(
      context,
      directory,
      question,
      plan,
      followsDepartmentInsight
    );

    // Only take over when there is something real to say; otherwise fall
    // through so the existing generic path answers exactly as it does today.
    if (insightResult) return insightResult;
  }

  let dataset = plan.dataset;
  let fallbacks = plan.fallbackDatasets;
  let filters = plan.filters;
  let shape = plan.shape;
  let isFollowUpReuse = false;

  // No rule matched, but the question reads as a follow-up: reuse the last
  // dataset so "show me the skills" resolves against the previous query.
  if (!dataset && previousQuery && looksLikeFollowUp(question)) {
    dataset = previousQuery.dataset;
    fallbacks = [];
    shape = "list";
    isFollowUpReuse = true;
    console.log("[conversation.intent] follow-up reuse", {
      dataset,
      from: previousQuery.dataset,
    });
  }

  if (!dataset) {
    return { handled: false, plan, reason: "no_rule_matched" };
  }

  if (previousQuery) {
    filters = mergeFollowUpFilters(previousQuery, filters);
  }

  const candidates = [dataset, ...fallbacks];
  const tried: string[] = [];
  /**
   * Kept so a terminal failure is reported against what the user actually asked
   * for, rather than against whichever fallback happened to be tried last
   * ("I couldn't read skill coverage matrix" for a skill-gap question).
   */
  let primaryOutcome: ModuleDataOutcome | undefined;
  let lastOutcome: ModuleDataOutcome | undefined;

  for (const candidate of candidates) {
    tried.push(candidate);

    console.log("[conversation.tool]", {
      tool: "getModuleData",
      dataset: candidate,
      source: getDataset(candidate)?.path,
    });

    const outcome = await fetchModuleData(context, {
      dataset: candidate,
      filters: filters as never,
    });

    lastOutcome = outcome;
    if (!primaryOutcome) primaryOutcome = outcome;

    console.log("[conversation.data]", {
      dataset: candidate,
      status: outcome.status,
      records:
        outcome.status === "success" ? (outcome.rowCount ?? "object") : 0,
    });

    if (outcome.status === "success" || outcome.status === "empty") {
      recordFollowUpQuery(
        { userId: context.userId || "anonymous", sessionId: context.sessionId },
        {
          dataset: outcome.dataset,
          moduleId: outcome.moduleId,
          label: getDataset(outcome.dataset)?.label,
          source: outcome.source,
          filters: outcome.appliedFilters,
          resolvedEntities: outcome.resolvedEntities,
          rowCount: "rowCount" in outcome ? outcome.rowCount : undefined,
          status: outcome.status,
        }
      );
    }

    /**
     * Anything except "the endpoint could not be read" is a real answer.
     *
     * `empty` in particular is a *result*: the primary dataset is the one that
     * matches the question, so "no skill gaps recorded" is the honest reply -
     * substituting a fallback dataset would answer a different question.
     */
    if (outcome.status !== "unavailable") {
      const answer = composeFor(outcome, shape, question, isFollowUpReuse);
      console.log("[conversation.response] database-backed", {
        dataset: candidate,
        status: outcome.status,
        rows: answer.rowCount,
      });

      return { handled: true, plan, answer, outcome, datasetTried: tried };
    }

    // Unavailable: the endpoint itself failed, so a sibling may still answer.
  }

  // Every candidate was unavailable. Report against the dataset the question
  // actually asked for.
  const reportable = primaryOutcome ?? lastOutcome;
  if (reportable) {
    const answer = composeFor(reportable, shape, question, isFollowUpReuse);
    console.log("[conversation.response] database-backed", {
      dataset: reportable.dataset,
      status: reportable.status,
      rows: answer.rowCount ?? 0,
    });

    return { handled: true, plan, answer, outcome: reportable, datasetTried: tried };
  }

  return { handled: false, plan, reason: "all_datasets_failed", datasetTried: tried };
}
