'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  AlertTriangle,
  Loader2,
  X,
  CheckCircle2,
  Circle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/result/toast';
import { IdmsApi, ApiError, type DocumentItem, type DocumentWarning } from '../_lib/idms-api';
import { QuestionPapersApi, type DocumentKind } from '../_lib/question-papers-api';
import { DOCUMENT_KINDS, DocumentTypePicker } from './document-type-picker';
import {
  collectFromDrop,
  collectFromInput,
  expandForUpload,
  type ExpandedFile,
} from '@/app/documents/_lib/expand-upload';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called once when every file in the batch has either been published or has failed. */
  onFinished: (result: { published: number; failed: number }) => void;
  /** Opens the Question papers tab, where background extraction can be followed. */
  onOpenQuestionPapers?: () => void;
}

type ItemStatus = 'queued' | 'uploading' | 'processing' | 'publishing' | 'published' | 'failed' | 'duplicate';
/** Where a failed file stopped, which decides what "Retry" has to redo. */
type FailedStage = 'upload' | 'analysis' | 'timeout' | 'publish';

interface QueueItem {
  key: string;
  file: File;
  /** Folder or zip path the file came from; shown instead of the bare name. */
  path: string;
  /** SHA-256 of file content, used to detect same-content duplicates within the batch. */
  contentHash?: string;
  status: ItemStatus;
  /** What the uploader said this file is; required before upload starts. */
  docType?: DocumentKind;
  /** Set for a question paper: extraction continues on the server, so there is nothing to wait for here. */
  jobId?: string;
  scheduleExtraction?: boolean;
  scheduledAt?: string;
  docId?: number;
  error?: string;
  failedStage?: FailedStage;
  /** Short status line, e.g. while waiting to retry after a busy server. */
  note?: string;
  warnings?: string[];
  /** Epoch ms at each stage boundary; drives the times shown on the stage tracker. */
  uploadStartedAt?: number;
  uploadedAt?: number;
  readyAt?: number;
  publishedAt?: number;
}

const POLL_MS = 2000;
// Analysis is one backend job. Past this the file is reported as failed with a Retry that checks it again.
const ANALYSIS_TIMEOUT_MS = 3 * 60_000;
// Waits before re-sending an upload the server refused as busy or that never reached it.
const UPLOAD_RETRY_DELAYS_MS = [2000, 5000, 12_000];
const AUTO_CLOSE_MS = 1600;

// How far through the pipeline a file counts as being, for the overall progress bar.
const STAGE_WEIGHT: Record<ItemStatus, number> = {
  queued: 0,
  uploading: 0.15,
  processing: 0.5,
  publishing: 0.85,
  published: 1,
  failed: 1,
  duplicate: 1,
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: 'Waiting',
  uploading: 'Uploading',
  processing: 'Analyzing',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
  duplicate: 'Duplicate blocked',
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function sha256hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatLocalDateTime(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function scheduledDateTimeText(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "<file>: <stage> failed because <reason>." so every failure names its file and says why. */
function failureText(path: string, stage: string, cause: unknown, fallback: string): string {
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  const reason = (raw || fallback).trim().replace(/[.\s]+$/, '');
  return `${path}: ${stage} failed because ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`;
}

/** Failures where the server never started on the file, so sending it again cannot create a duplicate. */
function isTransientUpload(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status === 429 || err.status === 503);
}

function warningText(w: DocumentWarning): string {
  return typeof w === 'string' ? w : w.message || w.type || '';
}

export function UploadReviewModal({ isOpen, onClose, onFinished, onOpenQuestionPapers }: UploadModalProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  // The choice made for "all files"; files added afterwards start with it.
  const [defaultKind, setDefaultKind] = useState<DocumentKind | null>(null);
  const defaultKindRef = useRef<DocumentKind | null>(null);
  const [started, setStarted] = useState(false);
  const [reading, setReading] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const itemsRef = useRef(items);
  const generation = useRef(0);
  // Keys waiting for their upload turn. A single worker drains it, so uploads go strictly one at a time.
  const pending = useRef<string[]>([]);
  const draining = useRef(false);
  const notified = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    itemsRef.current = items;
    onFinishedRef.current = onFinished;
    onCloseRef.current = onClose;
  });

  const patch = useCallback((key: string, changes: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));
  }, []);

  const pathOf = (key: string) => itemsRef.current.find((it) => it.key === key)?.path ?? 'file';

  /** Confirm the document with what the analysis found. No review step: this is the auto-publish. */
  const publish = useCallback(
    async (key: string, docId: number, known?: DocumentItem) => {
      const path = pathOf(key);
      patch(key, { status: 'publishing', note: undefined, error: undefined, failedStage: undefined });
      try {
        const doc = known ?? (await IdmsApi.getDocument(docId)).data;
        await IdmsApi.confirmDocument(docId, {
          title: doc.title,
          document_type: doc.document_type || '',
          academic_year: doc.academic_year || '',
          summary: doc.summary || '',
          // AI-suggested tags are accepted as-is; anything already rejected stays rejected.
          tags: (doc.tags || []).map((t) => ({ ...t, status: t.status === 'rejected' ? 'rejected' : 'accepted' })),
        });
        patch(key, {
          status: 'published',
          publishedAt: Date.now(),
          warnings: (doc.warnings || []).map(warningText).filter(Boolean),
        });
      } catch (err) {
        patch(key, {
          status: 'failed',
          failedStage: 'publish',
          error: failureText(path, 'Publishing', err, 'the document could not be saved'),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch],
  );

  /** Wait for the analysis of one uploaded document, then publish it. Runs alongside the next upload. */
  const finish = useCallback(
    async (key: string, docId: number) => {
      const path = pathOf(key);
      const startedAt = Date.now();
      for (;;) {
        try {
          const { data: doc } = await IdmsApi.getDocument(docId);
          if (doc.processing_status === 'ready_for_review' || doc.processing_status === 'done') {
            patch(key, { readyAt: Date.now() });
            await publish(key, docId, doc);
            return;
          }
          if (doc.processing_status === 'failed') {
            patch(key, {
              status: 'failed',
              failedStage: 'analysis',
              error: failureText(
                path,
                'Analysis',
                doc.processing_error,
                'the analysis pipeline reported an error without details',
              ),
            });
            return;
          }
        } catch (err) {
          if (Date.now() - startedAt > ANALYSIS_TIMEOUT_MS) {
            patch(key, {
              status: 'failed',
              failedStage: 'timeout',
              error: failureText(path, 'Analysis', err, 'the processing status could not be read'),
            });
            return;
          }
        }
        if (Date.now() - startedAt > ANALYSIS_TIMEOUT_MS) {
          patch(key, {
            status: 'failed',
            failedStage: 'timeout',
            error: `${path}: Analysis failed because it did not finish within ${ANALYSIS_TIMEOUT_MS / 60_000} minutes. The file is uploaded and may still complete; use Retry to check again.`,
          });
          return;
        }
        await sleep(POLL_MS);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch, publish],
  );

  const uploadOne = useCallback(
    async (item: QueueItem) => {
      patch(item.key, {
        status: 'uploading',
        uploadStartedAt: Date.now(),
        uploadedAt: undefined,
        readyAt: undefined,
        publishedAt: undefined,
        error: undefined,
        failedStage: undefined,
        note: undefined,
      });

      for (let attempt = 0; ; attempt++) {
        try {
          if (item.docType === 'question_paper') {
            // Stored and queued on the server; this returns without waiting for extraction.
            const scheduledAt =
              item.scheduleExtraction && item.scheduledAt ? new Date(item.scheduledAt).toISOString() : undefined;
            const job = await QuestionPapersApi.upload(item.file, scheduledAt ? { scheduled_at: scheduledAt } : {});
            patch(item.key, {
              status: 'published',
              jobId: job.id,
              scheduledAt: job.scheduled_at ?? item.scheduledAt,
              docId: job.document_id,
              uploadedAt: Date.now(),
              publishedAt: Date.now(),
              note: undefined,
            });
            return;
          }
          const res = await IdmsApi.uploadDocument(
            item.file,
            'organization',
            item.docType === 'general' ? undefined : item.docType,
          );
          const docId = res.data?.id as number | undefined;
          if (!docId) throw new Error('the server did not return a document id');
          patch(item.key, { status: 'processing', docId, uploadedAt: Date.now(), note: undefined });
          void finish(item.key, docId);
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            patch(item.key, {
              status: 'duplicate',
              note: undefined,
              error: undefined,
            });
            toast.info(
              'Duplicate question paper not stored',
              `${item.path} was already uploaded. No new document or extraction job was created.`,
            );
            return;
          }
          if (isTransientUpload(err) && attempt < UPLOAD_RETRY_DELAYS_MS.length) {
            const retryAfterMs = err instanceof ApiError && err.retryAfter ? err.retryAfter * 1000 : 0;
            const wait = Math.max(UPLOAD_RETRY_DELAYS_MS[attempt], retryAfterMs);
            patch(item.key, {
              note: `Server busy, trying again in ${Math.round(wait / 1000)}s (attempt ${attempt + 2} of ${UPLOAD_RETRY_DELAYS_MS.length + 1})`,
            });
            await sleep(wait);
            continue;
          }
          patch(item.key, {
            status: 'failed',
            failedStage: 'upload',
            note: undefined,
            error: failureText(item.path, 'Upload', err, 'the upload did not complete'),
          });
          return;
        }
      }
    },
    [patch, finish],
  );

  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    try {
      while (pending.current.length > 0) {
        const key = pending.current.shift() as string;
        const item = itemsRef.current.find((it) => it.key === key);
        // A failure on one file never stops the next one.
        if (item) await uploadOne(item);
      }
    } finally {
      draining.current = false;
    }
  }, [uploadOne]);

  const busy = items.some((it) => ['queued', 'uploading', 'processing', 'publishing'].includes(it.status));
  const publishedCount = items.filter((it) => it.status === 'published').length;
  const failedCount = items.filter((it) => it.status === 'failed').length;
  const duplicateCount = items.filter((it) => it.status === 'duplicate').length;
  const uploadableCount = items.length - duplicateCount;
  const retryableFailedCount = failedCount;
  const settled = started && items.length > 0 && !busy;
  const percent =
    uploadableCount === 0
      ? 100
      : Math.round((items.filter((it) => it.status !== 'duplicate').reduce((sum, it) => sum + STAGE_WEIGHT[it.status], 0) / uploadableCount) * 100);

  // Live clock so elapsed times tick while something is in flight.
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const resetAll = useCallback(() => {
    generation.current += 1;
    pending.current = [];
    notified.current = false;
    setItems([]);
    setSkipped([]);
    setReading(false);
    setStarted(false);
    defaultKindRef.current = null;
    setDefaultKind(null);
  }, []);

  // Tell the library once per settle (and again after a retry settles) so it can reload and show the result.
  useEffect(() => {
    if (!settled) {
      notified.current = false;
      return;
    }
    if (notified.current) return;
    notified.current = true;
    onFinishedRef.current({ published: publishedCount, failed: failedCount });
  }, [settled, publishedCount, failedCount]);

  // Google-Drive style: close by itself when everything went through. Not when a question paper is
  // processing in the background: the person needs to read where to follow it.
  const hasBackgroundJobs = items.some((it) => it.jobId);
  useEffect(() => {
    if (!settled || failedCount > 0 || hasBackgroundJobs) return;
    const t = setTimeout(() => {
      resetAll();
      onCloseRef.current();
    }, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [settled, failedCount, hasBackgroundJobs, resetAll]);

  if (!isOpen) return null;

  /** Accepts loose files, folders and zips; zips are unpacked here so each document uploads on its own. */
  const addFiles = async (incoming: ExpandedFile[], readNotes: string[] = []) => {
    if (incoming.length === 0 && readNotes.length === 0) return;
    const gen = generation.current;
    setReading(true);
    try {
      const { files, skipped: notes } = await expandForUpload(incoming);
      if (gen !== generation.current) return;

      // Compute SHA-256 for each file to detect same-content duplicates.
      const withHashes = await Promise.all(
        files.map(async (f) => ({ ...f, hash: await sha256hex(f.file) })),
      );
      if (gen !== generation.current) return;

      const blocked: string[] = [...readNotes, ...notes];

      // 1. Deduplicate within the incoming batch (same content, different names).
      const batchSeen = new Map<string, string>(); // hash → first path
      const afterBatchDedup = withHashes.filter((f) => {
        const first = batchSeen.get(f.hash);
        if (first) {
          blocked.push(`${f.path}: same content as "${first}" — not added`);
          return false;
        }
        batchSeen.set(f.hash, f.path);
        return true;
      });

      // 2. Skip files already in the queue (by content hash or by path+size).
      const existingHashes = new Set(itemsRef.current.map((it) => it.contentHash).filter(Boolean) as string[]);
      const existingPathSize = new Set(itemsRef.current.map((it) => `${it.path}:${it.file.size}`));

      const afterQueueDedup = afterBatchDedup.filter((f) => {
        if (existingHashes.has(f.hash)) {
          const original = itemsRef.current.find((it) => it.contentHash === f.hash);
          blocked.push(
            `${f.path}: same content as "${original?.path ?? 'a file already in the list'}" — not added`,
          );
          return false;
        }
        if (existingPathSize.has(`${f.path}:${f.file.size}`)) {
          blocked.push(`${f.path}: already in the list — not added`);
          return false;
        }
        return true;
      });

      // 3. Pre-flight server duplicate check: run all in parallel, block matches.
      const serverChecks = await Promise.all(
        afterQueueDedup.map(async (f) => {
          const match = await IdmsApi.checkDuplicate(f.hash);
          return { f, match };
        }),
      );
      if (gen !== generation.current) return;

      const fresh = serverChecks.filter(({ f, match }) => {
        if (match) {
          blocked.push(
            `${f.path}: already uploaded as "${match.title}" (ID ${match.document_id}) — not added`,
          );
          return false;
        }
        return true;
      }).map(({ f }) => f);

      setSkipped((prev) => [...prev, ...blocked]);
      setItems((prev) => [
        ...prev,
        ...fresh.map((f) => ({
          key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: f.file,
          path: f.path,
          contentHash: f.hash,
          status: 'queued' as ItemStatus,
          docType: defaultKindRef.current ?? undefined,
        })),
      ]);
    } finally {
      if (gen === generation.current) setReading(false);
    }
  };

  const removeQueued = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));

  /** One choice for every file in the list; a file can still be changed on its own afterwards. */
  const chooseForAll = (kind: DocumentKind) => {
    defaultKindRef.current = kind;
    setDefaultKind(kind);
    setItems((prev) => prev.map((it) => ({ ...it, docType: kind })));
  };

  const chooseForOne = (key: string, kind: DocumentKind) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, docType: kind } : it)));
  };

  const isPdf = (file: File) => /\.pdf$/i.test(file.name);
  const untyped = items.filter((it) => !it.docType).length;
  const notPdf = items.filter((it) => it.docType === 'question_paper' && !isPdf(it.file));
  const invalidSchedules = items.filter((it) => {
    if (it.docType !== 'question_paper' || !it.scheduleExtraction) return false;
    if (!it.scheduledAt) return true;
    const scheduled = new Date(it.scheduledAt);
    return Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= now;
  });
  const canStart = items.length > 0 && !reading && untyped === 0 && notPdf.length === 0 && invalidSchedules.length === 0;

  const startUpload = () => {
    if (!canStart) return;
    pending.current = items.map((it) => it.key);
    notified.current = false;
    setNow(Date.now());
    setStarted(true);
    void drain();
  };

  /** Stop uploading files that have not started. Files already uploaded still finish and publish. */
  const cancelRemaining = () => {
    const dropped = new Set(pending.current);
    pending.current = [];
    setItems((prev) =>
      prev.map((it) =>
        dropped.has(it.key)
          ? {
              ...it,
              status: 'failed' as ItemStatus,
              failedStage: 'upload' as FailedStage,
              error: `${it.path}: Upload failed because it was cancelled before it started. Use Retry to upload it.`,
            }
          : it,
      ),
    );
  };

  const retryItems = (keys: string[]) => {
    notified.current = false;
    for (const key of keys) {
      const it = itemsRef.current.find((x) => x.key === key);
      if (!it || it.status !== 'failed') continue;
      if (it.failedStage === 'publish' && it.docId) {
        void publish(key, it.docId);
      } else if (it.failedStage === 'timeout' && it.docId) {
        patch(key, { status: 'processing', error: undefined, failedStage: undefined, uploadedAt: Date.now() });
        void finish(key, it.docId);
      } else {
        // Upload or analysis failure: the file is sent again from scratch.
        patch(key, { status: 'queued', error: undefined, failedStage: undefined, docId: undefined });
        pending.current.push(key);
      }
    }
    void drain();
  };

  const handleClose = () => {
    if (busy && !window.confirm('Uploads are still running. Close anyway? Files already uploaded will still be published, the rest will not be uploaded.')) {
      return;
    }
    if (started) onFinishedRef.current({ published: publishedCount, failed: failedCount });
    resetAll();
    onClose();
  };

  const backgroundJobs = items.filter((it) => it.jobId).length;
  const scheduledBackgroundJobs = items.filter((it) => it.jobId && it.scheduledAt).length;

  const header = !started
    ? null
    : settled
    ? failedCount === 0
      ? {
          tone: 'ok' as const,
          title:
            backgroundJobs > 0
            ? `${uploadableCount} ${uploadableCount === 1 ? 'file' : 'files'} uploaded`
            : uploadableCount === 0
              ? 'No new files uploaded'
              : `All ${uploadableCount} ${uploadableCount === 1 ? 'file' : 'files'} uploaded and published`,
        }
      : {
          tone: 'bad' as const,
          title:
            publishedCount > 0
              ? `${publishedCount} published, ${failedCount} could not be uploaded`
              : `${failedCount === 1 ? 'The file' : `All ${failedCount} files`} could not be uploaded`,
        }
    : { tone: 'busy' as const, title: 'Uploading your documents' };

  const current = items.find((it) => it.status === 'uploading') ?? items.find((it) => it.status === 'processing');

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
              Documents are organized automatically. Question papers can be extracted now or scheduled for later.
            </p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                // Collect synchronously: the browser empties the DataTransfer after the handler returns.
                const pendingDrop = collectFromDrop(e.dataTransfer);
                void pendingDrop.then((res) => addFiles(res.files, res.skipped));
              }}
              className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-indigo-500"
            >
              <UploadCloud className="h-12 w-12 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Drag and drop files, a folder or a zip here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PDF, DOCX, XLSX, PPTX, Images up to 50MB each. Zips and folders are opened and every file inside is
                uploaded on its own, then published automatically.
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
              <div className="mt-4">
                <DocumentTypePicker
                  value={defaultKind}
                  onChange={chooseForAll}
                  heading={
                    items.length === 1
                      ? 'What type of document is this?'
                      : `What type of document are these ${items.length} files? You can change a single file below.`
                  }
                />
              </div>
            )}

            {items.length > 0 && (
              <ul className="mt-4 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {items.map((it) => (
                  <li key={it.key} className="px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-slate-800" title={it.path}>{it.path}</span>
                      <span className="shrink-0 text-xs text-slate-400">{formatSize(it.file.size)}</span>
                      <select
                        value={it.docType ?? ''}
                        onChange={(e) => e.target.value && chooseForOne(it.key, e.target.value as DocumentKind)}
                        aria-label={`Document type for ${it.path}`}
                        className={`shrink-0 rounded-md border px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                          !it.docType || (it.docType === 'question_paper' && !isPdf(it.file))
                            ? 'border-red-300 text-red-700'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        <option value="" disabled>
                          Choose type
                        </option>
                        {DOCUMENT_KINDS.map((kind) => (
                          <option key={kind.value} value={kind.value}>
                            {kind.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeQueued(it.key)}
                        className="shrink-0 text-slate-400 hover:text-red-600"
                        aria-label={`Remove ${it.path}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {it.docType === 'question_paper' && (
                      <div className="mt-2 space-y-2 pl-6">
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={it.scheduleExtraction ?? false}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((item) =>
                                  item.key === it.key
                                    ? { ...item, scheduleExtraction: e.target.checked, scheduledAt: e.target.checked ? item.scheduledAt : undefined }
                                    : item,
                                ),
                              )
                            }
                            className="rounded border-slate-300 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                          />
                          Schedule extraction
                        </label>
                        {it.scheduleExtraction && (
                          <label className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span>Scheduled date and time</span>
                            <input
                              type="datetime-local"
                              required
                              min={formatLocalDateTime(new Date(now))}
                              value={it.scheduledAt ?? ''}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((item) => item.key === it.key ? { ...item, scheduledAt: e.target.value } : item),
                                )
                              }
                              aria-label={`Scheduled date and time for ${it.path}`}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                            />
                            <span>Your local time; extraction starts automatically.</span>
                          </label>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {items.length > 0 && untyped > 0 && (
              <p className="mt-3 text-xs text-slate-600" role="status">
                Choose a document type for {untyped === 1 ? 'the remaining file' : `${untyped} files`} to continue.
              </p>
            )}
            {notPdf.length > 0 && (
              <p className="mt-3 text-xs text-red-700" role="alert">
                Question papers must be PDF files. Change the type or remove: {notPdf.map((it) => it.path).join(', ')}.
              </p>
            )}
            {invalidSchedules.length > 0 && (
              <p className="mt-3 text-xs text-red-700" role="alert">
                Choose a future date and time for each scheduled question paper.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button
                disabled={!canStart}
                onClick={startUpload}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {items.length > 1 ? `Upload ${items.length} files` : 'Upload'}
              </Button>
            </div>
          </div>
        )}

        {started && header && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pr-8">
              {header.tone === 'ok' && <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />}
              {header.tone === 'bad' && <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />}
              {header.tone === 'busy' && <Loader2 className="h-6 w-6 shrink-0 animate-spin text-indigo-600" />}
              <h2 className="text-xl font-bold text-slate-900">{header.title}</h2>
            </div>

            <div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label="Upload progress"
                className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    header.tone === 'ok' ? 'bg-emerald-500' : header.tone === 'bad' ? 'bg-red-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-slate-600">
                <span className="min-w-0 truncate">
                  {publishedCount} of {uploadableCount} {uploadableCount === 1 ? 'file' : 'files'} uploaded and published
                  {failedCount > 0 ? ` · ${failedCount} failed` : ''}
                  {current && !settled ? ` · ${STATUS_LABEL[current.status]} ${current.path}` : ''}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800">{percent}%</span>
              </div>
            </div>

            {settled && failedCount === 0 && backgroundJobs === 0 && (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                {uploadableCount === 0
                  ? `${duplicateCount} duplicate ${duplicateCount === 1 ? 'question paper was' : 'question papers were'} not stored. No extraction job was started.`
                  : 'Everything was uploaded and published to the Document Library. This window will close now.'}
              </p>
            )}

            {backgroundJobs > 0 && (
              <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900" role="status">
                {scheduledBackgroundJobs > 0 && (
                  <p>
                    {scheduledBackgroundJobs === 1 ? 'The question paper is' : `${scheduledBackgroundJobs} question papers are`} scheduled.
                    Extraction will start automatically at the selected time; you do not need to keep the application open.
                  </p>
                )}
                {backgroundJobs > scheduledBackgroundJobs && (
                  <p>
                    {backgroundJobs - scheduledBackgroundJobs === 1 ? 'The question paper is' : `${backgroundJobs - scheduledBackgroundJobs} question papers are`} being
                    processed on the server. You can close this window; processing continues in the background and you will get a notification when it finishes.
                  </p>
                )}
                {onOpenQuestionPapers && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      handleClose();
                      onOpenQuestionPapers();
                    }}
                  >
                    View question paper progress
                  </Button>
                )}
              </div>
            )}

            <ul className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
              {items.filter((it) => it.status !== 'duplicate').map((it) => (
                <QueueRow key={it.key} item={it} now={now} onRetry={() => retryItems([it.key])} />
              ))}
            </ul>

            <div className="flex justify-end gap-2 border-t pt-4">
              {busy && items.some((it) => it.status === 'queued') && (
                <Button variant="ghost" onClick={cancelRemaining}>Cancel remaining files</Button>
              )}
              {settled && retryableFailedCount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => retryItems(items.filter((it) => it.status === 'failed').map((it) => it.key))}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retry {retryableFailedCount} failed
                </Button>
              )}
              {settled && (
                <Button onClick={handleClose} className="bg-indigo-600 text-white hover:bg-indigo-700">
                  {failedCount > 0 ? 'Close' : 'Done'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueRow({ item, now, onRetry }: { item: QueueItem; now: number; onRetry: () => void }) {
  const { status } = item;
  const uploadMs = item.uploadStartedAt !== undefined ? (item.uploadedAt ?? now) - item.uploadStartedAt : 0;
  const analyzeMs = item.uploadedAt !== undefined ? (item.readyAt ?? now) - item.uploadedAt : 0;
  const publishMs = item.readyAt !== undefined ? (item.publishedAt ?? now) - item.readyAt : 0;
  const failedAt = status === 'failed' ? item.failedStage : undefined;

  // Only the stages the backend actually reports: upload, analysis (one pipeline job) and publish.
  const stages: Array<{ label: string; state: 'done' | 'active' | 'failed' | 'todo'; detail?: string }> = [
    {
      label: 'Upload',
      state: failedAt === 'upload' ? 'failed' : item.uploadedAt ? 'done' : status === 'uploading' ? 'active' : 'todo',
      detail:
        item.uploadStartedAt !== undefined
          ? `${formatClock(item.uploadStartedAt)} · ${formatDuration(uploadMs)}`
          : undefined,
    },
    {
      label: 'Analyze (extract, OCR, classify, tag, duplicate check)',
      state:
        failedAt === 'analysis' || failedAt === 'timeout'
          ? 'failed'
          : item.readyAt
          ? 'done'
          : status === 'processing'
          ? 'active'
          : 'todo',
      detail:
        item.uploadedAt !== undefined ? `${formatClock(item.uploadedAt)} · ${formatDuration(analyzeMs)}` : undefined,
    },
    {
      label: 'Publish',
      state: failedAt === 'publish' ? 'failed' : item.publishedAt ? 'done' : status === 'publishing' ? 'active' : 'todo',
      detail:
        item.readyAt !== undefined ? `${formatClock(item.readyAt)} · ${formatDuration(publishMs)}` : undefined,
    },
  ];

  const badge = status === 'failed'
      ? 'bg-red-50 text-red-700'
      : status === 'published'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'queued'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-indigo-50 text-indigo-700';

  return (
    <li className={`rounded-lg border p-3 ${status === 'failed' ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="flex items-center gap-2 text-sm">
        {(status === 'uploading' || status === 'processing' || status === 'publishing') && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
        )}
        {status === 'published' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
        {status === 'failed' && <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />}
        {status === 'queued' && <FileText className="h-4 w-4 shrink-0 text-slate-400" />}
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={item.path}>{item.path}</span>
        <span className="shrink-0 text-xs text-slate-400">{formatSize(item.file.size)}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
          {item.jobId && status === 'published'
            ? item.scheduledAt && new Date(item.scheduledAt).getTime() > now
              ? 'Scheduled'
              : 'Processing in background'
            : STATUS_LABEL[status]}
        </span>
      </div>

      {item.note && <p className="mt-1.5 pl-6 text-xs text-amber-700">{item.note}</p>}

      {(status === 'uploading' || status === 'processing' || status === 'publishing' || status === 'failed') && (
        <ol className="mt-2 space-y-1 pl-6">
          {stages.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              {s.state === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : s.state === 'active' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" />
              ) : s.state === 'failed' ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              )}
              <span className={s.state === 'todo' ? 'text-slate-400' : s.state === 'failed' ? 'text-red-700' : 'text-slate-700'}>
                {s.label}
              </span>
              {s.detail && <span className="ml-auto shrink-0 tabular-nums text-slate-500">{s.detail}</span>}
            </li>
          ))}
        </ol>
      )}

      {status === 'published' && item.publishedAt !== undefined && item.uploadStartedAt !== undefined && (
        <p className="mt-1 pl-6 text-xs text-slate-500">
          {item.jobId ? 'Uploaded' : 'Published'} at {formatClock(item.publishedAt)} · took {formatDuration(item.publishedAt - item.uploadStartedAt)}
        </p>
      )}
      {item.jobId && item.scheduledAt && (
        <p className="mt-1 pl-6 text-xs text-slate-600">
          Scheduled for {scheduledDateTimeText(item.scheduledAt)}
        </p>
      )}

      {status === 'published' && item.warnings && item.warnings.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-amber-800">
          {item.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      {status === 'failed' && item.error && (
        <div className="mt-2 flex items-start gap-2 pl-6">
          <p className="min-w-0 flex-1 text-xs text-red-700">{item.error}</p>
          <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={onRetry}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}
    </li>
  );
}
