import { routes } from "../resources/routes.ts";

export const routeRegistry = {
  ...routes,
  leave_pattern_anomaly: {
    tool: "queryBusinessData",
    flow: "leavePatternAnomaly"
  }
};
