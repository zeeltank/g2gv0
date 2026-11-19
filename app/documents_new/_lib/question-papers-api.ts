'use client';

import { resolveApiBaseUrl } from '@/lib/api-config';
import { readLaravelSession } from '@/lib/laravel-session';
import type { PaperBreakdown } from '@/lib/question-papers/view';
import { ApiError } from './idms-api';

function buildSessionContext() {
  const session = readLaravelSession();
  return {
    baseUrl: resolveApiBaseUrl().replace(/\/api\/?$/, ''),
    token: session?.token ?? '',
    subInstituteId: session?.sub_institute_id != null ? String(session.sub_institute_id) : '',
    userId: session?.user_id != null ? String(session.user_id) : '',
  };
}

export type DocumentKind = 'question_paper' | 'curriculum' | 'general' | 'textbook';

export type QuestionPaperStatus =
  | 'queued'
  | 'processing'
  | 'retrying'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed';

export type QuestionPaperStage =
  | 'validating'
  | 'extracting_text'
  | 'parsing_questions'
  | 'resolving_metadata'
  | 'saving'
  | 'finalizing';

export interface QuestionPaperJob {
  id: string;
  document_id: number;
  document_title: string | null;
  file_name: string | null;
  status: QuestionPaperStatus;
  stage: QuestionPaperStage | null;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
  academic_year: string | null;
  metadata_notes: string[];
  total_pages: number | null;
  processed_pages: number;
  total_chunks: number | null;
  parsed_chunks: number;
  questions_extracted: number;
  questions_saved: number;
  questions_needing_review: number;
  questions_skipped: number;
  questions_duplicates?: number | null;
  questions_failed?: number | null;
  used_ocr: boolean;
  /** Real progress or null when it cannot be known; never an estimate. */
  progress_percent: number | null;
  attempts: number;
  /** Seconds a queued job has gone unpicked (server clock); null when it is not queued. */
  queued_seconds?: number | null;
  /** Queued jobs only: the server's reading of the question-papers worker heartbeat; null when it cannot tell. */
  worker_state?: 'active' | 'busy' | 'not_detected' | 'inline' | null;
  last_error: string | null;
  can_retry: boolean;
  created_at: string;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  /** Per-state counts of the stored questions; null when the endpoint did not load them. */
  breakdown?: PaperBreakdown | null;
  /** Detail only: what the system resolved (by name) and what it could not choose between. */
  academic?: {
    standard: { id: number; name: string } | null;
    subject: { id: number; name: string } | null;
    chapter: { id: number; name: string } | null;
    candidates: { standard?: Candidate[]; subject?: Candidate[]; chapter?: Candidate[] };
    heading: { standard?: string | null; subject?: string | null; chapter?: string | null; academic_year?: string | null };
    /** What the questions suggest where the heading settled nothing. Suggestions only: never assigned. */
    suggestions?: { subject?: { id: number; name: string | null; share: number; reason: string } };
  };
  attention_items?: Array<{
    item_number: string | null;
    page: number | null;
    state: 'skipped' | 'duplicate' | 'needs_review' | 'unresolved';
    reason: string | null;
    question_id: number | null;
  }>;
}

export interface Candidate {
  id: number;
  name: string;
  /** Subjects only: the school maps this subject to the paper's standard. */
  mapped?: boolean;
}

export interface ReviewItem {
  id: number;
  ordinal: number;
  item_number: string | null;
  page: number | null;
  format: string | null;
  state: 'parsed' | 'saved' | 'needs_review' | 'unresolved' | 'duplicate' | 'skipped';
  reason: string | null;
  question_id: number | null;
  question_text: string | null;
  options: Array<{ label: string; text: string; is_correct?: boolean }>;
  correct_option: string | null;
  model_answer: string | null;
  pairs: Array<{ left: string; right: string }> | null;
  marks: number | null;
  needs_answer_key: boolean;
  can_activate: boolean;
  blockers: string[];
  chapter_id: number | null;
  chapter_name?: string | null;
  /** auto = matched at high confidence by the server; teacher = chosen by a person; null = paper-wide or none. */
  chapter_source?: 'auto' | 'teacher' | null;
  needs_chapter?: boolean;
  chapter_suggestion: {
    chapter_id: number;
    chapter_name: string;
    /** Measured accuracy of this kind of match (not a made-up probability). */
    confidence: number;
    explanation: string;
    level?: 'high' | 'close' | 'weak' | 'none';
    assigned?: boolean;
    score?: number;
    margin?: number;
    alternatives?: Array<{ id: number; name: string; score: number }>;
  } | null;
}

export interface ActivationResult {
  id: number;
  ok: boolean;
  message: string;
}

export interface AcademicOptions {
  standards: Array<{ id: number; name: string }>;
  subjects: Array<{ id: number; name: string; mapped?: boolean }>;
  chapters: Array<{ id: number; name: string }>;
}

export interface AcademicChoice {
  standard_id?: number;
  subject_id?: number;
  chapter_id?: number;
}

export interface QuestionPaperUploadChoice extends AcademicChoice {
  scheduled_at?: string;
}

export const ACTIVE_STATUSES: QuestionPaperStatus[] = ['queued', 'processing', 'retrying'];

async function request<T>(path: string, init: { method?: string; body?: BodyInit; json?: unknown } = {}): Promise<T> {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new ApiError('the ERP host is not configured for this session. Sign in again', 0);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (session.token) headers['Authorization'] = `Bearer ${session.token}`;
  if (init.json !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${session.baseUrl}/api/platform${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('the server could not be reached. Check your connection and try again', 0);
  }

  const payload = (await res.json().catch(() => null)) as { status_code?: number; message?: string; data?: T } | null;
  if (!res.ok || payload?.status_code === 0) {
    throw new ApiError(
      payload?.message?.trim() || `the request failed (${res.status})`,
      res.status,
      Number(res.headers.get('Retry-After')) || undefined,
    );
  }
  return payload?.data as T;
}

export const QuestionPapersApi = {
  /** Returns as soon as the file is stored and queued; extraction continues on the server. */
  upload(file: File, choice: QuestionPaperUploadChoice = {}): Promise<QuestionPaperJob> {
    const form = new FormData();
    form.append('file', file);
    for (const [key, value] of Object.entries(choice)) {
      if (value) form.append(key, String(value));
    }
    // No Content-Type: the browser adds the multipart boundary.
    return request<QuestionPaperJob>('/question-papers', { method: 'POST', body: form });
  },

  async list(): Promise<{ total: number; jobs: QuestionPaperJob[] }> {
    return request('/question-papers');
  },

  get(id: string): Promise<QuestionPaperJob> {
    return request(`/question-papers/${encodeURIComponent(id)}`);
  },

  retry(id: string, choice: AcademicChoice & { item_chapters?: Record<number, number> } = {}): Promise<QuestionPaperJob> {
    return request(`/question-papers/${encodeURIComponent(id)}/retry`, { method: 'POST', json: choice });
  },

  delete(id: string): Promise<{ job: string; items_deleted: number; document_trashed: boolean }> {
    return request(`/question-papers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async items(id: string): Promise<ReviewItem[]> {
    return (await request<{ items: ReviewItem[] }>(`/question-papers/${encodeURIComponent(id)}/items`)).items;
  },

  /** The server enforces every rule again; `correct_option` is only the reviewer's pick from the extracted options. */
  activate(id: string, items: Array<{ id: number; correct_option?: string; chapter_id?: number }>): Promise<{ results: ActivationResult[]; job: QuestionPaperJob }> {
    return request(`/question-papers/${encodeURIComponent(id)}/activate`, { method: 'POST', json: { items } });
  },

  options(standardId?: number, subjectId?: number): Promise<AcademicOptions> {
    const params = new URLSearchParams();
    if (standardId) params.set('standard_id', String(standardId));
    if (subjectId) params.set('subject_id', String(subjectId));
    const qs = params.toString();
    return request(`/question-papers/options${qs ? `?${qs}` : ''}`);
  },
};

export const STATUS_TEXT: Record<QuestionPaperStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  retrying: 'Retrying after a temporary problem',
  completed: 'Completed',
  completed_with_warnings: 'Completed with warnings',
  failed: 'Failed',
};

export const STAGE_TEXT: Record<QuestionPaperStage, string> = {
  validating: 'Checking the file',
  extracting_text: 'Reading text from the PDF',
  parsing_questions: 'Extracting questions',
  resolving_metadata: 'Finding standard, subject and chapter',
  saving: 'Saving to the question bank',
  finalizing: 'Finishing up',
};
