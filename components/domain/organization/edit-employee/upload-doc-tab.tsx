'use client'

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileText, Loader2 } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select } from "@/components/ui/select";

interface UploadDocTabProps {
  employee: any;
  documentTypes: any[];
  documentLists: any[];
  onUpload?: (formData: FormData) => Promise<void> | void;
}

export function UploadDocTab({ employee, documentTypes, documentLists, onUpload }: UploadDocTabProps) {
  const [documentType, setDocumentType] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title || !documentType) return;
    
    setUploading(true);
    try {
      if (onUpload) {
        const formData = new FormData();
        formData.append('user_id', String(employee?.id || ''));
        formData.append('document_type_id', documentType);
        formData.append('document_title', title);
        formData.append('title', title);
        formData.append('file', file);
        await onUpload(formData);
      }
      setFile(null);
      setTitle('');
      setDocumentType('');
    } catch (err) {
      console.error('Failed to upload document:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 h-full overflow-y-auto pb-16 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Upload Form Area */}
      <div className="bg-surface border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-4">Upload New Document</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select
                value={documentType}
                onChange={setDocumentType}
                placeholder="Select Type"
                options={documentTypes?.map((type: any) => ({
                  value: String(type.id || type),
                  label: type.document_type || type.title || String(type)
                })) || []}
              />
            </div>

            <div className="space-y-2">
              <Label>Document Title</Label>
              <Input
                type="text"
                placeholder="Enter title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>File Upload</Label>
              <div className="relative">
                <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="file"
                  required
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="pl-9 cursor-pointer file:text-primary file:font-semibold file:border-0 file:bg-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t mt-6">
            <Button type="submit" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Submit Document'
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Uploaded Documents Table */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Uploaded Documents
        </h3>
        
        <div className="rounded-md border bg-surface overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentLists && documentLists.length > 0 ? (
                documentLists.map((doc: any, index: number) => (
                  <TableRow key={doc.id || index}>
                    <TableCell className="font-medium">{doc.document_type || 'Staff Document'}</TableCell>
                    <TableCell>{doc.document_title || doc.title || doc.file_name || 'Document'}</TableCell>
                    <TableCell className="text-right">
                      {doc.file_name || doc.file_path || doc.url ? (
                        <a
                          href={doc.url || `https://s3-triz.fra1.digitaloceanspaces.com/public/hp_staff_document/${doc.file_name || doc.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </Button>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unavailable</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No documents uploaded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
