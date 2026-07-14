'use client'

import { AlertTriangle } from 'lucide-react'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ComplianceForm, type ComplianceFormState, type ComplianceRecord } from './compliance-library-management-shared'

interface ComplianceDialogsProps {
  editingRecord: ComplianceRecord | null
  editForm: ComplianceFormState
  editUploadKey: number
  onEditChange: (next: Partial<ComplianceFormState>) => void
  onEditSave: () => void
  onEditClose: () => void
  deleteRecord: ComplianceRecord | null
  onDeleteConfirm: () => void
  onDeleteClose: () => void
}

export function ComplianceDialogs({
  editingRecord,
  editForm,
  editUploadKey,
  onEditChange,
  onEditSave,
  onEditClose,
  deleteRecord,
  onDeleteConfirm,
  onDeleteClose,
}: ComplianceDialogsProps) {
  return (
    <>
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && onEditClose()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Compliance Record</DialogTitle>
            <DialogDescription>
              Update ownership, due date, frequency, and attachment details for this compliance item.
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <ComplianceForm
              form={editForm}
              onChange={onEditChange}
              onSubmit={onEditSave}
              submitLabel="Save Changes"
              uploadKey={editUploadKey}
              currentAttachment={editingRecord.attachmentName}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onEditClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRecord} onOpenChange={(open) => !open && onDeleteClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <AlertDialogTitle>Delete compliance record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove {deleteRecord?.name ? `"${deleteRecord.name}"` : 'this record'} from the compliance library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={onDeleteClose}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteConfirm}>
              <AlertTriangle className="size-4" />
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
