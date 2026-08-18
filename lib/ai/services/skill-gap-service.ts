import {
  fetchDepartmentsByIndustry,
  fetchIndustries,
  fetchJobRolesByIndustryAndDepartment,
  fetchSkillsByJobRole,
  fetchTasksByJobRole,
  searchJobRoleByName,
  type SkillGapOption,
} from "./hp-api.ts";

export interface SkillGapRating {
  id?: string | number | null;
  name: string;
  expectedProficiency?: number;
  userRating?: number;
}

export type SkillGapOperation =
  | "industries"
  | "departments"
  | "jobRoles"
  | "skills"
  | "tasks"
  | "report";

export interface SkillGapToolInput {
  operation: SkillGapOperation;
  industry?: string;
  department?: string;
  jobRole?: string;
  jobRoleId?: string | number;
  subInstituteId?: string | number;
  skills?: SkillGapRating[];
}

function getStepMessage(operation: SkillGapOperation, context?: string) {
  switch (operation) {
    case "industries":
      return "Select your industry from the available options.";
    case "departments":
      return context
        ? `Select your department in ${context}.`
        : "Select your department.";
    case "jobRoles":
      return context
        ? `Select your job role in ${context}.`
        : "Select your job role.";
    case "skills":
      return context
        ? `Select your skills for ${context}.`
        : "Select your skills.";
    case "tasks":
      return context
        ? `Review job responsibilities for ${context}.`
        : "Review job responsibilities.";
    default:
      return "Skill gap analysis result ready.";
  }
}

async function resolveJobRoleId(
  jobRole: string,
  subInstituteId?: string | number
) {
  const rows = await searchJobRoleByName(jobRole, subInstituteId);
  const normalized = jobRole.trim().toLowerCase();

  const matched = rows.find((row) => {
    const candidate = String(row.jobrole || row.jobRole || row.job_role || "")
      .trim()
      .toLowerCase();
    return candidate === normalized;
  });

  return matched?.id ? String(matched.id) : undefined;
}

function buildSkillGapReport(skills: SkillGapRating[]) {
  if (!skills.length) {
    throw new Error("At least one skill rating is required to generate a skill gap report.");
  }

  const totalSkills = skills.length;
  const totalUserRating = skills.reduce((sum, skill) => sum + (skill.userRating || 0), 0);
  const avgUserRating = totalSkills > 0 ? totalUserRating / totalSkills : 0;

  const totalExpectedProficiency = skills.reduce(
    (sum, skill) => sum + (skill.expectedProficiency || 3),
    0
  );
  const avgExpectedProficiency =
    totalSkills > 0 ? totalExpectedProficiency / totalSkills : 3;

  const overallSkillIndex =
    avgExpectedProficiency > 0
      ? (avgUserRating / avgExpectedProficiency) * 100
      : 0;

  const performanceChange = avgUserRating - avgExpectedProficiency;
  const skillGap = avgExpectedProficiency - avgUserRating;
  const skillGapPercentage =
    avgExpectedProficiency > 0
      ? Math.round((skillGap / avgExpectedProficiency) * 100)
      : 0;

  let performanceLabel = "";
  let skillGapCategory = "";
  let skillGapEmoji = "";

  if (skillGapPercentage <= 20) {
    skillGapCategory = "Strong";
    skillGapEmoji = "OK";
    performanceLabel = "Excellent";
  } else if (skillGapPercentage <= 60) {
    skillGapCategory = "Moderate";
    skillGapEmoji = "Warning";
    performanceLabel = skillGapPercentage <= 40 ? "Good" : "Average";
  } else {
    skillGapCategory = "Critical";
    skillGapEmoji = "Critical";
    performanceLabel = "Needs Improvement";
  }

  const topPrioritySkills = skills
    .map((skill) => ({
      name: skill.name,
      rated: skill.userRating || 0,
      expected: skill.expectedProficiency || 3,
      gap: (skill.expectedProficiency || 3) - (skill.userRating || 0),
    }))
    .sort((left, right) => right.gap - left.gap)
    .slice(0, 5)
    .filter((skill) => skill.gap > 0);

  const answer = [
    "Skill Gap Report",
    `Overall Skill Index: ${avgUserRating.toFixed(1)} / ${avgExpectedProficiency.toFixed(1)} (${Math.round(overallSkillIndex)}%)`,
    `Overall Skill Gap: ${skillGap.toFixed(1)} points (${skillGapPercentage}% below target)`,
    `Status: ${skillGapCategory}`,
    `Performance Level: ${performanceLabel}`,
    topPrioritySkills.length
      ? `Top Improvement Areas: ${topPrioritySkills
          .map((skill) => `${skill.name} (${skill.gap.toFixed(1)})`)
          .join(", ")}`
      : "Top Improvement Areas: All skills meet or exceed expectations.",
  ].join("\n");

  return {
    avgUserRating,
    avgExpectedProficiency,
    overallSkillIndex,
    performanceChange,
    skillGap,
    skillGapPercentage,
    skillGapCategory,
    skillGapEmoji,
    performanceLabel,
    topPrioritySkills,
    totalSkills,
    answer,
  };
}

export async function runSkillGapAnalysis(input: SkillGapToolInput) {
  switch (input.operation) {
    case "industries": {
      const data = await fetchIndustries();
      return {
        operation: input.operation,
        currentStep: "industry",
        nextStep: "department",
        message: getStepMessage("industries"),
        data,
      };
    }
    case "departments": {
      if (!input.industry) {
        throw new Error("industry is required for department lookup.");
      }

      const data = await fetchDepartmentsByIndustry(input.industry);
      return {
        operation: input.operation,
        currentStep: "department",
        nextStep: "jobRole",
        message: getStepMessage("departments", input.industry),
        data,
      };
    }
    case "jobRoles": {
      if (!input.industry || !input.department) {
        throw new Error("industry and department are required for job role lookup.");
      }

      const data = await fetchJobRolesByIndustryAndDepartment(
        input.industry,
        input.department,
        input.subInstituteId
      );

      return {
        operation: input.operation,
        currentStep: "jobRole",
        nextStep: "skills",
        message: getStepMessage("jobRoles", input.department),
        data,
      };
    }
    case "skills": {
      if (!input.jobRole) {
        throw new Error("jobRole is required for skill lookup.");
      }

      const jobRoleId =
        input.jobRoleId || (await resolveJobRoleId(input.jobRole, input.subInstituteId));

      const data = await fetchSkillsByJobRole(input.jobRole, {
        jobRoleId,
        subInstituteId: input.subInstituteId,
      });

      return {
        operation: input.operation,
        currentStep: "skills",
        nextStep: "rating_prompt",
        message: getStepMessage("skills", input.jobRole),
        data,
        metadata: {
          jobRole: input.jobRole,
          jobRoleId: jobRoleId || null,
        },
      };
    }
    case "tasks": {
      if (!input.jobRole) {
        throw new Error("jobRole is required for task lookup.");
      }

      const data = await fetchTasksByJobRole(input.jobRole, input.subInstituteId);

      return {
        operation: input.operation,
        currentStep: "tasks",
        nextStep: "tasks",
        message: getStepMessage("tasks", input.jobRole),
        data,
      };
    }
    case "report": {
      const report = buildSkillGapReport(input.skills || []);

      return {
        operation: input.operation,
        currentStep: "complete",
        nextStep: "complete",
        message: "Skill gap report generated successfully.",
        report,
        answer: report.answer,
      };
    }
    default: {
      const exhaustiveCheck: never = input.operation;
      throw new Error(`Unsupported skill gap operation: ${exhaustiveCheck}`);
    }
  }
}

export type SkillGapAnalysisResponse =
  | Awaited<ReturnType<typeof runSkillGapAnalysis>>
  | {
      operation: SkillGapOperation;
      currentStep: string;
      nextStep: string;
      message: string;
      data: SkillGapOption[];
    };
