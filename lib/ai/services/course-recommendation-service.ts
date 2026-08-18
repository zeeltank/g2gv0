import { fetchCourseRecommendationData } from "./hp-api.ts";

export interface CourseRecommendationInput {
  userId: string | number;
  subInstituteId: string | number;
}

export async function recommendCourses(input: CourseRecommendationInput) {
  const result = await fetchCourseRecommendationData(
    input.userId,
    input.subInstituteId
  );

  if (!result.success || result.data.length === 0) {
    return [];
  }

  const enrollmentCounts = result.data.reduce<Record<string, number>>((counts, item) => {
    const courseId = String(item.course_id);
    counts[courseId] = (counts[courseId] || 0) + 1;
    return counts;
  }, {});

  const uniqueCourses = new Map<
    string,
    {
      courseName: string;
      courseId: string | number;
      courseDescription: string;
      courseLink: string;
      reasonForRecommendation: string;
      peerEnrollmentCount: number;
      similarUsers: string;
    }
  >();

  for (const item of result.data) {
    const courseId = String(item.course_id);

    if (uniqueCourses.has(courseId)) {
      continue;
    }

    const similarUsers = String(item.similar_users_name || item.similar_users || "")
      .replace(/\|\|/g, ", ")
      .trim();

    uniqueCourses.set(courseId, {
      courseName: item.display_name || item.name || "Unknown Course",
      courseId: item.course_id,
      courseDescription: "",
      courseLink: "",
      reasonForRecommendation: `Users with similar roles enrolled in this course: ${similarUsers || "Not specified"}. Created by: ${item.created_user_name || "N/A"}.`,
      peerEnrollmentCount: enrollmentCounts[courseId] || 1,
      similarUsers,
    });
  }

  return [...uniqueCourses.values()].sort(
    (left, right) => right.peerEnrollmentCount - left.peerEnrollmentCount
  );
}
