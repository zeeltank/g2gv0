'use client';

/**
 * A report built from a module's AI Stack: read it, edit it, refresh its figures, print it,
 * share its link. G2G's port of LMS_K12's `/ai-reports/[id]` page.
 *
 * Same behaviour, same safety: the document is admin-editable HTML, so it is shown inside
 * a sandboxed frame with scripts disallowed (`allow-same-origin` only so Print can reach
 * it) and is never injected into this app's DOM.
 *
 * NOT PORTED: "Send". LMS_K12 emails each person in a report their own figures, resolved
 * through its student/guardian recipient model. G2G's report rows have no equivalent
 * recipient model, so there is no Send button rather than one that could email the wrong
 * people. Everything else on the page is here.
 *
 * The `/ai` layout wraps this page, so it is administrator-only like the rest of the AI
 * API it calls.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, Link2, Loader2, Pencil, Printer, RefreshCw, Save, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TemplateHtmlEditor } from '@/components/ai-stack/adapters/template-html-editor';
import { describeAiError } from '@/lib/intelligence/client';
import { getAiReport, regenerateAiReport, saveAiReport, type AiReport } from '@/lib/intelligence/ai-reports';

const FRAME_STYLES = `
  @page { margin: 16mm; }
  html { background: #fff; }
  body {
    margin: 0; padding: 24px;
    font: 14px/1.6 Inter, "Segoe UI", system-ui, sans-serif;
    color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h2 { margin: 0 0 8px; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  small { color: #64748b; }
  @media print { body { padding: 0; } }
`;

function frameDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Report</title><style>${FRAME_STYLES}</style></head><body>${html}</body></html>`;
}

function formatMoment(iso: string): string {
  const parsed = new Date(iso.replace(' ', 'T'));

  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InlineMessage({ type, text }: { type: 'error' | 'success'; text: string }) {
  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm ${
        type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      {text}
    </p>
  );
}

export default function AiReportPage() {
  const params = useParams<{ id: string }>();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const reportId = Number(params?.id);
  const malformedId = !Number.isInteger(reportId) || reportId <= 0;

  const [report, setReport] = useState<AiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'saving' | 'refreshing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftHtml, setDraftHtml] = useState('');

  useEffect(() => {
    if (malformedId) return;

    let cancelled = false;

    (async () => {
      try {
        const { report: loaded } = await getAiReport(reportId);
        if (cancelled) return;
        setReport(loaded);
        setDraftTitle(loaded.title);
        setDraftHtml(loaded.html);
        setError(null);
      } catch (caught) {
        if (!cancelled) setError(describeAiError(caught, 'This report could not be opened.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reportId, malformedId]);

  const dirty = Boolean(report) && (draftTitle !== report?.title || draftHtml !== report?.html);

  const save = useCallback(async () => {
    if (!report) return;

    if (!draftTitle.trim()) {
      setError('A report needs a title.');
      return;
    }

    setBusy('saving');
    setError(null);
    setNotice(null);

    try {
      const { report: saved } = await saveAiReport(report.id, { title: draftTitle.trim(), html: draftHtml });
      setReport({ ...report, title: saved.title, html: draftHtml, figures: saved.figures });
      setDraftTitle(saved.title);
      setEditing(false);
      setNotice('Report saved.');
    } catch (caught) {
      setError(describeAiError(caught, 'The report could not be saved.'));
    } finally {
      setBusy(null);
    }
  }, [report, draftTitle, draftHtml]);

  const refresh = useCallback(async () => {
    if (!report) return;

    setBusy('refreshing');
    setError(null);
    setNotice(null);

    try {
      const result = await regenerateAiReport(report.id);
      setReport({ ...report, html: result.html });
      setDraftHtml(result.html);
      setNotice(`Figures refreshed — ${result.row_count} row${result.row_count === 1 ? '' : 's'} read from live ${result.module} records.`);
    } catch (caught) {
      setError(describeAiError(caught, 'The figures could not be refreshed.'));
    } finally {
      setBusy(null);
    }
  }, [report]);

  const print = useCallback(() => {
    const frame = frameRef.current?.contentWindow;

    if (!frame) {
      setError('The report could not be prepared for printing.');
      return;
    }

    frame.focus();
    frame.print();
  }, []);

  const copyLink = useCallback(async () => {
    setError(null);

    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Link copied. Anyone you send it to will need administrator access to this organisation.');
    } catch {
      setError('The link could not be copied. Copy it from the address bar instead.');
    }
  }, []);

  const cancel = useCallback(() => {
    if (dirty && !window.confirm('Discard the changes to this report?')) return;

    setDraftTitle(report?.title ?? '');
    setDraftHtml(report?.html ?? '');
    setEditing(false);
    setError(null);
  }, [dirty, report]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{report?.title || 'Report'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {report?.figures
              ? `Figures read from live ${report.figures.module} records via ${report.figures.source} · ${formatMoment(report.figures.generated_at)}`
              : 'Generated report'}
          </p>
        </div>

        {report ? (
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Button type="button" onClick={() => void save()} disabled={busy !== null || !dirty}>
                  {busy === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes
                </Button>
                <Button type="button" variant="outline" onClick={cancel} disabled={busy !== null}>
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refresh()}
                  disabled={busy !== null || !report.figures}
                  title="Re-read the live records. Anything written around the table is kept."
                >
                  {busy === 'refreshing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh figures
                </Button>
                <Button type="button" variant="outline" onClick={print}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyLink()}>
                  <Link2 className="h-4 w-4" />
                  Copy link
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {malformedId ? <InlineMessage type="error" text="That is not a valid report reference." /> : null}
      {error ? <InlineMessage type="error" text={error} /> : null}
      {notice ? <InlineMessage type="success" text={notice} /> : null}

      {loading && !malformedId ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening the report…
        </div>
      ) : null}

      {!loading && report ? (
        <div className="rounded-lg border border-border bg-card">
          {editing ? (
            <div className="space-y-4 p-4">
              <p className="text-sm text-muted-foreground">
                The figures were composed from real records. Refreshing replaces the table and keeps anything you write around it.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="ai-report-title">
                  Report title
                </label>
                <Input id="ai-report-title" value={draftTitle} maxLength={250} onChange={(event) => setDraftTitle(event.target.value)} />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">Document</span>
                <TemplateHtmlEditor value={draftHtml} onChange={setDraftHtml} tags={[]} disabled={busy !== null} />
              </div>
            </div>
          ) : (
            <div className="p-4">
              <iframe
                ref={frameRef}
                title={report.title || 'Report'}
                srcDoc={frameDocument(report.html)}
                sandbox="allow-same-origin allow-modals"
                className="h-[70vh] w-full rounded-md border border-slate-200 bg-white"
              />
            </div>
          )}
        </div>
      ) : null}

      {!loading && !report && !error && !malformedId ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Check className="h-4 w-4" />
          There is nothing to show for this report.
        </div>
      ) : null}
    </div>
  );
}
