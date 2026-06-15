import * as React from 'react'
import { cn } from '@/lib/utils'

interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

const AlertDialog = ({ open, onOpenChange, children }: AlertDialogProps) => {
  const [isOpen, setIsOpen] = React.useState(open ?? false)

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open)
    }
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  return (
    <>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            open: isOpen,
            onOpenChange: handleOpenChange,
          } as any)
        }
        return child
      })}
    </>
  )
}

interface AlertDialogTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const AlertDialogTrigger = React.forwardRef<
  HTMLButtonElement,
  AlertDialogTriggerProps
>(({ onClick, onOpenChange, ...props }, ref) => (
  <button
    ref={ref}
    onClick={(e) => {
      onClick?.(e)
      onOpenChange?.(true)
    }}
    {...props}
  />
))
AlertDialogTrigger.displayName = 'AlertDialogTrigger'

interface AlertDialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
}

const AlertDialogOverlay = React.forwardRef<
  HTMLDivElement,
  AlertDialogOverlayProps
>(({ className, open, ...props }, ref) => (
  <>
    {open && (
      <div
        ref={ref}
        className={cn(
          'fixed inset-0 z-50 bg-foreground/40 transition-opacity',
          className,
        )}
        {...props}
      />
    )}
  </>
))
AlertDialogOverlay.displayName = 'AlertDialogOverlay'

interface AlertDialogContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  AlertDialogContentProps
>(({ className, open, onOpenChange, children, ...props }, ref) => (
  <>
    <AlertDialogOverlay open={open} />
    {open && (
      <div
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )}
  </>
))
AlertDialogContent.displayName = 'AlertDialogContent'

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />
)
AlertDialogHeader.displayName = 'AlertDialogHeader'

const AlertDialogTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  />
)
AlertDialogTitle.displayName = 'AlertDialogTitle'

const AlertDialogDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
)
AlertDialogDescription.displayName = 'AlertDialogDescription'

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
)
AlertDialogFooter.displayName = 'AlertDialogFooter'

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
}
