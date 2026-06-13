import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 resize-vertical',
  {
    variants: {
      size: {
        sm: 'min-h-[60px] px-2.5 text-xs',
        default: 'min-h-[80px] px-3 text-sm',
        lg: 'min-h-[120px] px-3.5 text-base',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size, ...props }, ref) => (
    <textarea
      className={cn(textareaVariants({ size, className }))}
      ref={ref}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export { Textarea, textareaVariants }
