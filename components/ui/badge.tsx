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
          'border border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'border border-border text-foreground hover:bg-muted',
        success:
          'border border-transparent bg-success text-success-foreground hover:bg-success/80',
        warning:
          'border border-transparent bg-warning text-warning-foreground hover:bg-warning/80',
        muted:
          'border border-transparent bg-muted text-muted-foreground hover:bg-muted/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
