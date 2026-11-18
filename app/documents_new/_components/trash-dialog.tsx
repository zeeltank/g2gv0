'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdmsApi, type DocumentItem } from '../_lib/idms-api';

interface TrashDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a document is restored so the library can reload its list. */
  onRestored: () => void;
}

function daysLeft(purgeAt: string | null | undefined): number | null {
  if (!purgeAt) return null;
  const ms = new Date(purgeAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function TrashDialog({ isOpen, onClose, onRestored }: TrashDialogProps) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmPurgeId, setConfirmPurgeId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await IdmsApi.listTrash();
      setDocs(res.data ?? []);
      if (res.retention_days) setRetentionDays(res.retention_days);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(
        message.includes('404')
          ? 'Trash is not available on this server yet. The backend update that adds it has not been deployed.'
          : message || "Couldn't load the trash.",
      );
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null;

  const restore = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await IdmsApi.restoreDocument(id);
      setDocs((cur) => cur.filter((d) => d.id !== id));
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore the document.');
    } finally {
      setBusyId(null);
    }
  };

  const purge = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await IdmsApi.purgeDocument(id);
      setDocs((cur) => cur.filter((d) => d.id !== id));
      setConfirmPurgeId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the document.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900">Trash</h2>
        <p className="mt-1 text-sm text-slate-500">
          Deleted documents stay here for {retentionDays} days. You can restore them until then; after that they are
          deleted permanently.
        </p>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : docs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Trash is empty.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {docs.map((d) => {
                const left = daysLeft(d.purge_at);
                const busy = busyId === d.id;
                return (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{d.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {d.original_file_name}
                        {d.deleted_at ? ` · deleted ${new Date(d.deleted_at).toLocaleDateString()}` : ''}
                        {left !== null ? ` · ${left} ${left === 1 ? 'day' : 'days'} left` : ''}
                      </p>
                    </div>
                    {confirmPurgeId === d.id ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-xs text-red-700">Delete forever?</span>
                        <Button size="sm" variant="ghost" className="text-xs" disabled={busy} onClick={() => setConfirmPurgeId(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" className="bg-red-600 text-xs text-white hover:bg-red-700" disabled={busy} onClick={() => purge(d.id)}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Delete'}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button size="sm" variant="outline" className="text-xs" disabled={busy} onClick={() => restore(d.id)}>
                          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={busy}
                          onClick={() => setConfirmPurgeId(d.id)}
                          aria-label={`Delete ${d.title} forever`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
