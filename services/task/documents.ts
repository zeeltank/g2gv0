/**
 * Reference documents on a task — the material needed to actually do it.
 *
 * Distinct from the task ATTACHMENT (`task.task_attachment` and its versions):
 * the attachment is the work, these are what you need to do the work.
 *
 * Reading follows task ownership — assignee, assigner, or admin/HR — so this is
 * token-authenticated rather than admin-only. Uploading and deleting are gated
 * to admin/HR on the server; `can_upload` in the response says which the caller
 * is, so a screen never renders a button that will be refused.
 */

import { apiClient, buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface TaskDocument {
  id: number
  /** What the document IS, in the uploader's words — not the filename. */
  title: string
  document_type: string | null
  document_type_label: string | null
  file_name: string
  mime_type: string | null
  /** Bytes. Formatted for display by `formatFileSize`. */
  file_size: number | null
  uploaded_by: number | null
  uploaded_by_name: string | null
  created_at: string | null
}

interface ListResponse {
  status: number
  data: TaskDocument[]
  types: Record<string, string>
  /** False for an employee — read and download only. */
  can_upload: boolean
  empty_is_expected: boolean
  empty_reason: string
}

export const taskDocumentsService = {
  list: (context: LaravelContext, taskId: number) =>
    apiClient.get<ListResponse>(
      `/task-management/tasks/${taskId}/documents`,
      withLaravelParams(context),
    ),

  /**
   * FormData, with the auth params in the QUERY STRING.
   *
   * The body has to stay pure multipart, which is the same choice
   * `saveDepartmentSop` and the performance uploader make.
   */
  upload: (
    context: LaravelContext,
    taskId: number,
    file: File,
    meta: { title?: string; document_type?: string } = {},
  ) => {
    const body = new FormData()
    body.append('document', file)
    if (meta.title) body.append('title', meta.title)
    if (meta.document_type) body.append('document_type', meta.document_type)

    const query = new URLSearchParams(withLaravelParams(context) as Record<string, string>)

    return apiClient.postForm<{ status: number; message: string; data: { id: number } }>(
      `/task-management/tasks/${taskId}/documents?${query.toString()}`,
      body,
    )
  },

  remove: (context: LaravelContext, taskId: number, id: number) =>
    apiClient.delete<{ status: number; message: string }>(
      `/task-management/tasks/${taskId}/documents/${id}`,
      withLaravelParams(context),
    ),

  /**
   * A URL the browser navigates to, so the download is performed by the
   * browser and lands in Downloads with the right filename.
   *
   * Built with `buildApiUrl` rather than by concatenating a storage host — a
   * hardcoded CDN origin in the bundle breaks the moment storage moves.
   */
  downloadUrl: (context: LaravelContext, taskId: number, id: number) =>
    buildApiUrl(`/task-management/tasks/${taskId}/documents/${id}/download`,
      withLaravelParams(context) as Record<string, string>),
}

/** Bytes to something a person reads. The server sends a raw byte count. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
