import * as React from 'react'
import { Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  hint?: string
  maxSizeMB?: number
  onFileSelect?: (file: File | null) => void
}

const FileUpload = React.forwardRef<HTMLInputElement, FileUploadProps>(
  (
    {
      className,
      label,
      hint,
      maxSizeMB = 10,
      onFileSelect,
      accept,
      ...props
    },
    ref,
  ) => {
    const [file, setFile] = React.useState<File | null>(null)
    const [error, setError] = React.useState<string>('')
    const inputRef = React.useRef<HTMLInputElement>(null)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      setError('')

      if (!selectedFile) {
        setFile(null)
        onFileSelect?.(null)
        return
      }

      const maxSizeBytes = maxSizeMB * 1024 * 1024
      if (selectedFile.size > maxSizeBytes) {
        setError(`File size exceeds ${maxSizeMB}MB limit`)
        setFile(null)
        onFileSelect?.(null)
        return
      }

      setFile(selectedFile)
      onFileSelect?.(selectedFile)
    }

    const handleClear = () => {
      setFile(null)
      setError('')
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      onFileSelect?.(null)
    }

    return (
      <div className={cn('w-full', className)}>
        {label && <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>}

        <div className="relative">
          <input
            ref={inputRef}
            type="file"
            onChange={handleChange}
            accept={accept}
            className="sr-only"
            {...props}
          />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-8 transition-colors hover:border-muted-foreground hover:bg-muted"
            >
              <Upload className="size-5 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Click to upload or drag and drop
                </p>
                {hint && (
                  <p className="text-xs text-muted-foreground">{hint}</p>
                )}
              </div>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3">
              <div className="flex-1 text-sm text-foreground truncate">
                {file.name}
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    )
  },
)
FileUpload.displayName = 'FileUpload'

export { FileUpload }
