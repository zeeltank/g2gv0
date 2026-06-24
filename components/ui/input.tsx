import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm text-foreground transition-all duration-200 ease-out placeholder:text-muted-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:-translate-y-[0.5px] focus-visible:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  {
    variants: {
      size: {
        sm: 'h-7 px-2.5 text-xs',
        default: 'h-8 px-3 text-sm',
        lg: 'h-9 px-3.5 text-base',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(inputVariants({ size, className }), type === 'file' ? 'cursor-pointer file:cursor-pointer' : '')}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input, inputVariants }
