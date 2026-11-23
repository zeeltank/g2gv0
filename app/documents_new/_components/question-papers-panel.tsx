'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { breakdownParts, pagesText, queueHint, unresolvedFields } from '@/lib/question-papers/view';
import { ApiError } from '../_lib/idms-api';
import { QuestionPaperReview } from './question-paper-review';
import {
  ACTIVE_STATUSES,
  QuestionPapersApi,
  STAGE_TEXT,
  STATUS_TEXT,
  type AcademicOptions,
  type QuestionPaperJob,
} from '../_lib/question-papers-api';

// Slow enough to be cheap, fast enough to feel live; polling stops entirely when nothing is running.
const POLL_MS = 5000;

function formatWhen(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isScheduled(job: QuestionPaperJob): job is QuestionPaperJob & { scheduled_at: string } {
  return job.status === 'queued' && job.scheduled_at !== null && new Date(job.scheduled_at).getTime() > Date.now();
}

function badgeClass(status: QuestionPaperJob['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700';
    case 'completed_with_warnings':
      return 'bg-amber-50 text-amber-800';
    case 'failed':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-indigo-50 text-indigo-700';
  }
}

function jobStatusText(job: QuestionPaperJob): string {
  if (isScheduled(job)) return 'Scheduled';
  return job.status === 'queued' && job.stage === 'saving' ? 'Waiting to resume saving' : STATUS_TEXT[job.status];
}

function Counts({ job }: { job: QuestionPaperJob }) {
  return (
    <span className="text-xs text-slate-600">
      {[pagesText(job), `${job.questions_extracted} extracted`, ...(breakdownParts(job.breakdown).length > 0 ? breakdownParts(job.breakdown) : [`${job.questions_saved} saved`])]
        .filter(Boolean)
        .join(' · ')}
    </span>
  );
}

function ProgressBar({ job }: { job: QuestionPaperJob }) {
  // Only real progress is drawn. Without a known percent the stage text and counts carry the status.
  if (job.progress_percent === null || !ACTIVE_STATUSES.includes(job.status)) return null;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={job.progress_percent}
      aria-label="Extraction progress"
      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
    >
      <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${job.progress_percent}%` }} />
    </div>
  );
}

export function QuestionPapersPanel({ focusJobId }: { focusJobId?: string | null }) {
  const [jobs, setJobs] = useState<QuestionPaperJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(focusJobId ?? null);
  const [detail, setDetail] = useState<QuestionPaperJob | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const loadList = useCallback(async () => {
    try {
      const result = await QuestionPapersApi.list();
      setJobs(result.jobs);
      setError(null);
      return result.jobs;
    } catch (err) {
      setError(err instanceof ApiError ? `Question papers could not be loaded because ${err.message}.` : 'Question papers could not be loaded.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      setDetail(await QuestionPapersApi.get(id));
      setDetailError(null);
    } catch (err) {
      setDetail(null);
      setDetailError(err instanceof ApiError ? `This job could not be loaded because ${err.message}.` : 'This job could not be loaded.');
    }
  }, []);

  // Poll running jobs while visible; scheduled jobs are revisited when their due time arrives.
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const list = await loadList();
      if (selectedId) await loadDetail(selectedId);
      if (cancelled) return;
      const activeJobs = (list ?? jobs).filter((job) => ACTIVE_STATUSES.includes(job.status));
      if (activeJobs.length > 0 && !document.hidden) {
        const running = activeJobs.some((job) => !isScheduled(job));
        const nextScheduledAt = Math.min(
          ...activeJobs.filter(isScheduled).map((job) => new Date(job.scheduled_at).getTime()),
        );
        const delay = running || !Number.isFinite(nextScheduledAt)
          ? POLL_MS
          : Math.min(2_147_000_000, Math.max(1000, nextScheduledAt - Date.now() + 1000));
        timer.current = window.setTimeout(tick, delay);
      }
    };

    const onVisible = () => {
      if (!document.hidden) {
        if (timer.current) window.clearTimeout(timer.current);
        void tick();
      }
    };

    void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // jobs is read only as a fallback when a refresh fails; re-running on every poll result would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loadList, loadDetail]);

  const select = (id: string) => {
    setDetail(null);
    setSelectedId(id);
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading question papers…
      </p>
    );
  }

  return (
    <section className="space-y-4" aria-label="Question paper processing">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

      {jobs.length === 0 && !error ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No question papers yet. Upload a PDF and choose Question paper as its type.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => select(job.id)}
                aria-current={selectedId === job.id}
                className={`w-full px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${
                  selectedId === job.id ? 'bg-indigo-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{job.file_name ?? job.document_title ?? 'Question paper'}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(job.status)}`}>{jobStatusText(job)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="text-xs text-slate-500">{formatWhen(job.created_at)}</span>
                  {job.scheduled_at && <span className="text-xs text-slate-700">Scheduled for {formatWhen(job.scheduled_at)}</span>}
                  {ACTIVE_STATUSES.includes(job.status) && job.stage && !isScheduled(job) && <span className="text-xs text-slate-700">{STAGE_TEXT[job.stage]}</span>}
                  <Counts job={job} />
                </div>
                <ProgressBar job={job} />
                {job.status === 'failed' && job.last_error && <p className="mt-1 text-xs text-red-700">{job.last_error}</p>}
                {queueHint(job) && <p className="mt-1 text-xs text-amber-800">{queueHint(job)}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedId && detailError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{detailError}</p>}
      {selectedId && detail && (
        <JobDetail
          job={detail}
          onChanged={() => { void loadList(); void loadDetail(detail.id); }}
          onDeleted={(id) => {
            setSelectedId(null);
            setDetail(null);
            setJobs((prev) => prev.filter((j) => j.id !== id));
            void loadList();
          }}
        />
      )}
    </section>
  );
}

function JobDetail({ job, onChanged, onDeleted }: { job: QuestionPaperJob; onChanged: () => void; onDeleted: (id: string) => void }) {
  const [options, setOptions] = useState<AcademicOptions | null>(null);
  const [standardId, setStandardId] = useState<number | undefined>(job.standard_id ?? undefined);
  const [subjectId, setSubjectId] = useState<number | undefined>(job.subject_id ?? undefined);
  const [chapterId, setChapterId] = useState<number | undefined>(job.chapter_id ?? undefined);
  const [itemChapters, setItemChapters] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const needsContext = job.can_retry && (job.standard_id === null || job.subject_id === null || job.chapter_id === null || job.questions_needing_review > 0);

  useEffect(() => {
    if (!needsContext) return;
    let cancelled = false;
    QuestionPapersApi.options(standardId, subjectId)
      .then((result) => !cancelled && setOptions(result))
      .catch(() => !cancelled && setMessage('The standards and subjects could not be loaded.'));
    return () => {
      cancelled = true;
    };
  }, [needsContext, standardId, subjectId]);

  const retry = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await QuestionPapersApi.retry(job.id, { standard_id: standardId, subject_id: subjectId, chapter_id: chapterId, item_chapters: itemChapters });
      onChanged();
    } catch (err) {
      setMessage(err instanceof ApiError ? `Retry failed because ${err.message}.` : 'Retry failed.');
    } finally {
      setBusy(false);
    }
  };

  const deletePaper = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await QuestionPapersApi.delete(job.id);
      onDeleted(job.id);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? `Delete failed because ${err.message}.` : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const select = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40';

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4" aria-live="polite">
      <div className="flex items-center gap-2">
        {ACTIVE_STATUSES.includes(job.status) && !isScheduled(job) && <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />}
        {job.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        {(job.status === 'failed' || job.status === 'completed_with_warnings') && <AlertTriangle className={`h-5 w-5 ${job.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`} />}
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">{job.file_name ?? 'Question paper'}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(job.status)}`}>{jobStatusText(job)}</span>
        {!confirmDelete && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete question paper"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>

      {confirmDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
          <p className="font-semibold">Delete this question paper?</p>
          <p className="mt-0.5">The uploaded document will be moved to the Trash and this processing record will be removed.</p>
          {deleteError && <p className="mt-1 font-medium text-red-700">{deleteError}</p>}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              disabled={deleting}
              onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
            >
              Keep paper
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-red-600 text-xs text-white hover:bg-red-700"
              disabled={deleting}
              onClick={() => void deletePaper()}
            >
              {deleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div><dt className="inline text-slate-500">Uploaded: </dt><dd className="inline text-slate-800">{formatWhen(job.created_at)}</dd></div>
        {job.scheduled_at && <div><dt className="inline text-slate-500">Scheduled for: </dt><dd className="inline text-slate-800">{formatWhen(job.scheduled_at)}</dd></div>}
        {job.finished_at && <div><dt className="inline text-slate-500">Finished: </dt><dd className="inline text-slate-800">{formatWhen(job.finished_at)}</dd></div>}
        {job.stage && ACTIVE_STATUSES.includes(job.status) && !isScheduled(job) && <div><dt className="inline text-slate-500">Stage: </dt><dd className="inline text-slate-800">{STAGE_TEXT[job.stage]}</dd></div>}
        {job.total_pages !== null && <div><dt className="inline text-slate-500">Pages read: </dt><dd className="inline tabular-nums text-slate-800">{job.processed_pages} / {job.total_pages}</dd></div>}
        <div><dt className="inline text-slate-500">Questions extracted: </dt><dd className="inline tabular-nums text-slate-800">{job.questions_extracted}</dd></div>
        <div><dt className="inline text-slate-500">Questions saved: </dt><dd className="inline tabular-nums text-slate-800">{job.questions_saved}</dd></div>
        {job.questions_needing_review > 0 && <div><dt className="inline text-slate-500">Need review: </dt><dd className="inline tabular-nums text-slate-800">{job.questions_needing_review}</dd></div>}
        <div><dt className="inline text-slate-500">Duplicates skipped: </dt><dd className="inline tabular-nums text-slate-800">{job.questions_duplicates ?? job.breakdown?.duplicate ?? 0}</dd></div>
        <div><dt className="inline text-slate-500">Failed questions: </dt><dd className="inline tabular-nums text-slate-800">{job.questions_failed ?? job.breakdown?.skipped ?? 0}</dd></div>
        {job.used_ocr && <div className="text-slate-600">Scanned pages were read with OCR.</div>}
        {job.attempts > 1 && <div><dt className="inline text-slate-500">Attempts: </dt><dd className="inline tabular-nums text-slate-800">{job.attempts}</dd></div>}
      </dl>
      <ProgressBar job={job} />

      {job.last_error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{job.last_error}</p>}
      {queueHint(job) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">{queueHint(job)}</p>}

      {job.academic && (
        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          <p className="font-medium text-slate-800">Academic context</p>
          <dl className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-3">
            {(['standard', 'subject', 'chapter'] as const).map((field) => (
              <div key={field}>
                <dt className="inline capitalize text-slate-500">{field}: </dt>
                <dd className={`inline ${job.academic?.[field] || field === 'chapter' ? 'text-slate-900' : 'text-amber-800'}`}>
                  {job.academic?.[field]
                    ? `${job.academic[field]!.name} (ID ${job.academic[field]!.id})`
                    : field === 'chapter'
                      ? 'Matched per question (see each question below)'
                      : 'Not resolved'}
                </dd>
              </div>
            ))}
          </dl>
          {(job.academic.heading.standard || job.academic.heading.subject || job.academic.heading.chapter) && (
            <p className="mt-1 text-xs text-slate-500">
              Heading read from the paper: {[job.academic.heading.standard, job.academic.heading.subject, job.academic.heading.chapter].filter(Boolean).join(' · ')}
            </p>
          )}
          {unresolvedFields(job).filter((field) => field !== 'chapter').length > 0 && (
            <p className="mt-1 text-xs text-amber-800">
              Nothing is guessed. Choose the {unresolvedFields(job).filter((field) => field !== 'chapter').join(', ')} below
              {job.can_retry ? ' and retry' : ''}; questions without a standard and subject are not saved. The questions you already have are kept and are not extracted again.
            </p>
          )}
          {job.academic.suggestions?.subject && !job.academic.subject && (
            <p className="mt-1 text-xs text-indigo-800">
              Suggested subject: {job.academic.suggestions.subject.name} (ID {job.academic.suggestions.subject.id}). {job.academic.suggestions.subject.reason}
            </p>
          )}
          {job.academic.candidates.subject && job.academic.candidates.subject.length > 1 && (
            <p className="mt-1 text-xs text-slate-600">
              Matching subjects:{' '}
              {job.academic.candidates.subject.map((c) => `${c.name} (#${c.id}${c.mapped ? ', used by this standard' : ''})`).join('; ')}
            </p>
          )}
        </div>
      )}

      {job.metadata_notes.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-lg bg-amber-50 p-3 pl-7 text-sm text-amber-900">
          {job.metadata_notes.map((note, i) => <li key={i}>{note}</li>)}
        </ul>
      )}

      {job.attention_items && job.attention_items.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-800">Questions that need attention</p>
          <ul className="mt-1 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
            {job.attention_items.map((item, i) => (
              <li key={i} className="flex gap-3 px-3 py-1.5">
                <span className="w-20 shrink-0 font-mono text-xs text-slate-500">{item.item_number ? `Q ${item.item_number}` : '—'}{item.page ? ` · p${item.page}` : ''}</span>
                <span className="min-w-0 flex-1 text-slate-700">{item.reason ?? item.state}</span>
                {item.question_id && <span className="shrink-0 font-mono text-xs text-slate-400">#{item.question_id}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {job.can_retry && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          {needsContext && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-600">
                Standard
                <select className={`${select} mt-0.5 block`} value={standardId ?? ''} onChange={(e) => { setStandardId(Number(e.target.value) || undefined); setChapterId(undefined); }}>
                  <option value="">Not chosen</option>
                  {options?.standards.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Subject
                <select className={`${select} mt-0.5 block`} value={subjectId ?? ''} onChange={(e) => { setSubjectId(Number(e.target.value) || undefined); setChapterId(undefined); }}>
                  <option value="">Not chosen</option>
                  {options?.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.mapped ? ' (used by this standard)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Chapter
                <select className={`${select} mt-0.5 block`} value={chapterId ?? ''} onChange={(e) => setChapterId(Number(e.target.value) || undefined)} disabled={!standardId || !subjectId}>
                  <option value="">Not chosen</option>
                  {options?.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void retry()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
            {needsContext ? 'Retry with these choices' : 'Retry'}
          </Button>
        </div>
      )}
      {message && <p className="text-sm text-red-700" role="alert">{message}</p>}

      <div className="border-t border-slate-100 pt-3">
        <QuestionPaperReview
          job={job}
          onChanged={onChanged}
          chapters={options?.chapters ?? []}
          chapterChoices={itemChapters}
          onChapterChoice={(itemId, value) => setItemChapters((current) => {
            const next = { ...current };
            if (value > 0) next[itemId] = value;
            else delete next[itemId];
            return next;
          })}
          onSaveChapterChoices={() => void retry()}
          saving={busy}
        />
      </div>
    </div>
  );
}
