export interface OnboardingOrganization {
  companyName: string;
  timeZone: string;
  currency: string;
  financialYear: string;
  country: string;
  industry: string;
}

export interface OnboardingEmployeeSummary {
  total: number;
  successful: number;
  warnings: number;
  errors: number;
}

export interface OnboardingRoleSummary {
  roles: string[];
  permissionCount: number;
}

export interface OnboardingSummary {
  selectedModules: Array<{ id: string; name: string }>;
  organization: OnboardingOrganization | null;
  departments: string[];
  employees: OnboardingEmployeeSummary | null;
  roles: OnboardingRoleSummary | null;
  updatedAt: string | null;
}

export const EMPTY_ONBOARDING: OnboardingSummary = {
  selectedModules: [], organization: null, departments: [],
  employees: null, roles: null, updatedAt: null,
};

export async function updateOnboarding(userId: string, update: Partial<OnboardingSummary>) {
  const response = await fetch(`/api/onboarding?userId=${encodeURIComponent(userId)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error("Unable to save onboarding configuration");
  return response.json() as Promise<OnboardingSummary>;
}
