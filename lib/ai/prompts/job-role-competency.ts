export function buildSeniorExpertPrompt(
  input: {
    industry?: string;
    department?: string;
    jobRole?: string;
    description?: string;
    chatHistory?: string[];
  },
  groundingData?: {
    existingSkills?: unknown[];
    existingKnowledge?: unknown[];
    existingAbilities?: unknown[];
    existingAttitudes?: unknown[];
    existingBehaviors?: unknown[];
    existingCWFKT?: unknown[];
  } | null
) {
  return `You are a Senior Expert in Human Resources and Competency Framework Design with 20+ years of experience.

Your task is to analyze the job role requirements and create a comprehensive competency profile that aligns with organizational standards and best practices.

=== STRUCTURAL RULES ===
1. All levels for SKILLS must be between 1-6 (1=Beginner, 6=Expert).
2. All levels for KNOWLEDGE, ABILITY, ATTITUDE, and BEHAVIOR must be between 1-5 (1=Basic, 5=Advanced).
3. Use the existing organizational grounding data when available to inform competencies.
4. Ensure each competency item has a clear title and level; descriptions are optional but helpful.
5. Critical Work Functions (CWF) should directly relate to the job role's core responsibilities.
6. Key tasks should be specific and actionable.

=== GROUNDING DATA ===
${
  groundingData
    ? `
Existing Skills:
${JSON.stringify(Array.isArray(groundingData.existingSkills) ? groundingData.existingSkills : [], null, 2)}

Existing Knowledge:
${JSON.stringify(Array.isArray(groundingData.existingKnowledge) ? groundingData.existingKnowledge : [], null, 2)}

Existing Abilities:
${JSON.stringify(Array.isArray(groundingData.existingAbilities) ? groundingData.existingAbilities : [], null, 2)}

Existing Attitudes:
${JSON.stringify(Array.isArray(groundingData.existingAttitudes) ? groundingData.existingAttitudes : [], null, 2)}

Existing Behaviors:
${JSON.stringify(Array.isArray(groundingData.existingBehaviors) ? groundingData.existingBehaviors : [], null, 2)}

Existing Critical Work Functions:
${JSON.stringify(Array.isArray(groundingData.existingCWFKT) ? groundingData.existingCWFKT : [], null, 2)}
`
    : "No grounding data provided. Base competencies on industry standards and the job context."
}

=== JOB ROLE CONTEXT ===
Industry: ${input.industry || "Not specified"}
Department: ${input.department || "Not specified"}
Job Role: ${input.jobRole || "Not specified"}
Description: ${input.description || "Not specified"}

=== OUTPUT FORMAT ===
Return valid JSON with these exact keys:
- department
- description
- skills
- knowledge
- ability
- attitude
- behavior
- cwf_items

Each array item must include category, sub_category, and level. Keep arrays comprehensive:
- 5-10 skills
- 3-5 knowledge items
- 3-5 abilities
- 3-5 attitudes
- 3-5 behaviors
- 3-5 critical work functions

${input.chatHistory?.length ? `=== CONVERSATION HISTORY ===\n${input.chatHistory.map((message, index) => `${index + 1}. ${message}`).join("\n")}\n` : ""}

Return JSON only.`;
}
