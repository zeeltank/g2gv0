'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { activatable, chapterSourceText, chapterSuggestionText, chooseableLabels, reviewGaps } from '@/lib/question-papers/view';
import { ApiError } from '../_lib/idms-api';
import {
  ACTIVE_STATUSES,
  QuestionPapersApi,
  type ActivationResult,
  type QuestionPaperJob,
  type ReviewItem,
} from '../_lib/question-papers-api';

const STATE_TEXT: Record<ReviewItem['state'], string> = {
  parsed: 'Not saved yet',
  saved: 'Active',
  needs_review: 'Saved inactive',
  unresolved: 'Waiting for standard or subject',
  duplicate: 'Already in the question bank',
  skipped: 'Skipped',
};

const STATE_TONE: Record<ReviewItem['state'], string> = {
  parsed: 'bg-slate-100 text-slate-700',
  saved: 'bg-emerald-50 text-emerald-700',
  needs_review: 'bg-amber-50 text-amber-800',
  unresolved: 'bg-amber-50 text-amber-800',
  duplicate: 'bg-slate-100 text-slate-700',
  skipped: 'bg-red-50 text-red-700',
};

/**
 * Preview of every extracted question, with the gaps the paper left, and activation of the saved-inactive
 * ones. The server re-checks every rule; this only lets the reviewer close the gaps it is allowed to close
 * (choosing the correct option from the extracted options, once the academic context is complete).
 */
export function QuestionPaperReview({
  job, onChanged, chapters, chapterChoices, onChapterChoice, onSaveChapterChoices, saving,
}: {
  job: QuestionPaperJob; onChanged: () => void;
  chapters: Array<{ id: number; name: string }>;
  chapterChoices: Record<number, number>;
  onChapterChoice: (itemId: number, chapterId: number) => void;
  onSaveChapterChoices: () => void;
  saving: boolean;
}) {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ActivationResult[] | null>(null);

  const running = ACTIVE_STATUSES.includes(job.status);
  // Reload when the stored counts change (activation, a retry finishing), not on every poll.
  const signature = `${job.status}:${job.questions_saved}:${job.questions_needing_review}:${job.standard_id}:${job.subject_id}:${job.chapter_id}`;

  const load = useCallback(async () => {
    try {
      setItems(await QuestionPapersApi.items(job.id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? `The questions could not be loaded because ${err.message}.` : 'The questions could not be loaded.');
    }
  }, [job.id]);

  useEffect(() => {
    if (running) return;
    let cancelled = false;
    const fetchItems = async () => {
      try {
        const loaded = await QuestionPapersApi.items(job.id);
        if (cancelled) return;
        setItems(loaded);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? `The questions could not be loaded because ${err.message}.` : 'The questions could not be loaded.');
      }
    };
    void fetchItems();
    return () => {
      cancelled = true;
    };
    // `signature` is the intended re-load trigger (it changes when stored counts or context change).
  }, [running, signature, job.id]);

  if (running) {
    return <p className="text-sm text-slate-500">Questions can be reviewed once processing finishes.</p>;
  }
  if (error) return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>;
  if (!items) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading questions…
      </p>
    );
  }
  if (items.length === 0) return <p className="text-sm text-slate-500">No questions were extracted.</p>;

  const ready = items.filter((item) => activatable(item, chosen[item.id], job, chapterChoices[item.id] || undefined));
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectedReady = ready.filter((item) => selected.has(item.id));

  const activate = async () => {
    setBusy(true);
    setResults(null);
    try {
      const response = await QuestionPapersApi.activate(
        job.id,
        // A chapter picked in the list is the teacher's confirmation for that question; the server checks it belongs to this standard and subject.
        selectedReady.map((item) => ({
          id: item.id,
          ...(chosen[item.id] ? { correct_option: chosen[item.id] } : {}),
          ...(chapterChoices[item.id] ? { chapter_id: chapterChoices[item.id] } : {}),
        })),
      );
      setResults(response.results);
      setSelected(new Set());
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? `Activation failed because ${err.message}.` : 'Activation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-slate-800">Extracted questions ({items.length})</p>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={busy || selectedReady.length === 0}
          onClick={() => void activate()}
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Activate {selectedReady.length > 0 ? `${selectedReady.length} selected` : 'selected'}
        </Button>
      </div>

      {job.can_retry && chapters.length > 0 && (
        <p className="text-xs text-slate-600">
          Each question is matched to a chapter of this standard and subject from its own wording and the chapter curriculum data. A chapter is
          assigned automatically only when the match is strong and clearly ahead of the others; every other question shows its best guess and waits
          for you to confirm or choose a chapter.
        </p>
      )}

      {results && (
        <ul className="space-y-0.5 rounded-lg bg-slate-50 p-2 text-xs" role="status">
          {results.map((r) => (
            <li key={r.id} className={r.ok ? 'text-emerald-700' : 'text-red-700'}>
              {items.find((i) => i.id === r.id)?.item_number ? `Q ${items.find((i) => i.id === r.id)?.item_number}: ` : ''}
              {r.message}
            </li>
          ))}
        </ul>
      )}

      <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {items.map((item) => {
          const gaps = reviewGaps(item, job, chapterChoices[item.id] || undefined);
          const labels = chooseableLabels(item);
          const canPick = activatable(item, chosen[item.id], job, chapterChoices[item.id] || undefined);
          const source = chapterSourceText(item);
          return (
            <li key={item.id} className="space-y-1.5 px-3 py-2 text-sm">
              <div className="flex items-start gap-2">
                {item.state === 'needs_review' ? (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={selected.has(item.id)}
                    disabled={!canPick}
                    onChange={() => toggle(item.id)}
                    aria-label={`Select question ${item.item_number ?? item.ordinal} for activation`}
                  />
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span className="w-16 shrink-0 font-mono text-xs text-slate-500">
                  {item.item_number ? `Q ${item.item_number}` : `#${item.ordinal}`}
                  {item.page ? ` · p${item.page}` : ''}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-slate-900">{item.question_text ?? '(no text)'}</p>
                  {item.options.length > 0 && (
                    <ol className="mt-1 space-y-0.5 text-xs text-slate-700">
                      {item.options.map((o) => (
                        <li key={o.label} className={o.is_correct ? 'font-semibold text-emerald-700' : ''}>
                          {o.label}. {o.text}
                          {o.is_correct ? ' (correct)' : ''}
                        </li>
                      ))}
                    </ol>
                  )}
                  {item.pairs && (
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                      {item.pairs.map((p, i) => (
                        <li key={i}>{p.left} → {p.right}</li>
                      ))}
                    </ul>
                  )}
                  {item.model_answer && <p className="mt-1 text-xs text-slate-600">Answer in paper: {item.model_answer}</p>}
                  {source && (
                    <p className="mt-1 text-xs text-emerald-800">
                      Chapter: {item.chapter_name ?? 'chapter'} (ID {item.chapter_id}), {source}
                      {item.chapter_source === 'auto' && item.chapter_suggestion ? `. ${item.chapter_suggestion.explanation}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_TONE[item.state]}`}>{STATE_TEXT[item.state]}</span>
                  <span className="text-[11px] text-slate-500">{item.format ?? ''}{item.marks ? ` · ${item.marks} marks` : ''}</span>
                </div>
              </div>

              {gaps.length > 0 && (
                <ul className="list-disc pl-12 text-xs text-amber-800">
                  {gaps.map((g) => <li key={g}>{g}</li>)}
                </ul>
              )}
              {job.can_retry && chapters.length > 0 && (item.state === 'needs_review' || item.state === 'unresolved') && (
                <div className="flex flex-wrap items-center gap-2 pl-12 text-xs">
                  {item.chapter_suggestion && item.chapter_source !== 'teacher' && (
                    <span className="text-slate-600">
                      {chapterSuggestionText({
                        chapter_name: item.chapter_suggestion.chapter_name,
                        confidence: item.chapter_suggestion.confidence,
                        level: item.chapter_suggestion.level,
                        assigned: item.chapter_suggestion.assigned,
                      })}
                      . {item.chapter_suggestion.explanation}
                      {!item.chapter_suggestion.assigned && item.chapter_suggestion.alternatives && item.chapter_suggestion.alternatives.length > 1
                        ? ` Also possible: ${item.chapter_suggestion.alternatives.slice(1).map((a) => `${a.name} (ID ${a.id})`).join('; ')}.`
                        : ''}
                    </span>
                  )}
                  <label className="text-slate-600">
                    Chapter for this question
                    <select className="ml-2 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs" value={chapterChoices[item.id] ?? item.chapter_id ?? ''} onChange={(e) => onChapterChoice(item.id, Number(e.target.value) || 0)}>
                      <option value="">Unresolved</option>
                      {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name} (ID {chapter.id})</option>)}
                    </select>
                  </label>
                </div>
              )}
              {item.state !== 'needs_review' && item.reason && <p className="pl-12 text-xs text-slate-500">{item.reason}</p>}

              {item.state === 'needs_review' && labels.length > 0 && (
                <label className="block pl-12 text-xs text-slate-600">
                  Correct option
                  <select
                    className="ml-2 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    value={chosen[item.id] ?? ''}
                    onChange={(e) => setChosen((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  >
                    <option value="">Choose…</option>
                    {labels.map((label) => <option key={label} value={label}>{label}</option>)}
                  </select>
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {job.can_retry && Object.values(chapterChoices).some(Boolean) && (
        <Button size="sm" variant="outline" disabled={saving} onClick={onSaveChapterChoices}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Save chapter choices and retry
        </Button>
      )}
    </div>
  );
}
