import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva('animate-spin', {
  variants: {
    size: {
      sm: 'size-4',
      default: 'size-6',
      lg: 'size-8',
      xl: 'size-10',
    },
    variant: {
      default: 'text-foreground',
      primary: 'text-primary',
      secondary: 'text-secondary',
      destructive: 'text-destructive',
      success: 'text-success',
      warning: 'text-warning',
    },
  },
  defaultVariants: {
    size: 'default',
    variant: 'default',
  },
})

interface SpinnerProps
  extends React.SVGAttributes<SVGSVGElement>,
    VariantProps<typeof spinnerVariants> {}

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ size, variant, className, ...props }, ref) => (
    <Loader2
      ref={ref}
      className={cn(spinnerVariants({ size, variant, className }))}
      {...props}
    />
  ),
)
Spinner.displayName = 'Spinner'

export { Spinner, spinnerVariants }
