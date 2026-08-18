import type { ConversationIntent, ConversationUserContext } from "./schemas";
import {
  getToolDefinition,
  type RegisteredToolName,
} from "../mcp/registry/tool-catalog";
import { DATASETS } from "../backend/module-catalog";

/**
 * Module data permissions mirror the screen visibility already defined in
 * lib/gtg-nav-visibility.ts, so the assistant can never read something the role
 * cannot already open in the UI. In particular `attendance-reports`,
 * `leave-reports` and `leave-configuration` are admin/HR only there, and the
 * corresponding *:reports:read / *:config:read keys below follow that.
 */
const moduleDataPermissionsForAllRoles = [
  "assistant:modules:read",
  "assistant:directory:read",
  "assistant:module-data:read",
  "organization:data:read",
  "competency:data:read",
  "talent:data:read",
  "learning:data:read",
  "task:data:read",
  "leave:data:read",
  "attendance:data:read",
  "attendance:self:read",
];

const reportingPermissions = [
  "leave:reports:read",
  "leave:config:read",
  "attendance:reports:read",
  "reports:data:read",
];

const rolePermissions: Record<string, string[]> = {
  admin: ["*"],
  hr: [
    "leave:analytics:read",
    "competency:skill-gap:read",
    "learning:recommendation:read",
    "competency:framework:generate",
    "assistant:suggestions:read",
    ...moduleDataPermissionsForAllRoles,
    ...reportingPermissions,
  ],
  "dept-head": [
    "leave:analytics:read",
    "competency:skill-gap:read",
    "learning:recommendation:read",
    "competency:framework:generate",
    "assistant:suggestions:read",
    ...moduleDataPermissionsForAllRoles,
  ],
  employee: [
    "competency:skill-gap:read",
    "learning:recommendation:read",
    "assistant:suggestions:read",
    ...moduleDataPermissionsForAllRoles,
  ],
};

function hasPermission(role: string | undefined, permission: string) {
  if (!role) {
    return false;
  }

  const permissions = rolePermissions[role] || [];
  return permissions.includes("*") || permissions.includes(permission);
}

export function validateConversationPermission(
  intent: ConversationIntent,
  user: ConversationUserContext
) {
  if (!intent.requiredPermission) {
    return;
  }

  if (!hasPermission(user.role, intent.requiredPermission)) {
    throw new Error(
      `Permission denied for ${intent.requiredPermission}. Role ${user.role || "unknown"} cannot perform this action.`
    );
  }
}

export function getAllowedToolNames(user: ConversationUserContext) {
  const role = user.role;

  const toolNames: RegisteredToolName[] = [
    "queryBusinessData",
    "skillGapAnalysis",
    "recommendCourses",
    "generateJobRoleCompetency",
    "getContextualSuggestions",
    "listModules",
    "resolveEntity",
    "getModuleData",
  ];

  return toolNames.filter(
    (toolName) => {
      const definition = getToolDefinition(toolName);
      if (!definition) {
        return false;
      }

      return definition.requiredPermissions.every((permission) =>
        hasPermission(role, permission)
      );
    }
  );
}

/**
 * Which datasets the role may read. Passed to the module data tool so a
 * forbidden dataset is refused before any backend call is made, and so the
 * dataset index in the system prompt only advertises readable datasets.
 */
export function getAllowedDatasetIds(user: ConversationUserContext) {
  return DATASETS.filter((dataset) =>
    hasPermission(user.role, dataset.permission)
  ).map((dataset) => dataset.id);
}
