'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Clock,
  History,
  X,
  Share2,
  ExternalLink,
  Layers,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdmsApi, type AuditEntry, type DocumentItem, type DocumentVersion } from '../_lib/idms-api';

interface DetailPanelProps {
  document: DocumentItem | null;
  onClose: () => void;
  onRefresh: () => void;
}

export function DocumentDetailPanel({ document, onClose, onRefresh }: DetailPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'versions' | 'related' | 'audit'>('details');
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [related, setRelated] = useState<DocumentItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);

  /*
   * Per-tab fetches. The panel is mounted with a `key` of the document id by
   * its parent, so switching documents remounts this component and every tab's
   * cached state starts empty. That is why there is no "reset on id change"
   * effect here: remounting already did it, and doing it again in an effect is
   * the cascading-render pattern React warns about.
   */
  useEffect(() => {
    if (!document) return;
    if (activeTab === 'versions') {
      IdmsApi.getVersions(document.id).then((res) => setVersions(res.versions || []));
    } else if (activeTab === 'related') {
      IdmsApi.getRelated(document.id).then((res) => setRelated(res.related || []));
    } else if (activeTab === 'audit') {
      IdmsApi.getAuditLogs(document.id).then((res) => setAuditLogs(res.data || []));
    }
  }, [activeTab, document]);

  if (!document) return null;

  const handleDownload = async () => {
    try {
      const res = await IdmsApi.getDownloadUrl(document.id);
      window.open(res.download_url, '_blank');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open the download.');
    }
  };

  const handlePreview = async () => {
    try {
      const res = await IdmsApi.getPreviewUrl(document.id);
      setPreviewUrl(res.preview_url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not build a preview.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await IdmsApi.deleteDocument(document.id);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete the document.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleAddVersion = async () => {
    if (!newVersionFile) return;
    setUploadingVersion(true);
    try {
      await IdmsApi.addVersion(document.id, newVersionFile, changeNote);
      setNewVersionFile(null);
      setChangeNote('');
      const v = await IdmsApi.getVersions(document.id);
      setVersions(v.versions || []);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not add the version.');
    } finally {
      setUploadingVersion(false);
    }
  };

  return (
    <div className="w-96 shrink-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 overflow-y-auto max-h-[85vh]">
      <div className="flex items-start justify-between">
        <div>
          <span className="inline-block rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            {document.document_type || 'Document'}
          </span>
          <h3 className="mt-1 font-bold text-slate-900 leading-tight">{document.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{document.original_file_name}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handlePreview}>
          <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
        </Button>
        <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs" onClick={handleDownload}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Download
        </Button>
      </div>

      {confirmDelete ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <p className="font-semibold">Delete this document?</p>
          <p className="mt-0.5">It moves to Trash and can be restored within 30 days, after which it is deleted permanently.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 text-xs" disabled={deleting} onClick={() => setConfirmDelete(false)}>
              Keep document
            </Button>
            <Button size="sm" className="flex-1 bg-red-600 text-xs text-white hover:bg-red-700" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Delete document'}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="w-full text-xs text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete document
        </Button>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-semibold text-slate-600">
        {(['details', 'versions', 'related', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-3 capitalize ${
              activeTab === tab ? 'border-b-2 border-indigo-600 text-indigo-600' : 'hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="space-y-3 text-xs">
          <div>
            <span className="font-semibold text-slate-500">Logical Location</span>
            <p className="mt-0.5 text-slate-800 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
              {document.logical_location.path}
            </p>
          </div>

          <div>
            <span className="font-semibold text-slate-500">Executive Summary</span>
            <p className="mt-0.5 text-slate-700 leading-relaxed bg-slate-50 p-2 rounded">
              {document.summary || 'No summary available.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-semibold text-slate-500">Department</span>
              <p className="text-slate-800 font-medium">{document.department_name || 'General'}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Academic Year</span>
              <p className="text-slate-800 font-medium">{document.academic_year || '-'}</p>
            </div>
          </div>

          <div>
            <span className="font-semibold text-slate-500">Tags</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {document.tags?.map((t, i) => (
                <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 text-slate-400">
            <span>Size: {(document.size / 1024).toFixed(1)} KB | Version: v{document.current_version}</span>
          </div>
        </div>
      )}

      {activeTab === 'versions' && (
        <div className="space-y-3 text-xs">
          <div className="rounded-lg border border-dashed border-slate-200 p-3 bg-slate-50">
            <span className="font-bold text-slate-800">Upload New Version</span>
            <input
              type="file"
              onChange={(e) => e.target.files && setNewVersionFile(e.target.files[0])}
              className="mt-2 block w-full text-xs"
            />
            <input
              type="text"
              placeholder="Version change notes..."
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              className="mt-2 w-full rounded border px-2 py-1 text-xs"
            />
            <Button
              size="sm"
              disabled={!newVersionFile || uploadingVersion}
              onClick={handleAddVersion}
              className="mt-2 w-full bg-slate-900 text-white text-xs"
            >
              Upload Version
            </Button>
          </div>

          <div className="space-y-2">
            {versions.map((v, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-slate-100 p-2 bg-white">
                <div>
                  <span className="font-bold text-slate-900">v{v.version_number}</span>
                  <p className="text-slate-500">{v.change_note || 'Update'}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-indigo-600"
                  onClick={async () => {
                    await IdmsApi.restoreVersion(document.id, v.version_number);
                    onRefresh();
                  }}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'related' && (
        <div className="space-y-2 text-xs">
          {related.length === 0 ? (
            <p className="text-slate-500">Nothing similar found yet.</p>
          ) : (
            related.map((item) => (
              <div key={item.id} className="rounded border border-slate-100 p-2 bg-white">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-slate-500">{item.original_file_name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.tag_names?.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-2 text-xs">
          {auditLogs.map((log, i) => (
            <div key={i} className="rounded border border-slate-100 p-2 bg-slate-50">
              <span className="font-semibold text-slate-800 capitalize">{log.action?.replace('_', ' ')}</span>
              <p className="text-slate-500 text-[11px]">
                {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal Iframe */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="relative h-[85vh] w-[80vw] rounded-xl bg-white p-4 shadow-2xl">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute right-4 top-4 rounded bg-slate-100 p-1 text-slate-600 hover:bg-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
            <iframe src={previewUrl} className="mt-6 h-[75vh] w-full rounded border border-slate-200" />
          </div>
        </div>
      )}
    </div>
  );
}
