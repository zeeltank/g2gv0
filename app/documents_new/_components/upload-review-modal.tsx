'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud, AlertTriangle, Loader2, Sparkles, X, CheckCircle2, Circle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdmsApi, type DocumentItem, type DocumentWarning } from '../_lib/idms-api';
import {
  collectFromDrop,
  collectFromInput,
  expandForUpload,
  type ExpandedFile,
} from '@/app/documents/_lib/expand-upload';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called once per published document. `total` is how many files were in the batch. */
  onDocumentConfirmed: (doc: DocumentItem, meta: { total: number }) => void;
}

type ItemStatus = 'queued' | 'uploading' | 'processing' | 'review' | 'confirmed' | 'failed' | 'discarded';

interface Edits {
  title: string;
  docType: string;
  academicYear: string;
  summary: string;
  tags: DocumentItem['tags'];
}

interface QueueItem {
  key: string;
  file: File;
  /** Folder or zip path the file came from; shown instead of the bare name. */
  path: string;
  status: ItemStatus;
  docId?: number;
  doc?: DocumentItem;
  edits?: Edits;
  error?: string;
  /** Epoch ms at each stage boundary; drives the times shown on the stage tracker. */
  uploadStartedAt?: number;
  uploadedAt?: number;
  readyAt?: number;
  confirmedAt?: number;
  confirming?: boolean;
}

const POLL_MS = 2000;
// The single-file flow gave up polling after 30 attempts (~60s) and showed whatever had loaded.
const POLL_GIVE_UP_MS = 60_000;

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: 'Waiting to upload',
  uploading: 'Uploading',
  processing: 'Analyzing',
  review: 'Ready for review',
  confirmed: 'Published',
  failed: 'Failed',
  discarded: 'Discarded',
};

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "<file>: <stage> failed because <reason>" so every failure names its file and says why. */
function failureText(path: string, stage: string, cause: unknown, fallback: string): string {
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  const reason = (raw || fallback).trim().replace(/[.\s]+$/, '');
  return `${path}: ${stage} failed because ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`;
}

function editsFrom(doc: DocumentItem): Edits {
  return {
    title: doc.title,
    docType: doc.document_type || '',
    academicYear: doc.academic_year || '',
    summary: doc.summary || '',
    tags: doc.tags || [],
  };
}

export function UploadReviewModal({ isOpen, onClose, onDocumentConfirmed }: UploadModalProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [started, setStarted] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reading, setReading] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);

  // Guards against double-starting an upload (strict-mode effects) and against late results after a reset.
  const startedKeys = useRef<Set<string>>(new Set());
  const generation = useRef(0);
  const totalRef = useRef(0);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const patch = useCallback((key: string, changes: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));
  }, []);

  const busy = items.some((it) => it.status === 'uploading' || it.status === 'processing');

  // Live clock so elapsed times tick while something is in flight.
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);

  // Upload one file at a time, in the order they were added.
  useEffect(() => {
    if (!started) return;
    if (items.some((it) => it.status === 'uploading')) return;
    const next = items.find((it) => it.status === 'queued' && !startedKeys.current.has(it.key));
    if (!next) return;

    startedKeys.current.add(next.key);
    const gen = generation.current;
    patch(next.key, { status: 'uploading', uploadStartedAt: Date.now() });

    IdmsApi.uploadDocument(next.file)
      .then((res) => {
        if (gen !== generation.current) return;
        const docId = res.data?.id as number | undefined;
        if (!docId) throw new Error('The server did not return a document id.');
        patch(next.key, { status: 'processing', docId, uploadedAt: Date.now() });
      })
      .catch((err) => {
        if (gen !== generation.current) return;
        patch(next.key, { status: 'failed', error: failureText(next.path, 'Upload', err, 'the upload did not complete') });
      });
  }, [started, items, patch]);

  // Poll every document that is being analyzed, in parallel.
  const processingKey = items
    .filter((it) => it.status === 'processing')
    .map((it) => it.key)
    .join('|');

  useEffect(() => {
    if (!processingKey) return;
    const gen = generation.current;
    const tick = async () => {
      const pending = itemsRef.current.filter((it) => it.status === 'processing' && it.docId);
      await Promise.all(
        pending.map(async (it) => {
          const waited = Date.now() - (it.uploadedAt ?? Date.now());
          try {
            const { data: doc } = await IdmsApi.getDocument(it.docId as number);
            if (gen !== generation.current) return;
            if (doc.processing_status === 'ready_for_review' || doc.processing_status === 'done') {
              patch(it.key, { status: 'review', doc, edits: editsFrom(doc), readyAt: Date.now() });
            } else if (doc.processing_status === 'failed') {
              patch(it.key, {
                status: 'failed',
                error: failureText(
                  it.path,
                  'Analysis',
                  doc.processing_error,
                  'the analysis pipeline reported an error without details',
                ),
              });
            } else if (waited > POLL_GIVE_UP_MS) {
              patch(it.key, {
                status: 'review',
                doc,
                edits: editsFrom(doc),
                readyAt: Date.now(),
                error: `${it.path}: analysis is taking longer than expected, so the suggestions below may be incomplete. Check them before publishing.`,
              });
            }
          } catch (err) {
            if (waited > POLL_GIVE_UP_MS && gen === generation.current) {
              patch(it.key, {
                status: 'failed',
                error: failureText(it.path, 'Analysis', err, "the processing status could not be read"),
              });
            }
          }
        }),
      );
    };
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [processingKey, patch]);

  // Keep the review pane on a document that can actually be reviewed.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setActiveKey((cur) => {
      const curItem = items.find((it) => it.key === cur);
      if (curItem && curItem.status === 'review') return cur;
      return items.find((it) => it.status === 'review')?.key ?? null;
    });
  }, [items]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null;

  /** Accepts loose files, folders and zips; zips are unpacked here so each document uploads on its own. */
  const addFiles = async (incoming: ExpandedFile[], readNotes: string[] = []) => {
    if (incoming.length === 0 && readNotes.length === 0) return;
    const gen = generation.current;
    setReading(true);
    try {
      const { files, skipped: notes } = await expandForUpload(incoming);
      if (gen !== generation.current) return;
      const existing = new Set(itemsRef.current.map((it) => `${it.path}:${it.file.size}`));
      const duplicates = files.filter((f) => existing.has(`${f.path}:${f.file.size}`));
      setSkipped((prev) => [
        ...prev,
        ...readNotes,
        ...notes,
        ...duplicates.map((f) => `${f.path}: could not be added because it is already in the list.`),
      ]);
      setItems((prev) => {
        const seen = new Set(prev.map((it) => `${it.path}:${it.file.size}`));
        const fresh = files
          .filter((f) => !seen.has(`${f.path}:${f.file.size}`))
          .map((f) => ({
            key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file: f.file,
            path: f.path,
            status: 'queued' as ItemStatus,
          }));
        return [...prev, ...fresh];
      });
    } finally {
      if (gen === generation.current) setReading(false);
    }
  };

  const removeQueued = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));

  const startUpload = () => {
    if (items.length === 0) return;
    totalRef.current = items.length;
    setNow(Date.now());
    setStarted(true);
  };

  const handleClose = () => {
    generation.current += 1;
    startedKeys.current = new Set();
    setItems([]);
    setSkipped([]);
    setReading(false);
    setStarted(false);
    setActiveKey(null);
    onClose();
  };

  const editActive = (changes: Partial<Edits>) => {
    setItems((prev) =>
      prev.map((it) => (it.key === activeKey && it.edits ? { ...it, edits: { ...it.edits, ...changes } } : it)),
    );
  };

  const handleTagToggle = (idx: number, newStatus: 'accepted' | 'rejected') => {
    const current = items.find((it) => it.key === activeKey);
    if (!current?.edits) return;
    const updated = [...current.edits.tags];
    updated[idx] = { ...updated[idx], status: newStatus };
    editActive({ tags: updated });
  };

  const handleConfirm = async () => {
    const current = items.find((it) => it.key === activeKey);
    if (!current || !current.docId || !current.edits) return;
    patch(current.key, { confirming: true, error: undefined });
    try {
      const res = await IdmsApi.confirmDocument(current.docId, {
        title: current.edits.title,
        document_type: current.edits.docType,
        academic_year: current.edits.academicYear,
        summary: current.edits.summary,
        tags: current.edits.tags,
      });
      patch(current.key, { status: 'confirmed', confirming: false, confirmedAt: Date.now() });
      onDocumentConfirmed(res.data, { total: totalRef.current });
    } catch (err) {
      patch(current.key, {
        confirming: false,
        error: failureText(current.path, 'Publishing', err, 'the document could not be saved'),
      });
    }
  };

  const handleDiscard = () => {
    if (activeKey) patch(activeKey, { status: 'discarded' });
  };

  const active = items.find((it) => it.key === activeKey && it.status === 'review');
  const settled = items.filter((it) => ['confirmed', 'discarded', 'failed'].includes(it.status)).length;
  const allSettled = started && items.length > 0 && settled === items.length;
  const awaitingReview = items.filter((it) => it.status === 'review').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {!started && (
          <div>
            <h2 className="text-xl font-bold text-slate-900">Upload Once, Organize Automatically</h2>
            <p className="mt-1 text-sm text-slate-500">
              The AI engine will read, classify, tag, extract metadata, and file your documents instantly.
            </p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                // Collect synchronously: the browser empties the DataTransfer after the handler returns.
                const pending = collectFromDrop(e.dataTransfer);
                void pending.then((res) => addFiles(res.files, res.skipped));
              }}
              className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-indigo-500"
            >
              <UploadCloud className="h-12 w-12 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Drag and drop files, a folder or a zip here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PDF, DOCX, XLSX, PPTX, Images up to 50MB each. Zips and folders are opened and every file inside is
                uploaded on its own.
              </p>
              <input
                type="file"
                multiple
                className="hidden"
                id="file-upload"
                onChange={(e) => {
                  if (e.target.files) void addFiles(collectFromInput(e.target.files));
                  e.target.value = '';
                }}
              />
              <input
                type="file"
                className="hidden"
                id="folder-upload"
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                onChange={(e) => {
                  if (e.target.files) void addFiles(collectFromInput(e.target.files));
                  e.target.value = '';
                }}
              />
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  type="button"
                  disabled={reading}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Browse Device
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  type="button"
                  disabled={reading}
                  onClick={() => document.getElementById('folder-upload')?.click()}
                >
                  Choose folder
                </Button>
              </div>
              {reading && (
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading files and opening zips…
                </p>
              )}
            </div>

            {skipped.length > 0 && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold">
                  {skipped.length} {skipped.length === 1 ? 'file' : 'files'} could not be added
                </p>
                <ul className="mt-1 max-h-24 list-disc space-y-0.5 overflow-y-auto pl-4">
                  {skipped.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {items.length > 0 && (
              <ul className="mt-4 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {items.map((it) => (
                  <li key={it.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-slate-800" title={it.path}>{it.path}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatSize(it.file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeQueued(it.key)}
                      className="shrink-0 text-slate-400 hover:text-red-600"
                      aria-label={`Remove ${it.file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button
                disabled={items.length === 0 || reading}
                onClick={startUpload}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {items.length > 1 ? `Upload & Process ${items.length} files` : 'Upload & Process'}
              </Button>
            </div>
          </div>
        )}

        {started && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Processing your documents</h2>
              <p className="mt-1 text-sm text-slate-500">
                {settled} of {items.length} finished
                {awaitingReview > 0 ? ` · ${awaitingReview} waiting for your review` : ''}
              </p>
            </div>

            <ul className="space-y-2">
              {items.map((it) => (
                <QueueRow
                  key={it.key}
                  item={it}
                  now={now}
                  isActive={it.key === activeKey}
                  onSelect={() => it.status === 'review' && setActiveKey(it.key)}
                />
              ))}
            </ul>

            {active && active.doc && active.edits && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 truncate text-sm font-semibold">
                    AI Intelligent Review Ready — {active.file.name}
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Confidence: {Math.round((active.doc.confidence || 0.8) * 100)}%
                  </span>
                </div>

                {active.error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{active.error}</div>}

                <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Logical Location:</span>
                  <span>{active.doc.logical_location?.path}</span>
                </div>

                {active.doc.warnings && active.doc.warnings.length > 0 && (
                  <div className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    {active.doc.warnings.map((w: DocumentWarning, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>{typeof w === 'string' ? w : w.message || w.type}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Document Title</label>
                    <input
                      type="text"
                      value={active.edits.title}
                      onChange={(e) => editActive({ title: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Detected Type</label>
                      <input
                        type="text"
                        value={active.edits.docType}
                        onChange={(e) => editActive({ docType: e.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Academic Year</label>
                      <input
                        type="text"
                        value={active.edits.academicYear}
                        onChange={(e) => editActive({ academicYear: e.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">Executive Summary</label>
                    <textarea
                      rows={3}
                      value={active.edits.summary}
                      onChange={(e) => editActive({ summary: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">Suggested Tags (Accept / Reject)</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {active.edits.tags.map((t, idx) => (
                        <div
                          key={idx}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                            t.status === 'accepted'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : t.status === 'rejected'
                              ? 'border-slate-200 bg-slate-100 text-slate-400 line-through'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          <span>{t.name}</span>
                          {t.status !== 'accepted' && (
                            <button
                              type="button"
                              onClick={() => handleTagToggle(idx, 'accepted')}
                              className="font-bold hover:text-emerald-900"
                              title="Accept tag"
                            >
                              ✓
                            </button>
                          )}
                          {t.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleTagToggle(idx, 'rejected')}
                              className="font-bold hover:text-red-900"
                              title="Reject tag"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="ghost" onClick={handleDiscard} disabled={active.confirming}>Discard</Button>
                  <Button
                    disabled={active.confirming}
                    onClick={handleConfirm}
                    className="bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    {active.confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirm & Publish
                  </Button>
                </div>
              </div>
            )}

            {!active && busy && (
              <p className="text-center text-xs text-slate-500">
                Running text extraction, optical character recognition (OCR), AI entity parsing, and duplicate check.
                The first file that finishes will open here for review.
              </p>
            )}

            {allSettled && (
              <div className="flex justify-end border-t pt-4">
                <Button onClick={handleClose} className="bg-indigo-600 text-white hover:bg-indigo-700">Done</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueRow({
  item,
  now,
  isActive,
  onSelect,
}: {
  item: QueueItem;
  now: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { status } = item;
  const uploadMs = item.uploadStartedAt !== undefined ? (item.uploadedAt ?? now) - item.uploadStartedAt : 0;
  const analyzeMs = item.uploadedAt !== undefined ? (item.readyAt ?? now) - item.uploadedAt : 0;

  // Only the stages the backend actually reports: upload, analysis (one pipeline job), review, publish.
  const stages: Array<{ label: string; state: 'done' | 'active' | 'todo'; detail?: string }> = [
    {
      label: 'Upload',
      state: item.uploadedAt ? 'done' : status === 'uploading' ? 'active' : 'todo',
      detail:
        item.uploadStartedAt !== undefined
          ? `${formatClock(item.uploadStartedAt)} · ${formatDuration(uploadMs)}`
          : undefined,
    },
    {
      label: 'Analyze (extract, OCR, classify, tag, duplicate check)',
      state: item.readyAt ? 'done' : status === 'processing' ? 'active' : 'todo',
      detail:
        item.uploadedAt !== undefined ? `${formatClock(item.uploadedAt)} · ${formatDuration(analyzeMs)}` : undefined,
    },
    {
      label: 'Review',
      state: item.confirmedAt || status === 'discarded' ? 'done' : status === 'review' ? 'active' : 'todo',
      detail: item.readyAt !== undefined ? `Ready at ${formatClock(item.readyAt)}` : undefined,
    },
    {
      label: 'Publish',
      state: item.confirmedAt ? 'done' : 'todo',
      detail: item.confirmedAt !== undefined ? formatClock(item.confirmedAt) : undefined,
    },
  ];

  const badge =
    status === 'failed'
      ? 'bg-red-50 text-red-700'
      : status === 'confirmed'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'review'
      ? 'bg-indigo-50 text-indigo-700'
      : 'bg-slate-100 text-slate-600';

  return (
    <li
      className={`rounded-lg border p-3 ${isActive ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'} ${
        status === 'review' ? 'cursor-pointer' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 text-sm">
        {(status === 'uploading' || status === 'processing') && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
        )}
        {status === 'confirmed' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
        {status === 'failed' && <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />}
        {(status === 'queued' || status === 'review' || status === 'discarded') && (
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={item.path}>{item.path}</span>
        <span className="shrink-0 text-xs text-slate-400">{formatSize(item.file.size)}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>{STATUS_LABEL[status]}</span>
      </div>

      {status !== 'queued' && status !== 'discarded' && (
        <ol className="mt-2 space-y-1 pl-6">
          {stages.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              {s.state === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : s.state === 'active' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              )}
              <span className={s.state === 'todo' ? 'text-slate-400' : 'text-slate-700'}>{s.label}</span>
              {s.detail && <span className="ml-auto shrink-0 tabular-nums text-slate-500">{s.detail}</span>}
            </li>
          ))}
        </ol>
      )}

      {status === 'failed' && item.error && <p className="mt-2 pl-6 text-xs text-red-700">{item.error}</p>}
    </li>
  );
}
