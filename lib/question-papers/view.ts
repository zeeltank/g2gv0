/**
 * Pure presentation rules for the Question papers screen and the notification bell.
 * Kept free of React and browser APIs so they can be unit tested. The server stays the authority:
 * nothing here decides whether a question may be activated, it only explains what the server reported.
 */

export interface PaperBreakdown {
  saved_active: number;
  saved_inactive: number;
  unresolved: number;
  duplicate: number;
  skipped: number;
  pending: number;
}

export interface PaperProgressInput {
  status: string;
  total_pages: number | null;
  processed_pages: number;
  questions_extracted: number;
  questions_saved: number;
  progress_percent: number | null;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
}

export interface ReviewItemInput {
  state: string;
  format: string | null;
  needs_answer_key: boolean;
  can_activate: boolean;
  options: Array<{ label: string }>;
  chapter_id?: number | null;
  /** auto = matched at high confidence by the server; teacher = chosen by a person. */
  chapter_source?: 'auto' | 'teacher' | null;
}

export interface ChapterSuggestionInput {
  chapter_name: string;
  /** The measured accuracy of this kind of match, not a made-up probability. */
  confidence: number;
  level?: string;
  assigned?: boolean;
}

/**
 * One line telling the teacher how a chapter was decided: assigned automatically (and how reliable that kind of match has
 * been), or only suggested and waiting for confirmation. Never says "assigned" for a suggestion.
 */
export function chapterSuggestionText(s: ChapterSuggestionInput): string {
  if (s.assigned) return `${s.chapter_name}: assigned automatically (${s.confidence}% of comparable matches were right)`;
  const why = s.level === 'close' ? 'several chapters fit' : s.level === 'weak' ? 'few shared terms' : 'low evidence';
  return `${s.chapter_name}: suggestion only, ${why} (${s.confidence}% of comparable matches were right); confirm it`;
}

/** Where a question's chapter came from, for the badge next to it. */
export function chapterSourceText(item: Pick<ReviewItemInput, 'chapter_id' | 'chapter_source'>): string | null {
  if (item.chapter_id == null) return null;
  return item.chapter_source === 'auto' ? 'matched automatically' : item.chapter_source === 'teacher' ? 'confirmed by a teacher' : 'paper-wide chapter';
}

/** Only same-origin paths: a stored link must never send the person to another site. */
export function safeInternalPath(link: string | null | undefined): string | null {
  if (!link) return null;
  // "/\evil.com" and "//evil.com" both resolve off-site in browsers.
  return link.startsWith('/') && !link.startsWith('//') && !link.startsWith('/\\') ? link : null;
}

/** Which of standard / subject / chapter the system has not resolved. */
export function unresolvedFields(job: Pick<PaperProgressInput, 'standard_id' | 'subject_id' | 'chapter_id'>): string[] {
  const out: string[] = [];
  if (job.standard_id === null) out.push('standard');
  if (job.subject_id === null) out.push('subject');
  if (job.chapter_id === null) out.push('chapter');
  return out;
}

/**
 * Pages read, "N / total" only when the total is known; never a made-up percentage or time estimate.
 */
export function pagesText(job: Pick<PaperProgressInput, 'total_pages' | 'processed_pages'>): string | null {
  if (job.total_pages !== null && job.total_pages > 0) return `${job.processed_pages} / ${job.total_pages} pages`;
  return job.processed_pages > 0 ? `${job.processed_pages} pages` : null;
}

/** The persisted outcome counts that are non-zero, in a fixed, readable order. */
export function breakdownParts(b: PaperBreakdown | null | undefined): string[] {
  if (!b) return [];
  const parts: Array<[number, string]> = [
    [b.saved_active, 'active'],
    [b.saved_inactive, 'saved inactive'],
    [b.unresolved, 'waiting for standard or subject'],
    [b.duplicate, 'duplicates skipped'],
    [b.skipped, 'failed'],
    [b.pending, 'not saved yet'],
  ];
  return parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
}

/** Why a question needs the reviewer, in plain words (empty when nothing is missing). */
export function reviewGaps(
  item: ReviewItemInput,
  job: Pick<PaperProgressInput, 'standard_id' | 'subject_id' | 'chapter_id'>,
  chosenChapter?: number,
): string[] {
  if (item.state !== 'needs_review') return [];
  const gaps: string[] = [];
  // Standard and subject belong to the whole paper; the chapter belongs to each question.
  const missing = unresolvedFields(job).filter((field) => field !== 'chapter');
  if (missing.length > 0) gaps.push(`Choose the ${missing.join(', ')} for this paper`);
  else if (!chosenChapter && item.chapter_id == null && job.chapter_id === null) gaps.push('Confirm the chapter for this question');
  if (item.needs_answer_key) gaps.push('The paper prints no answer key: choose the correct option');
  return gaps;
}

/** The option labels a reviewer may choose from, or none when the question is not objective. */
export function chooseableLabels(item: ReviewItemInput): string[] {
  return item.needs_answer_key ? item.options.map((o) => o.label) : [];
}

/** What the activate button may send: only questions the server said are ready, or ready once an option is chosen. */
export function activatable(
  item: ReviewItemInput,
  chosen: string | undefined,
  job: Pick<PaperProgressInput, 'standard_id' | 'subject_id' | 'chapter_id'>,
  chosenChapter?: number,
): boolean {
  if (item.state !== 'needs_review') return false;
  // Without a standard and subject the server refuses every activation; the chapter may be the question's own.
  if (job.standard_id === null || job.subject_id === null) return false;
  if (!chosenChapter && item.chapter_id == null && job.chapter_id === null) return false;
  // The remaining gap is the answer key: it closes once a label from the extracted options is chosen.
  if (item.needs_answer_key) return !!chosen && chooseableLabels(item).includes(chosen);
  return true;
}

export type WorkerState = 'active' | 'busy' | 'not_detected' | 'inline' | null | undefined;

export interface QueueHintInput {
  status: string;
  queued_seconds?: number | null;
  worker_state?: WorkerState;
}

/** How long a healthy worker may leave a queued paper alone before the screen says something is off. */
export const STALLED_QUEUE_SECONDS = 180;

/**
 * Why a QUEUED paper has not started, in words that say what to do. Only a queued paper gets a hint: a paper that is
 * processing, finished or failed never needs one, and "processing" is never claimed for a paper no worker has claimed.
 *
 * `worker_state` is the server's reading of the worker's heartbeat; null/undefined means it cannot tell, and then
 * nothing false is said, only the time-based hint applies.
 */
export function queueHint(job: QueueHintInput): string | null {
  if (job.status !== 'queued') return null;

  if (job.worker_state === 'inline') {
    return 'The server runs queued jobs inline (queue driver "sync"), so question papers cannot be processed in the background. Ask your administrator to set a real queue and start the question paper worker.';
  }
  if (job.worker_state === 'not_detected') {
    return 'The question paper worker is not running, so nothing has started this paper. In development, run .\\dev-question-papers.ps1 in the backend folder; in production, ask your administrator to start the question paper worker service. Processing starts by itself as soon as the worker is running.';
  }
  if ((job.queued_seconds ?? 0) >= STALLED_QUEUE_SECONDS) {
    return job.worker_state === 'busy' || job.worker_state === 'active'
      ? 'The worker is running but has not reached this paper yet. It is waiting behind other work and will start by itself.'
      : 'This paper has been waiting for several minutes. If it does not start soon, check that the question paper worker is running.';
  }
  return null;
}
