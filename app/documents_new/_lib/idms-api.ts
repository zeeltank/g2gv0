'use client';

import { resolveApiBaseUrl } from '@/lib/api-config';
import { readLaravelSession } from '@/lib/laravel-session';

interface SessionContext {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  userId: string;
}

/**
 * Same session the rest of this app uses (`userData`, written at login). The
 * tenant is sent only as a courtesy for upload; the backend resolves the caller
 * and tenant from the verified token and ignores anything a client says about it.
 */
function buildSessionContext(): SessionContext {
  const session = readLaravelSession();
  return {
    baseUrl: resolveApiBaseUrl().replace(/\/api\/?$/, ''),
    token: session?.token ?? '',
    subInstituteId: session?.sub_institute_id != null ? String(session.sub_institute_id) : '',
    userId: session?.user_id != null ? String(session.user_id) : '',
  };
}

function createAuthHeaders(session: SessionContext): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}

export interface DocumentPermission {
  type: 'user' | 'role' | 'department';
  id: number;
  view: boolean;
  edit: boolean;
  download: boolean;
  share: boolean;
}

/** A pipeline warning. The pipeline emits bare strings today; objects are accepted too. */
export type DocumentWarning = string | { type?: string; message?: string };

export interface DocumentTag {
  name: string;
  source: 'ai' | 'user';
  status: 'accepted' | 'suggested' | 'rejected';
}

export interface DocumentPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** One document_history row of entry_type = version. */
export interface DocumentVersion {
  id: number;
  version_number: number;
  storage_path?: string | null;
  checksum_sha256?: string | null;
  size?: number | null;
  change_note?: string | null;
  user_id?: number | null;
  created_at?: string | null;
}

/** One document_history row of entry_type = audit. */
export interface AuditEntry {
  id: number;
  action: string;
  document_id?: number | null;
  user_id?: number | null;
  ip_address?: string | null;
  details?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface DocumentItem {
  id: number;
  title: string;
  original_file_name: string;
  mime_type: string;
  size: number;
  current_version: number;
  document_type: string | null;
  category: string | null;
  department_id: number | null;
  department_name: string | null;
  subject: string | null;
  document_date: string | null;
  academic_year: string | null;
  organization: string | null;
  project: string | null;
  lifecycle_status: 'active' | 'expired' | 'archived' | 'filed';
  summary: string | null;
  confidence: number | null;
  people: string[];
  keywords: string[];
  tags: DocumentTag[];
  tag_names: string[];
  owner_id: number;
  owner_name: string | null;
  visibility: 'private' | 'department' | 'organization';
  permissions: DocumentPermission[];
  /**
   * The pipeline status.
   *
   * Typed nullable on purpose even though the column is NOT NULL: the search
   * service selects an explicit column list, and a column left out of it is
   * returned as null rather than omitted. Callers must treat this as possibly
   * absent instead of assuming the model always populated it.
   */
  processing_status: 'pending' | 'processing' | 'ready_for_review' | 'done' | 'failed' | null;
  processing_error: string | null;
  warnings: DocumentWarning[];
  logical_location: {
    root: string;
    department: string;
    document_type: string;
    academic_year: string;
    subject: string;
    path: string;
  };
  snippet?: string;
  /** Set only for documents in the trash; purge_at is when they are deleted for good. */
  deleted_at?: string | null;
  purge_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchParseResult {
  raw_query: string;
  keywords: string;
  filters: Record<string, string>;
  chips: Array<{ field: string; label: string; value: string }>;
}

export interface BrowseTreeItem {
  id: number;
  name: string;
  count: number;
  types: Array<{
    name: string;
    count: number;
    years: Array<{ year: string; count: number }>;
  }>;
}

export interface TagCloudItem {
  name: string;
  count: number;
}

async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = buildSessionContext();
  const base = session.baseUrl || '';

  const headers = {
    ...createAuthHeaders(session),
    ...(options.headers || {}),
  };

  const response = await fetch(`${base}/api/v1${path}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.status === 0) {
    throw new Error(json.message || `Request failed with code ${response.status}`);
  }
  return json as T;
}

export const IdmsApi = {
  async listDocuments(params: Record<string, string | number | undefined> = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    return requestApi<{ status: number; data: DocumentItem[]; pagination: DocumentPagination }>(`/documents?${q.toString()}`);
  },

  async uploadDocument(file: File, visibility: string = 'organization') {
    const session = buildSessionContext();
    const base = session.baseUrl || '';
    const form = new FormData();
    form.append('file', file);
    form.append('visibility', visibility);
    if (session.subInstituteId) form.append('sub_institute_id', session.subInstituteId);
    if (session.userId) form.append('user_id', session.userId);

    const headers: Record<string, string> = {};
    if (session.token) headers['Authorization'] = `Bearer ${session.token}`;

    let res: Response;
    try {
      res = await fetch(`${base}/api/v1/documents`, {
        method: 'POST',
        body: form,
        headers,
      });
    } catch {
      throw new Error('the server could not be reached. Check your connection and try again');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === 0) {
      if (json.message) throw new Error(json.message);
      const byStatus: Record<number, string> = {
        401: 'your session has expired. Sign in again',
        403: 'you do not have permission to upload documents',
        413: 'the file is larger than the server allows',
        415: 'the server does not accept this file type',
        422: 'the server rejected the file',
        500: 'the server hit an error while saving the file',
        502: 'the server is temporarily unavailable',
        503: 'the server is temporarily unavailable',
      };
      throw new Error(byStatus[res.status] ?? `the server refused the upload (code ${res.status})`);
    }
    return json;
  },

  async getDocument(id: number) {
    return requestApi<{ status: number; data: DocumentItem }>(`/documents/${id}`);
  },

  async confirmDocument(id: number, edits: Partial<DocumentItem>) {
    return requestApi<{ status: number; data: DocumentItem }>(`/documents/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edits),
    });
  },

  /** Soft delete: the backend moves the document to trash and writes an audit entry. */
  async deleteDocument(id: number) {
    return requestApi<{ status: number; message: string }>(`/documents/${id}`, { method: 'DELETE' });
  },

  async listTrash() {
    return requestApi<{ status: number; retention_days: number; data: DocumentItem[] }>(`/trash/documents`);
  },

  async restoreDocument(id: number) {
    return requestApi<{ status: number; message: string; data: DocumentItem }>(`/trash/documents/${id}/restore`, {
      method: 'POST',
    });
  },

  /** Permanent. Only works on a document that is already in the trash. */
  async purgeDocument(id: number) {
    return requestApi<{ status: number; message: string }>(`/trash/documents/${id}`, { method: 'DELETE' });
  },

  async updateTags(id: number, tags: DocumentTag[]) {
    return requestApi<{ status: number; tags: DocumentTag[] }>(`/documents/${id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
  },

  async parseSearch(query: string) {
    return requestApi<{ status: number; data: SearchParseResult }>(`/search/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
  },

  async getBrowseTree() {
    return requestApi<{ status: number; data: BrowseTreeItem[] }>(`/browse/tree`);
  },

  async getTags() {
    return requestApi<{ status: number; data: TagCloudItem[] }>(`/tags`);
  },

  async getPreviewUrl(id: number) {
    return requestApi<{ status: number; preview_url: string; mime_type: string }>(`/documents/${id}/preview`);
  },

  async getDownloadUrl(id: number) {
    return requestApi<{ status: number; download_url: string; file_name: string }>(`/documents/${id}/download`);
  },

  async getVersions(id: number) {
    return requestApi<{ status: number; versions: DocumentVersion[] }>(`/documents/${id}/versions`);
  },

  /**
   * Upload a new version of an existing document.
   *
   * FormData is sent without a Content-Type header on purpose: the browser must
   * set it itself, because the multipart boundary is part of the header value
   * and a hand-written one produces a body Laravel cannot parse.
   */
  async addVersion(id: number, file: File, changeNote: string) {
    const session = buildSessionContext();
    const form = new FormData();
    form.append('file', file);
    if (changeNote) form.append('change_note', changeNote);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (session.token) headers.Authorization = `Bearer ${session.token}`;

    const res = await fetch(`${session.baseUrl || ''}/api/v1/documents/${id}/versions`, {
      method: 'POST',
      body: form,
      headers,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === 0) throw new Error(json.message || 'Could not add the version.');
    return json as { status: number; message: string; data: DocumentItem };
  },

  async restoreVersion(id: number, versionNumber: number) {
    return requestApi<{ status: number; message: string }>(`/documents/${id}/versions/${versionNumber}/restore`, {
      method: 'POST',
    });
  },

  async getRelated(id: number) {
    return requestApi<{ status: number; related: DocumentItem[] }>(`/documents/${id}/related`);
  },

  async getAuditLogs(documentId?: number) {
    const q = documentId ? `?document_id=${documentId}` : '';
    return requestApi<{ status: number; data: AuditEntry[]; pagination: DocumentPagination }>(`/audit${q}`);
  },
};
