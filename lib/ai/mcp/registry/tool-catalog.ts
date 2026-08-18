import type {
  ConversationDomain,
  ConversationType,
} from "../../conversation/schemas";

export type ToolRiskLevel = "low" | "medium" | "high";
export type RegisteredToolName =
  | "queryBusinessData"
  | "skillGapAnalysis"
  | "recommendCourses"
  | "generateJobRoleCompetency"
  | "getContextualSuggestions"
  // Cross-module live data access through the existing Laravel APIs.
  | "listModules"
  | "resolveEntity"
  | "getModuleData";

export interface ConversationalToolDefinition {
  name: RegisteredToolName;
  description: string;
  domain: ConversationDomain;
  supportedRoles: string[];
  requiredPermissions: string[];
  riskLevel: ToolRiskLevel;
  requiresConfirmation: boolean;
  conversationTypes: ConversationType[];
  capabilities: string[];
}

export const conversationalToolCatalog: ConversationalToolDefinition[] = [
  {
    name: "queryBusinessData",
    description:
      "Leave analytics and business intelligence for leave risk, patterns, burden, and balance issues.",
    domain: "people_competency",
    supportedRoles: ["admin", "hr", "dept-head"],
    requiredPermissions: ["leave:analytics:read"],
    riskLevel: "medium",
    requiresConfirmation: false,
    conversationTypes: ["ask", "analyse", "recommend", "monitor", "coach"],
    capabilities: [
      "leave_analytics",
      "leave_risk",
      "department_leave_risk",
      "attendance_pattern",
    ],
  },
  {
    name: "skillGapAnalysis",
    description:
      "Skill gap discovery flow for industries, departments, roles, skills, tasks, and final report generation.",
    domain: "people_competency",
    supportedRoles: ["admin", "hr", "dept-head", "employee"],
    requiredPermissions: ["competency:skill-gap:read"],
    riskLevel: "low",
    requiresConfirmation: false,
    conversationTypes: ["ask", "guide", "analyse", "recommend", "coach"],
    capabilities: [
      "skill_gap",
      "competency_gap",
      "job_role_skills",
      "responsibilities",
    ],
  },
  {
    name: "recommendCourses",
    description:
      "Course recommendations driven by peer enrollments and role-aligned learning data.",
    domain: "people_competency",
    supportedRoles: ["admin", "hr", "dept-head", "employee"],
    requiredPermissions: ["learning:recommendation:read"],
    riskLevel: "low",
    requiresConfirmation: false,
    conversationTypes: ["ask", "recommend", "coach"],
    capabilities: [
      "course_recommendation",
      "training_recommendation",
      "learning_suggestions",
    ],
  },
  {
    name: "generateJobRoleCompetency",
    description:
      "Generates structured job role competency frameworks and critical work functions.",
    domain: "people_competency",
    supportedRoles: ["admin", "hr", "dept-head"],
    requiredPermissions: ["competency:framework:generate"],
    riskLevel: "medium",
    requiresConfirmation: false,
    conversationTypes: ["learn", "guide", "recommend", "automate"],
    capabilities: [
      "job_role_competency",
      "kasba",
      "job_description_support",
      "hiring_preparation",
    ],
  },
  {
    name: "getContextualSuggestions",
    description:
      "Provides LMS contextual guidance and next-question suggestions for learning modules.",
    domain: "shared",
    supportedRoles: ["admin", "hr", "dept-head", "employee"],
    requiredPermissions: ["assistant:suggestions:read"],
    riskLevel: "low",
    requiresConfirmation: false,
    conversationTypes: ["guide", "learn", "coach"],
    capabilities: [
      "contextual_guidance",
      "lms_help",
      "task_help",
      "on_page_assistance",
    ],
  },
  {
    name: "listModules",
    description:
      "Lists the modules this installation has (read from the live application navigation) and the datasets each one can answer from.",
    domain: "shared",
    supportedRoles: ["admin", "hr", "dept-head", "employee"],
    requiredPermissions: ["assistant:modules:read"],
    riskLevel: "low",
    requiresConfirmation: false,
    conversationTypes: ["ask", "guide", "learn", "analyse", "recommend", "coach"],
    capabilities: ["module_discovery", "capability_discovery", "system_overview"],
  },
  {
    name: "resolveEntity",
    description:
      "Resolves employee, department and leave type names into the ids the backend requires, and lists the available options.",
    domain: "shared",
    supportedRoles: ["admin", "hr", "dept-head", "employee"],
    requiredPermissions: ["assistant:directory:read"],
    riskLevel: "low",
    requiresConfirmation: false,
    conversationTypes: ["ask", "guide", "analyse", "recommend", "coach", "learn"],
    capabilities: ["entity_resolution", "employee_lookup", "department_lookup"],
  },
  {
    name: "getModuleData",
    description:
      "Reads live G2G data for one dataset through the existing Laravel module APIs. The single source of truth for every system data question.",
    domain: "shared",
    supportedRoles: ["admin", "hr", "dept-head", "employee"],
    requiredPermissions: ["assistant:module-data:read"],
    riskLevel: "medium",
    requiresConfirmation: false,
    conversationTypes: ["ask", "analyse", "recommend", "monitor", "coach", "guide", "learn"],
    capabilities: [
      "module_data",
      "organization_data",
      "employee_data",
      "attendance_data",
      "leave_data",
      "learning_data",
      "competency_data",
      "talent_data",
      "task_data",
      "reports_data",
    ],
  },
];

export function isRegisteredToolName(
  name: string
): name is RegisteredToolName {
  return conversationalToolCatalog.some((tool) => tool.name === name);
}

export function getToolDefinition(name: string) {
  return conversationalToolCatalog.find((tool) => tool.name === name);
}

export function getToolsForConversationType(type: ConversationType) {
  return conversationalToolCatalog.filter((tool) =>
    tool.conversationTypes.includes(type)
  );
}

export function getToolsForDomain(domain: ConversationDomain) {
  return conversationalToolCatalog.filter(
    (tool) => tool.domain === domain || tool.domain === "shared"
  );
}
