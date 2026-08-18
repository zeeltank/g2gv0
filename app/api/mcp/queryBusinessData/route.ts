import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { queryBusinessData } from "@/lib/mcp/client/mcpClient";

export const runtime = "nodejs";

const queryBusinessDataRouteSchema = z.object({
  analysisType: z.enum([
    "total_leave_risk",
    "monday_leave_pattern",
    "friday_leave_pattern",
    "unplanned_leave_pattern",
    "leave_clustering",
    "employee_leave_frequency",
    "employee_leave_days_consumed",
    "department_leave_burden",
    "leave_type_utilization",
    "leave_consumption_percentage",
    "leave_balance_risk",
    "leave_type_exhaustion",
    "department_leave_risk",
    "department_unplanned_leave",
  ]),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = queryBusinessDataRouteSchema.parse(body);
    const result = await queryBusinessData(input);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid MCP queryBusinessData payload.",
          issues: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("[api/mcp/queryBusinessData] request failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to execute the MCP queryBusinessData tool.",
      },
      { status: 500 }
    );
  }
}
