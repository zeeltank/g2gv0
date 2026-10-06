'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderTree,
  Loader2,
  Search,
  Sparkles,
  Tags,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

import { PageFrame, PageHeader, InlineMessage } from './idms-layout';
import { Button } from '@/components/ui/button';
import { sanitizeSnippet as sanitizeHtml } from '../_lib/sanitize-snippet';
import { DocumentDetailPanel } from './document-detail-panel';
import { UploadReviewModal } from './upload-review-modal';
import { TrashDialog } from './trash-dialog';
import {
  IdmsApi,
  type BrowseTreeItem,
  type DocumentItem,
  type TagCloudItem,
} from '../_lib/idms-api';

/**
 * The IDMS Library — the module's landing screen.
 *
 * WHY THIS FILE IS MOUNTED AT /documents_new. The aggregation dashboard that
 * lived at /documents (DocumentsDashboard, reading counts out of tables other
 * modules own) is unchanged and still mounted, along with /documents/[source]
 * which its domain cards link to. IDMS was given its own path rather than
 * displacing that screen, so no existing bookmark or menu entry breaks.
 *
 * FILTERS ARE SERVER-SIDE ON PURPOSE. Every list call carries the chips as
 * query parameters and DocumentSearchService folds the permission scope into
 * the same WHERE clause, so a restricted document cannot leak through a count,
 * a tree number or a snippet that was fetched first and filtered after.
 */

type LibraryTab = 'library' | 'audit';

/** The structured filters a chip can carry. Keys are search-service params. */
interface ActiveFilters {
  department_id: string;
  document_type: string;
  academic_year: string;
  tag: string;
}

const EMPTY_FILTERS: ActiveFilters = {
  department_id: '',
  document_type: '',
  academic_year: '',
  tag: '',
};

/** One row of document_history, as the audit tab needs it. */
interface AuditRow {
  id?: number;
  action?: string;
  document_id?: number | null;
  user_id?: number | null;
  created_at?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  processing: 'bg-amber-50 text-amber-700',
  ready_for_review: 'bg-indigo-50 text-indigo-700',
  done: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Extension without the dot, for the small type chip on each result row. */
function fileKind(doc: DocumentItem): string {
  const name = doc.original_file_name || '';
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toUpperCase() : 'FILE';
}

function TreeNode({
  item,
  filters,
  onPick,
}: {
  item: BrowseTreeItem;
  filters: ActiveFilters;
  onPick: (next: Partial<ActiveFilters>) => void;
}) {
  const [open, setOpen] = useState(true);
  const active = filters.department_id === String(item.id);

  return (
    <li>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${item.name}`}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onPick({ department_id: active ? '' : String(item.id) })}
          className={`flex flex-1 items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs ${
            active ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="truncate">{item.name}</span>
          <span className="tabular-nums text-slate-400">{item.count}</span>
        </button>
      </div>

      {open && item.types.length > 0 && (
        <ul className="mt-0.5 space-y-0.5 border-l border-slate-200 pl-4">
          {item.types.map((type) => {
            const typeActive = active && filters.document_type === type.name;
            return (
              <li key={type.name}>
                <button
                  type="button"
                  onClick={() =>
                    onPick({
                      department_id: typeActive ? '' : String(item.id),
                      document_type: typeActive ? '' : type.name,
                    })
                  }
                  className={`flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs ${
                    typeActive ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{type.name}</span>
                  <span className="tabular-nums text-slate-400">{type.count}</span>
                </button>

                {type.years.map((year) => {
                  const yearActive = typeActive && filters.academic_year === year.year;
                  return (
                    <button
                      key={year.year}
                      type="button"
                      onClick={() =>
                        onPick({
                          department_id: yearActive ? '' : String(item.id),
                          document_type: yearActive ? '' : type.name,
                          academic_year: yearActive ? '' : year.year,
                        })
                      }
                      className={`ml-2 flex w-[calc(100%-0.5rem)] items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs ${
                        yearActive
                          ? 'bg-indigo-50 font-semibold text-indigo-700'
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{year.year}</span>
                      <span className="tabular-nums text-slate-400">{year.count}</span>
                    </button>
                  );
                })}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function IdmsLibrary() {
  const [tab, setTab] = useState<LibraryTab>('library');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [chips, setChips] = useState<Array<{ field: string; label: string; value: string }>>([]);

  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [tree, setTree] = useState<BrowseTreeItem[]>([]);
  const [tagCloud, setTagCloud] = useState<TagCloudItem[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [selected, setSelected] = useState<DocumentItem | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await IdmsApi.listDocuments({
        q: query.trim(),
        department_id: filters.department_id,
        document_type: filters.document_type,
        academic_year: filters.academic_year,
        tag: filters.tag,
        per_page: 25,
      });
      setDocs(result.data ?? []);
      setPagination(result.pagination ?? { current_page: 1, last_page: 1, total: 0 });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't load documents.");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [query, filters]);

  /*
   * The tree and the tag cloud are navigation, not results, so they load once
   * on mount and are not refetched when a filter changes. Refetching them after
   * every search would make the sidebar numbers move under the user's cursor
   * and imply the tree describes the current result set, which it does not.
   */
  useEffect(() => {
    IdmsApi.getBrowseTree()
      .then((result) => setTree(result.data ?? []))
      .catch(() => setTree([]));
    IdmsApi.getTags()
      .then((result) => setTagCloud(result.data ?? []))
      .catch(() => setTagCloud([]));
  }, []);

  /*
   * loadDocuments flips the loading flag before it awaits. That is the point of
   * an effect-driven fetch, and it is why the rule below is switched off here.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (tab !== 'audit') return;
    void IdmsApi.getAuditLogs()
      .then((result) => setAuditRows(result.data ?? []))
      .catch(() => setAuditRows([]));
  }, [tab]);

  /**
   * Parse the sentence into filters, then run the search with them.
   *
   * The parse and the search are two calls on purpose: /search/parse is what
   * fills the chip row, and /documents is what returns rows. A chip the user
   * then removes has to be able to change the second call without re-running
   * the first, which is only true if the parsed result is state and not a
   * side effect of searching.
   */
  const runSearch = useCallback(async () => {
    const text = query.trim();
    if (!text) {
      setChips([]);
      return;
    }
    setParsing(true);
    try {
      const parsed = await IdmsApi.parseSearch(text);
      const data = parsed.data;
      setChips(data.chips ?? []);

      const next: ActiveFilters = { ...EMPTY_FILTERS };
      Object.entries(data.filters ?? {}).forEach(([key, value]) => {
        if (key in next && value) next[key as keyof ActiveFilters] = String(value);
      });
      setFilters(next);
    } catch {
      /*
       * A parse failure must not block the search. Plain terms still match the
       * full-text index, so fall through with no chips rather than showing an
       * error for a query the user can legitimately run.
       */
      setChips([]);
      setFilters(EMPTY_FILTERS);
    } finally {
      setParsing(false);
    }
  }, [query]);

  const removeChip = useCallback((field: string) => {
    setChips((current) => current.filter((chip) => chip.field !== field));
    setFilters((current) => {
      if (!(field in current)) return current;
      return { ...current, [field]: '' };
    });
  }, []);

  const clearAll = useCallback(() => {
    setQuery('');
    setChips([]);
    setFilters(EMPTY_FILTERS);
  }, []);

  const activeFilters = useMemo(
    () => (Object.keys(filters) as Array<keyof ActiveFilters>).filter((key) => filters[key]),
    [filters],
  );

  const pickFilters = useCallback((next: Partial<ActiveFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setChips([]);
  }, []);

  return (
    <PageFrame>
      <PageHeader
        title="Document Library"
        description="Upload once and the system reads, classifies, tags and files it. Search by name, tag, metadata or plain English."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTrashOpen(true)}>
              <Trash2 className="mr-2 size-4" />
              Trash
            </Button>
            <Button onClick={() => setUploadOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <UploadCloud className="mr-2 size-4" />
              Upload documents
            </Button>
          </div>
        }
      />

      {error && <InlineMessage type="error" text={error} />}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void runSearch();
              }}
              placeholder="Find all computer lab maintenance contracts for 2026"
              aria-label="Search documents"
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <Button
            onClick={() => void runSearch()}
            disabled={parsing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {parsing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Search
          </Button>
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
              <Sparkles className="size-3.5" />
              Understood as
            </span>
            {chips.map((chip) => (
              <span
                key={`${chip.field}-${chip.value}`}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
              >
                {chip.label}: {chip.value}
                <button
                  type="button"
                  onClick={() => removeChip(chip.field)}
                  aria-label={`Remove ${chip.label} filter`}
                  className="rounded-full p-0.5 hover:bg-indigo-100"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="flex gap-1 border-b border-slate-200">
        {(['library', 'audit'] as LibraryTab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === value
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {value === 'library' ? 'Library' : 'Activity'}
          </button>
        ))}
      </div>

      {tab === 'library' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <FolderTree className="size-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-950">Browse</h2>
              </div>
              <div className="p-2">
                {tree.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-slate-500">Nothing filed yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {tree.map((item) => (
                      <TreeNode key={item.id} item={item} filters={filters} onPick={pickFilters} />
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <Tags className="size-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-950">Tags</h2>
              </div>
              <div className="flex flex-wrap gap-1.5 p-3">
                {tagCloud.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-slate-500">No tags yet.</p>
                ) : (
                  tagCloud.map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => pickFilters({ tag: filters.tag === tag.name ? '' : tag.name })}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        filters.tag === tag.name
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tag.name} <span className="tabular-nums opacity-70">{tag.count}</span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600">
                <span className="font-bold tabular-nums text-slate-950">{pagination.total}</span> documents
                {activeFilters.length > 0 && ' matching the selected filters'}
              </p>
              {activeFilters.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-slate-400" />
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <FileText className="size-8 text-slate-300" />
                <p className="text-sm text-slate-600">
                  {query.trim() || activeFilters.length > 0
                    ? 'No documents match. Try fewer words, or clear a filter.'
                    : 'No documents yet. Upload one and the system will file it for you.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {docs.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(doc)}
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                          {fileKind(doc)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{doc.title}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{doc.original_file_name}</p>

                          {/*
                            The snippet arrives as HTML: the search service wraps the matched
                            run in <mark> and has already htmlspecialchars()d everything around
                            it. Rendered as a plain string the user would read the tags, so it
                            goes through the app's sanitiser first — <mark> survives, anything
                            else does not.
                          */}
                          {doc.snippet && (
                            <p
                              className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-600"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.snippet) }}
                            />
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {doc.document_type && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                {doc.document_type}
                              </span>
                            )}
                            {doc.department_name && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                {doc.department_name}
                              </span>
                            )}
                            {doc.academic_year && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                {doc.academic_year}
                              </span>
                            )}
                            {doc.tag_names?.slice(0, 4).map((tag) => (
                              <span key={tag} className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                                {tag}
                              </span>
                            ))}
                            {/*
                              Guarded rather than trusted: the column is NOT NULL in the
                              database, but the search service selects an explicit column
                              list, and a column missing from that list comes back as null
                              rather than absent. That reached this render as a hard crash
                              on the whole page, so a missing status degrades to a plain
                              label instead of taking the library down with it.
                            */}
                            {doc.processing_status !== 'done' && (
                              <span
                                className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                                  STATUS_STYLE[doc.processing_status ?? 'pending'] ?? STATUS_STYLE.pending
                                }`}
                              >
                                {(doc.processing_status ?? 'pending').replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 text-[11px] text-slate-400">
                            {formatSize(doc.size)} · {formatDate(doc.created_at)} · v{doc.current_version}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {pagination.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
                <span>
                  Page {pagination.current_page} of {pagination.last_page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => void loadDocuments()}
                >
                  Next page
                </Button>
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-950">Recent activity</h2>
            <p className="mt-1 text-xs text-slate-600">
              Every upload, view, download, tag change and permission change, newest first.
            </p>
          </div>
          {auditRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {auditRows.map((row, index) => (
                <li key={row.id ?? index} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {row.action}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                    {row.document_id ? `Document #${row.document_id}` : '—'}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{formatDate(row.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <TrashDialog isOpen={trashOpen} onClose={() => setTrashOpen(false)} onRestored={() => void loadDocuments()} />

      <UploadReviewModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDocumentConfirmed={(doc, { total }) => {
          // Only open the detail panel for a single upload; a batch would keep stealing focus.
          if (total === 1) setSelected(doc);
          void loadDocuments();
        }}
      />

      {/*
        Keyed on the document id on purpose: the panel keeps per-tab state
        (versions, related, audit) and remounting on a new document discards it,
        which is why it has no reset effect of its own.
      */}
      <DocumentDetailPanel
        key={selected?.id ?? 'no-document'}
        document={selected}
        onClose={() => setSelected(null)}
        onRefresh={() => {
          void loadDocuments();
          setSelected(null);
        }}
      />
    </PageFrame>
  );
}

export default IdmsLibrary;
