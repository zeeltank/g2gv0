import type { z } from "zod";

export interface ProjectToolCatalogEntry {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  requiredPermissions: string[];
  capabilities: string[];
}

export interface ProjectMcpCapabilitySnapshot {
  tools: Array<{
    name: string;
    description: string;
  }>;
}
