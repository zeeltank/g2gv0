'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Download, Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/settings/sections/section-primitives'
import { DocumentViewer } from '@/components/shared/business/document-viewer'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { accountService, type AccountDocument, type DocumentTypeChoices } from '@/services/account'

/**
 * An employee's documents, as HR sees them.
 *
 * ── WHAT THIS REPLACES, AND WHY ─────────────────────────────────────────────
 *
 * This tab used to build its own download link in the browser:
 *
 *   https://s3-triz.fra1.digitaloceanspaces.com/public/hp_staff_document/{file}
 *
 * with the host hardcoded, against objects that the self-service upload path
 * deliberately writes PRIVATE. Every document an employee filed from My Profile
 * was therefore un-downloadable here — AccessDenied, an XML error page in a new
 * tab. Whether a download worked depended on which of two screens had filed it,
 * because the two upload paths wrote the same folder with opposite visibility.
 *
 * It also read its list from a different query than the employee's own screen —
 * an INNER join with no soft-delete filter — so HR and the employee could see
 * different documents for the same person, and did: payslips whose type row
 * does not exist vanished for HR, and a document the employee deleted stayed
 * here for ever.
 *
 * Now it uses the same endpoints the employee's own screen uses. One reader,
 * one rule, and the bytes come through the application after the same
 * permission check that produced the list.
 */
interface UploadDocTabProps {
  employee: any
  /** Kept for callers that still pass it; the list is fetched here now. */
  documentTypes?: any[]
  documentLists?: any[]
  onUpload?: (formData: FormData) => Promise<void> | void
}

export function UploadDocTab({ employee }: UploadDocTabProps) {
  const { user } = useAuth()

  const employeeId = Number(employee?.id ?? 0)

  const [rows, setRows] = useState<AccountDocument[]>([])
  const [types, setTypes] = useState<DocumentTypeChoices>({ personnel: {}, organization: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [documentType, setDocumentType] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const [viewing, setViewing] = useState<AccountDocument | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AccountDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!user || !employeeId) return
    setLoading(true)
    setError(null)
    try {
      const response = await accountService.employeeDocuments(getLaravelContext(user), employeeId)
      setRows(response.data ?? [])
      setTypes(response.document_types ?? { personnel: {}, organization: {} })
    } catch (caught) {
      /*
       * A failed fetch is never rendered as "no documents". The two are
       * indistinguishable in an empty table, and only one of them is a fact
       * about the employee.
       */
      setRows([])
      setError(caught instanceof Error ? caught.message : 'Could not load this employee’s documents.')
    } finally {
      setLoading(false)
    }
  }, [user, employeeId])

  useEffect(() => {
    void load()
  }, [load])

  const upload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file || !title.trim() || !documentType || !employeeId) return

    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      // `document`, matching the self-service endpoint. The legacy route
      // accepted `file` and this form sent that name, which is a mismatch that
      // has bitten this table before.
      body.append('document', file)
      body.append('title', title.trim())
      body.append('document_type', documentType)
      body.append('category', 'personnel')

      await accountService.uploadEmployeeDocument(employeeId, body)

      setFile(null)
      setTitle('')
      setDocumentType('')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That document could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  /** The bytes, with the token in a header rather than in the URL. */
  const download = async (row: AccountDocument) => {
    setDownloadingId(row.id)
    setError(null)
    try {
      const blob = await accountService.fetchDocument(row.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = row.original_file_name || row.title || 'document'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That document could not be downloaded.')
    } finally {
      setDownloadingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete || !user) return
    setDeleting(true)
    try {
      await accountService.deleteEmployeeDocument(getLaravelContext(user), employeeId, pendingDelete.id)
      setPendingDelete(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That document could not be removed.')
    } finally {
      setDeleting(false)
    }
  }

  const canUpload = Boolean(file && title.trim() && documentType) && !uploading

  const typeOptions = Object.entries(types.personnel).map(([value, label]) => ({ value, label }))
  const typeLabel = (key: string | null) => (key ? (types.personnel[key] ?? types.organization[key] ?? key) : null)

  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto pb-16 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="rounded-xl border bg-surface p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Upload New Document</h3>

        <form onSubmit={upload} className="space-y-6">
          <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="doc-type">Document Type</Label>
              <Select
                id="doc-type"
                value={documentType}
                onChange={setDocumentType}
                options={typeOptions}
                placeholder={typeOptions.length === 0 ? 'No document types configured' : 'Select a type'}
                disabled={uploading || typeOptions.length === 0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What is this document?"
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-file">File</Label>
              <Input
                id="doc-file"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={uploading}
              />
            </div>
          </div>

          {/*
            Say why rather than showing a dead button. An empty type list means
            the organisation has configured none, and the upload cannot succeed
            until somebody does - which is not something the person at this
            screen can guess from a greyed-out control.
          */}
          {typeOptions.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              No staff document types are configured yet, so nothing can be filed. Add them under
              document type settings first.
            </p>
          )}

          <Button type="submit" disabled={!canUpload}>
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </form>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-surface shadow-sm">
        <div className="border-b p-4">
          <h3 className="text-lg font-semibold text-foreground">Documents on file</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Nothing filed yet. Documents this employee uploads themselves appear here too.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {/*
                    An em dash rather than blank: the type comes through a LEFT
                    join, so it is null where the row points at a type that no
                    longer exists - eight live rows do. Blank would read as a
                    rendering fault.
                  */}
                  <TableCell>{typeLabel(row.document_type) || '—'}</TableCell>
                  <TableCell className="font-medium">{row.title || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewing(row)}
                        aria-label={`View ${row.title ?? 'document'}`}
                      >
                        <Eye className="mr-1 size-4" />
                        View
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={downloadingId !== null}
                        onClick={() => download(row)}
                        aria-label={`Download ${row.title ?? 'document'}`}
                      >
                        {downloadingId === row.id ? (
                          <Loader2 className="mr-1 size-4 animate-spin" />
                        ) : (
                          <Download className="mr-1 size-4" />
                        )}
                        Download
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setPendingDelete(row)}
                        aria-label={`Remove ${row.title ?? 'document'}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DocumentViewer
        open={viewing !== null}
        onOpenChange={(next) => !next && setViewing(null)}
        documentId={viewing?.id ?? null}
        title={viewing?.title ?? ''}
        mimeType={viewing?.mime_type}
        fileName={viewing?.original_file_name}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next: boolean) => {
          if (!next) setPendingDelete(null)
        }}
        title="Remove this document?"
        description={`"${pendingDelete?.title ?? 'This document'}" will no longer appear on this employee's record, or on their own.`}
        confirmLabel="Remove it"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
