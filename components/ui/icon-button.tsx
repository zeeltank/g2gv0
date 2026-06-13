import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-lg border border-transparent outline-none transition-all select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/80 active:scale-95',
        outline:
          'border-border bg-background hover:bg-muted aria-expanded:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        ghost: 'hover:bg-muted aria-expanded:bg-muted dark:hover:bg-muted/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30',
      },
      size: {
        xs: 'size-6',
        sm: 'size-7',
        default: 'size-8',
        lg: 'size-9',
        xl: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(iconButtonVariants({ variant, size, className }))}
      {...props}
    />
  ),
)
IconButton.displayName = 'IconButton'

export { IconButton, iconButtonVariants }
