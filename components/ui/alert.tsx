import * as React from 'react'
import { AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground [&>svg]:text-foreground',
        destructive:
          'border-destructive/50 bg-destructive/10 text-destructive [&>svg]:text-destructive dark:border-destructive/50 dark:bg-destructive/20',
        warning:
          'border-warning/50 bg-warning/10 text-warning [&>svg]:text-warning dark:border-warning/50 dark:bg-warning/20',
        success:
          'border-success/50 bg-success/10 text-success [&>svg]:text-success dark:border-success/50 dark:bg-success/20',
        info: 'border-ring/50 bg-ring/10 text-ring [&>svg]:text-ring dark:border-ring/50 dark:bg-ring/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
)
Alert.displayName = 'Alert'

const AlertTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h5 className={cn('mb-1 font-medium leading-tight', className)} {...props} />
)
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
)
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription, alertVariants }
