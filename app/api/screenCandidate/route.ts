/**
 * API Route: /api/screenCandidate
 * Screens candidate resumes against JD competencies and predicts fit
 * Input: { resume: string, jdData: object }
 * Output: { competency_match, cultural_fit, predicted_success, summary, skill_gaps }
 */

import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// Model ids are overridable per environment so a retired or renamed model does not need a
// code change. The defaults are what this route has always sent; 'gemini-3.6-flash' is the
// id the AI Model Setup catalogue (ai_models) lists for Gemini.
const DEEPSEEK_MODEL = process.env.SCREENING_DEEPSEEK_MODEL || 'deepseek-chat';
const OPENROUTER_MODEL = process.env.SCREENING_OPENROUTER_MODEL || 'deepseek/deepseek-chat';
const GEMINI_MODEL = process.env.SCREENING_GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

interface ProviderErrorBody {
  error?: { message?: string };
  message?: string;
}

async function requestScreening(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    let message = `Provider returned HTTP ${response.status}`;
    try {
      const body = await response.json() as ProviderErrorBody;
      message = body.error?.message || body.message || message;
    } catch {
      // Preserve the HTTP status when the provider does not return JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

async function requestGeminiScreening(apiKey: string, prompt: string) {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 700,
        temperature: 0.4,
      },
    }),
  });

  const body = await response.json() as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!response.ok) {
    throw new Error(body.error?.message || `Gemini API returned HTTP ${response.status}`);
  }

  return {
    choices: [{
      message: {
        content: body.candidates?.[0]?.content?.parts?.[0]?.text || '{}',
      },
    }],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { resume, jdData } = await req.json();

    if (!resume || !jdData) {
      return NextResponse.json({ error: 'Missing resume or JD data' }, { status: 400 });
    }

    const deepSeekApiKey = process.env.SCREENING_DEEPSEEK_API_KEY;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!deepSeekApiKey && !openRouterApiKey && !geminiApiKey) {
      return NextResponse.json(
        { error: 'Candidate screening is not configured' },
        { status: 503 }
      );
    }

    const screeningPrompt = `You are an expert recruiter. Analyze this candidate's resume against the job requirements.

Job Requirements:
- Core Skills: ${jdData.core_skills?.join(', ') || 'Not specified'}
- Behavioral Traits: ${jdData.behavioral_traits?.join(', ') || 'Not specified'}
- Required Competency Levels: ${JSON.stringify(jdData.competency_level || {})}

Candidate Resume:
${resume}

Provide analysis in valid JSON format:
{
  "competency_match": <number 0-100>,
  "cultural_fit": "Low" | "Medium" | "High",
  "predicted_success": "Unlikely" | "Possible" | "Likely" | "Highly Likely",
  "summary": "<150 word summary of candidate fit>",
  "skill_gaps": ["skill1", "skill2"],
  "strengths": ["strength1", "strength2"],
  "recommendation": "Schedule Interview" | "Request Additional Info" | "Reject"
}`;

    let providerData;
    if (deepSeekApiKey) {
      try {
        providerData = await requestScreening(
          DEEPSEEK_ENDPOINT,
          deepSeekApiKey,
          DEEPSEEK_MODEL,
          screeningPrompt
        );
      } catch (deepSeekError) {
        if (!openRouterApiKey) throw deepSeekError;
        console.warn(
          'Direct DeepSeek screening failed; retrying through OpenRouter:',
          deepSeekError instanceof Error ? deepSeekError.message : 'Unknown provider error'
        );
      }
    }

    if (!providerData && openRouterApiKey) {
      try {
        providerData = await requestScreening(
          OPENROUTER_ENDPOINT,
          openRouterApiKey,
          OPENROUTER_MODEL,
          screeningPrompt
        );
      } catch (openRouterError) {
        if (!geminiApiKey) throw openRouterError;
        console.warn(
          'OpenRouter screening failed; retrying through Gemini:',
          openRouterError instanceof Error ? openRouterError.message : 'Unknown provider error'
        );
      }
    }

    if (!providerData && geminiApiKey) {
      providerData = await requestGeminiScreening(geminiApiKey, screeningPrompt);
    }

    if (!providerData) throw new Error('No screening provider is available');
    const content = providerData.choices?.[0]?.message?.content || '{}';

    // An unreadable provider answer is an error, not a result. It used to be replaced by a
    // canned "0% / Low / Unlikely" analysis that the caller then stored as a genuine
    // low-fit screening, indistinguishable from a real one.
    let analysis: any;
    try {
      analysis = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      try {
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        analysis = null;
      }
    }

    if (!analysis || typeof analysis !== 'object' || typeof analysis.competency_match !== 'number') {
      console.error('Candidate screening: provider returned an unreadable result');
      return NextResponse.json(
        {
          error: 'The screening provider returned a result that could not be read. No screening was recorded.',
          code: 'SCREENING_UNPARSEABLE',
        },
        { status: 502 }
      );
    }

    const skillMatchDetails = jdData.core_skills?.map((skill: string) => {
      const skillLower = skill.toLowerCase();
      const resumeLower = resume.toLowerCase();
      const isPresent = resumeLower.includes(skillLower);
      const requiredLevel = jdData.competency_level?.[skill] || 'Intermediate';

      return {
        skill,
        present: isPresent,
        required_level: requiredLevel,
        gap: !isPresent
      };
    }) || [];

    return NextResponse.json({
      success: true,
      competency_match: analysis.competency_match || 0,
      cultural_fit: analysis.cultural_fit || 'Medium',
      predicted_success: analysis.predicted_success || 'Possible',
      summary: analysis.summary || 'Analysis complete',
      skill_gaps: analysis.skill_gaps || [],
      strengths: analysis.strengths || [],
      recommendation: analysis.recommendation || 'Request Additional Info',
      skill_match_details: skillMatchDetails,
      total_skills_required: jdData.core_skills?.length || 0,
      skills_matched: skillMatchDetails.filter((s: any) => s.present).length
    });

  } catch (error) {
    console.error('Candidate screening error:', error);
    return NextResponse.json(
      { error: 'Failed to screen candidate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
