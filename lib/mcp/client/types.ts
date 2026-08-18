// src/lib/mcp/client/types.ts

export type BusinessIntent = "leave_pattern_anomaly";

export type LeaveAnalysisType =
  | "total_leave_risk"
  | "monday_leave_pattern"
  | "friday_leave_pattern"
  | "unplanned_leave_pattern"
  | "leave_clustering"
  | "employee_leave_frequency"
  | "employee_leave_days_consumed"
  | "department_leave_burden"
  | "leave_type_utilization"
  | "leave_consumption_percentage"
  | "leave_balance_risk"
  | "leave_type_exhaustion"
  | "department_leave_risk"
  | "department_unplanned_leave";

export interface QueryBusinessDataInput {
  analysisType: LeaveAnalysisType;
  fromDate?: string;
  toDate?: string;
  start_date?: string;
  end_date?: string;
}

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpToolResult<TStructured = Record<string, unknown>> {
  content: McpTextContent[];
  structuredContent?: TStructured;
  isError?: boolean;
}
