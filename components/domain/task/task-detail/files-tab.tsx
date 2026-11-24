'use client'

import { Download, Paperclip } from 'lucide-react'
import { taskService } from '@/services/task'
import { getLaravelContext } from '@/lib/laravel-context'
import type { MyTask } from '@/types/task-management'
import { TaskDocumentsPanel } from '../task-documents-panel'

/** The file the task was assigned with, and the reference documents attached to it. */
export function FilesTab({ task }: { task: MyTask }) {
  const { attachment } = task
  return (
    <div className="space-y-4 pt-3">
      {attachment && (
        <section aria-label="Attachment">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
            <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{attachment.name}</span>
              {(attachment.type || attachment.size) && (
                <span className="block text-xs tabular-nums text-muted-foreground">
                  {[attachment.type, attachment.size ? `${attachment.size} bytes` : null].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>

            {/* DOWNLOAD ONLY WHEN THE FILE IS ACTUALLY REACHABLE.
                `task.task_attachment` holds a bare filename, and the bytes sit in
                one of two stores depending on which path uploaded them - so the
                server tells us whether a version record with a real path exists.
                Without that flag this would be a link that 404s, which is worse
                than plain text. */}
            {attachment.download_version !== null ? (
              <a
                href={taskService.taskAttachmentDownloadUrl(getLaravelContext(), task.id, attachment.download_version)}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={`Download ${attachment.name}`}
              >
                <Download className="size-4" />
              </a>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">Ask your manager for a copy</span>
            )}
          </div>
        </section>
      )}

      <section aria-label="Documents">
        <h3 className="mb-2 text-sm font-semibold">Documents</h3>
        <TaskDocumentsPanel taskId={Number(task.id)} compact />
      </section>
    </div>
  )
}
