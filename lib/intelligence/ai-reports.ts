'use client';

/**
 * Client for a saved AI Stack report — `/api/ai/reports/{id}`. The G2G equivalent of the
 * report functions LMS_K12's `/ai-reports/[id]` page uses (read, save, refresh figures).
 */

import { aiRequest } from './client';

export interface AiReportFigures {
  /** The module whose data source produced the rows. */
  module: string;
  /** The data source that was actually run, e.g. `capability.jobroles`. */
  source: string;
  /** When the rows were last read. */
  generated_at: string;
}

export interface AiReport {
  id: number;
  title: string;
  created_on: string | null;
  /** The document. Rendered inside a sandboxed frame, never injected into the app DOM. */
  html: string;
  figures: AiReportFigures | null;
}

export function getAiReport(id: number): Promise<{ report: AiReport }> {
  return aiRequest(`/reports/${id}`);
}

export function saveAiReport(id: number, input: { title: string; html: string }): Promise<{ report: AiReport }> {
  return aiRequest(`/reports/${id}`, 'PUT', input);
}

export function regenerateAiReport(id: number): Promise<{ html: string; row_count: number; module: string }> {
  return aiRequest(`/reports/${id}/regenerate`, 'POST');
}
