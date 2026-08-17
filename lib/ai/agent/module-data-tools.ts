/**
 * Module data tools for the Conversational AI.
 *
 * These sit alongside the existing MCP-backed tools in ./chat-tools.ts and give
 * the assistant read access to every G2G module through the Laravel APIs the
 * screens already use. Nothing here queries a database directly and nothing
 * here returns fabricated content: each tool hands back the backend's own
 * answer, or an explicit statement that the answer is unavailable.
 *
 * Three tools, in the order the model normally needs them:
 *
 *  listModules    - what modules and datasets this installation actually has
 *  resolveEntity  - turn a spoken name into the id Laravel requires
 *  getModuleData  - read one dataset from its existing backend route
 */

import { tool } from "ai";
import { z } from "zod";
import {
  describeModules,
  listDatasetIds,
} from "@/lib/ai/backend/module-catalog";
import {
  loadDirectorySnapshot,
  resolveEntity as resolveDirectoryEntity,
} from "@/lib/ai/backend/directory.service";
import { fetchModuleData } from "@/lib/ai/backend/module-data.service";
import type { LaravelRuntimeContext } from "@/lib/ai/backend/laravel-gateway";
import { recordAuditEvent } from "@/lib/ai/audit/audit-log.service";
import { recordFollowUpQuery } from "@/lib/ai/conversation/followup.service";

export interface ModuleToolContext extends LaravelRuntimeContext {
  sessionId: string;
  role?: string;
  /** Dataset ids the caller's role is allowed to read. */
  allowedDatasets?: string[];
}

const datasetIds = listDatasetIds();

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const filtersSchema = z
  .object({
    departmentName: z
      .string()
      .optional()
      .describe("Department as the user said it, e.g. 'Engineering'. Resolved to an id."),
    employeeName: z
      .string()
      .optional()
      .describe("Employee name or employee number as the user said it. Resolved to an id."),
    leaveTypeName: z
      .string()
      .optional()
      .describe("Leave type as the user said it, e.g. 'Sick Leave'. Resolved to an id."),
    departmentId: z.string().optional().describe("Department id, if already known."),
    employeeId: z.string().optional().describe("Employee id, if already known."),
    leaveTypeId: z.string().optional().describe("Leave type id, if already known."),
    status: z
      .array(z.string())
      .optional()
      .describe("Status filter, e.g. ['pending'] for leave requests awaiting approval."),
    fromDate: dateSchema.optional(),
    toDate: dateSchema.optional(),
    search: z.string().optional().describe("Free text search, where the endpoint supports it."),
    calendarYear: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
    page: z.number().int().positive().optional(),
    perPage: z.number().int().positive().max(100).optional(),
  })
  .optional();

function isDatasetAllowed(context: ModuleToolContext, dataset: string) {
  if (!context.allowedDatasets) return true;
  return context.allowedDatasets.includes(dataset);
}

export function createModuleDataTools(context: ModuleToolContext) {
  return {
    listModules: tool({
      description:
        "List the modules this G2G installation actually has, with the datasets each one can answer from. Call this when unsure which module or dataset a question belongs to. The module list is read from the live application navigation, not hardcoded.",
      inputSchema: z.object({
        moduleId: z
          .string()
          .optional()
          .describe("Restrict the result to one module id, e.g. 'm5'."),
      }),
      execute: async ({ moduleId }: { moduleId?: string }) => {
        const modules = describeModules()
          .filter((navModule) => !moduleId || navModule.moduleId === moduleId)
          .map((navModule) => ({
            ...navModule,
            datasets: navModule.datasets.filter((dataset) =>
              isDatasetAllowed(context, dataset.id)
            ),
          }));

        return {
          status: "success" as const,
          modules,
          note: "Datasets listed here are readable with the current user's role. Modules with no datasets exist in the UI but expose no queryable backend data yet.",
        };
      },
    }),

    resolveEntity: tool({
      description:
        "Resolve a spoken employee, department or leave type name into the id the backend requires, or list the available options. Use this before asking the user to repeat themselves, and use its ambiguous result to ask which record they meant. Never invent an id.",
      inputSchema: z.object({
        kind: z.enum(["employee", "department", "leaveType"]),
        query: z
          .string()
          .optional()
          .describe("The name to resolve. Omit to list the available options instead."),
        departmentName: z
          .string()
          .optional()
          .describe("Narrow an employee search to one department."),
        departmentId: z.string().optional(),
      }),
      execute: async (input: {
        kind: "employee" | "department" | "leaveType";
        query?: string;
        departmentName?: string;
        departmentId?: string;
      }) => {
        // No query means "what are the options?" - list them from the directory.
        if (!input.query) {
          const loaded = await loadDirectorySnapshot(context);

          if (!loaded.ok) {
            return {
              status: "unavailable" as const,
              kind: input.kind,
              message: loaded.message,
            };
          }

          const all =
            input.kind === "employee"
              ? loaded.snapshot.employees
              : input.kind === "department"
                ? loaded.snapshot.departments
                : loaded.snapshot.leaveTypes;

          return {
            status: "success" as const,
            kind: input.kind,
            total: all.length,
            options: all.slice(0, 100),
            truncated: all.length > 100,
          };
        }

        let departmentId = input.departmentId;

        if (!departmentId && input.departmentName) {
          const department = await resolveDirectoryEntity(
            context,
            "department",
            input.departmentName
          );
          if (department.status === "resolved") departmentId = department.match.id;
        }

        return resolveDirectoryEntity(context, input.kind, input.query, {
          departmentId,
        });
      },
    }),

    getModuleData: tool({
      description:
        "Read real data for one dataset from the G2G backend. This is the only source of truth for any question about employees, departments, attendance, leave, learning, competency, recruitment, tasks, reports or the organization itself. Names in filters are resolved to ids automatically. If the result is empty or unavailable, say so - never fill the gap with an estimate.",
      inputSchema: z.object({
        dataset: z
          .enum(datasetIds as [string, ...string[]])
          .describe("Dataset id from listModules."),
        filters: filtersSchema,
        reason: z
          .string()
          .optional()
          .describe("One line on why this dataset answers the question. For the audit log."),
      }),
      execute: async (input: {
        dataset: string;
        filters?: Record<string, unknown>;
        reason?: string;
      }) => {
        if (!isDatasetAllowed(context, input.dataset)) {
          return {
            status: "forbidden" as const,
            dataset: input.dataset,
            message: `The current user's role (${context.role || "unknown"}) is not permitted to read ${input.dataset}. Tell the user they do not have access rather than answering from assumption.`,
          };
        }

        const outcome = await fetchModuleData(context, {
          dataset: input.dataset,
          filters: (input.filters ?? {}) as never,
        });

        recordAuditEvent(
          "tool.execution",
          {
            tool: "getModuleData",
            dataset: input.dataset,
            status: outcome.status,
            reason: input.reason,
            source: "source" in outcome ? outcome.source : undefined,
          },
          { userId: context.userId, organizationId: context.orgId }
        );

        // Remember the query so the next turn can resolve "their names" or
        // "what about Division C" without the user repeating the filters.
        if (outcome.status === "success" || outcome.status === "empty") {
          recordFollowUpQuery(
            {
              userId: context.userId || "anonymous",
              sessionId: context.sessionId,
            },
            {
              dataset: outcome.dataset,
              moduleId: outcome.moduleId,
              label: "label" in outcome ? outcome.label : undefined,
              source: outcome.source,
              filters: outcome.appliedFilters,
              resolvedEntities: outcome.resolvedEntities,
              rowCount: "rowCount" in outcome ? outcome.rowCount : undefined,
              status: outcome.status,
            }
          );
        }

        return outcome;
      },
    }),
  };
}
