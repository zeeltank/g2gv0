import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20',
        outline: 'border border-border text-foreground hover:bg-muted',
        success:
          'border border-success/20 bg-success/10 text-success hover:bg-success/15',
        warning:
          'border border-warning/20 bg-warning/10 text-warning hover:bg-warning/15',
        muted:
          'border border-border bg-muted text-muted-foreground hover:bg-muted/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  tone?: VariantProps<typeof badgeVariants>['variant']
}

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  const resolvedVariant = tone ?? variant
  return (
    <div
      className={cn(badgeVariants({ variant: resolvedVariant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants, type BadgeProps }
