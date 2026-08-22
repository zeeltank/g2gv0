type RawApiPayload = Record<string, unknown> | Array<Record<string, unknown>>;

export interface SkillGapOption {
  id: number | string | null;
  name: string;
  expectedProficiency?: number;
  proficiencyLevel?: number;
  category?: string;
  subCategory?: string;
  description?: string;
  criticalWorkFunction?: string;
  jobRole?: string;
}

function resolveHpBaseUrl() {
  const configuredBase =
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_API_BASE_URL_PROD
      : process.env.NEXT_PUBLIC_API_BASE_URL_DEV;

  const fallbackBase = process.env.NEXT_PUBLIC_API_URL || "https://hp.triz.co.in";
  const base = (configuredBase || fallbackBase).trim().replace(/\/+$/, "");

  return base.endsWith("/api") ? base.slice(0, -4) : base;
}

function toAbsoluteUrl(urlOrPath: string) {
  if (/^https?:\/\//i.test(urlOrPath)) {
    return urlOrPath;
  }

  return `${resolveHpBaseUrl()}${urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`}`;
}

async function fetchJson(urlOrPath: string, token?: string): Promise<RawApiPayload> {
  const response = await fetch(toAbsoluteUrl(urlOrPath), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HP API request failed (${response.status}) for ${urlOrPath}`);
  }

  return (await response.json()) as RawApiPayload;
}

function getArrayPayload(payload: RawApiPayload): Array<Record<string, any>> {
  if (Array.isArray(payload)) {
    return payload as Array<Record<string, any>>;
  }

  if (Array.isArray((payload as any).data)) {
    return (payload as any).data;
  }

  if (Array.isArray((payload as any).result)) {
    return (payload as any).result;
  }

  if (Array.isArray((payload as any).skill)) {
    return (payload as any).skill;
  }

  if (Array.isArray((payload as any).skills)) {
    return (payload as any).skills;
  }

  if (Array.isArray((payload as any).rows)) {
    return (payload as any).rows;
  }

  return [];
}

function withSubInstituteFilter(subInstituteId?: string | number) {
  return subInstituteId ? `&filters[sub_institute_id]=${encodeURIComponent(String(subInstituteId))}` : "";
}

export async function fetchIndustries() {
  const payload = await fetchJson("/table_data?table=s_industries&group_by=industries");

  return getArrayPayload(payload).map((item) => ({
    id: item.id || null,
    name: item.industries || item.industry_name || item.name || String(item),
  }));
}

export async function fetchDepartmentsByIndustry(industry: string) {
  const payload = await fetchJson(
    `/table_data?table=s_industries&filters[industries]=${encodeURIComponent(industry)}&group_by=department`
  );

  return getArrayPayload(payload).map((item) => ({
    id: item.id || null,
    name: item.department || item.department_name || String(item),
  }));
}

export async function fetchJobRolesByIndustryAndDepartment(
  industry: string,
  department: string,
  subInstituteId?: string | number
) {
  const payload = await fetchJson(
    `/table_data?table=s_user_jobrole&filters[industries]=${encodeURIComponent(industry)}&filters[department]=${encodeURIComponent(department)}${withSubInstituteFilter(subInstituteId)}&group_by=jobrole`
  );

  return getArrayPayload(payload).map((item) => ({
    id: item.id || null,
    name: item.jobrole || item.job_role || item.jobRoleName || String(item),
  }));
}

export async function searchJobRoleByName(
  jobRole: string,
  subInstituteId?: string | number
) {
  const payload = await fetchJson(
    `/table_data?table=s_user_jobrole&filters[jobrole]=${encodeURIComponent(jobRole)}${withSubInstituteFilter(subInstituteId)}`
  );

  return getArrayPayload(payload);
}

export async function fetchSkillsByJobRole(
  jobRole: string,
  options?: {
    jobRoleId?: string | number;
    subInstituteId?: string | number;
    /** The caller's Laravel token. /get-kaba now requires one. */
    token?: string;
  }
): Promise<SkillGapOption[]> {
  const { jobRoleId, subInstituteId, token } = options || {};

  /*
   * /get-kaba REQUIRES A TOKEN NOW.
   *
   * It used to be unauthenticated, which is how this server-side helper could
   * call it with no credential at all. The endpoint now takes the tenant from
   * the token and refuses anonymous callers.
   *
   * This chain does not carry a token today - SkillGapInput has no such field -
   * so rather than invent one, an untokened call falls back to the by-name
   * branch this function already had for roles with no id. That keeps the
   * assistant working and keeps the anonymous call out of the codebase. When a
   * token is threaded through the AI context, the id branch resumes.
   */
  const payload = jobRoleId && token
    ? await fetchJson(
        `/get-kaba?sub_institute_id=${encodeURIComponent(String(subInstituteId || ""))}&type=jobrole&type_id=${encodeURIComponent(String(jobRoleId))}&title=${encodeURIComponent(jobRole)}`,
        token
      )
    : await fetchJson(
        `/table_data?table=s_user_skill_jobrole&filters[jobrole]=${encodeURIComponent(jobRole)}${withSubInstituteFilter(subInstituteId)}&group_by=skill`
      );

  return getArrayPayload(payload).map((item) => ({
    id: item.id || item.skill_id || item.jobrole_skill_id || null,
    name: item.title || item.skill || item.skillName || item.skill_name || String(item),
    category: item.category || item.Category || item.skill_category || "",
    subCategory: item.sub_category || item.subCategory || item.sub_category_name || "",
    description: item.description || item.Description || item.skill_description || "",
    expectedProficiency:
      Number.parseInt(String(item.proficiency_level || item.proficiencyLevel || item.expected_proficiency || item.expectedProficiency || 3), 10) || 3,
    proficiencyLevel:
      Number.parseInt(String(item.proficiency_level || item.proficiencyLevel || item.expected_proficiency || item.expectedProficiency || 3), 10) || 3,
  }));
}

export async function fetchTasksByJobRole(
  jobRole: string,
  subInstituteId?: string | number
): Promise<SkillGapOption[]> {
  const payload = await fetchJson(
    `/table_data?table=s_user_jobrole_task&filters[jobrole]=${encodeURIComponent(jobRole)}${withSubInstituteFilter(subInstituteId)}`
  );

  return getArrayPayload(payload).map((item) => ({
    id: item.id || null,
    name:
      item.task ||
      item.responsibility ||
      item.description ||
      item.key_responsibility ||
      String(item),
    criticalWorkFunction: item.critical_work_function || item.cwf || "",
    jobRole: item.jobrole || jobRole,
  }));
}

export async function fetchCourseRecommendationData(
  userId: string | number,
  subInstituteId: string | number
) {
  if (!process.env.HP_API_TOKEN) {
    throw new Error("HP_API_TOKEN is required for course recommendations.");
  }

  const payload = (await fetchJson(
    `/courses-recommendation?sub_institute_id=${encodeURIComponent(String(subInstituteId))}&user_id=${encodeURIComponent(String(userId))}&token=${encodeURIComponent(process.env.HP_API_TOKEN)}`
  )) as Record<string, any>;

  return {
    success: Boolean(payload.success),
    message: payload.message || "",
    data: Array.isArray(payload.data) ? payload.data : [],
  };
}
