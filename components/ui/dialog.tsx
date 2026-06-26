import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

const Dialog = React.forwardRef<
  HTMLDivElement,
  DialogProps & React.HTMLAttributes<HTMLDivElement>
>(({ open, onOpenChange, children, ...props }, ref) => {
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
})
Dialog.displayName = 'Dialog'

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  {
    asChild?: boolean
    onClick?: () => void
    onOpenChange?: (open: boolean) => void
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
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
DialogTrigger.displayName = 'DialogTrigger'

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  {
    open?: boolean
    onOpenChange?: (open: boolean) => void
  } & React.HTMLAttributes<HTMLDivElement>
>(({ className, open, onOpenChange, ...props }, ref) => (
  <>
    {open && (
      <div
        ref={ref}
        className={cn(
          'fixed inset-0 z-50 bg-foreground/40 transition-opacity',
          className,
        )}
        onClick={() => onOpenChange?.(false)}
        {...props}
      />
    )}
  </>
))
DialogOverlay.displayName = 'DialogOverlay'

const DialogContent = React.forwardRef<
  HTMLDivElement,
  {
    open?: boolean
    onOpenChange?: (open: boolean) => void
  } & React.HTMLAttributes<HTMLDivElement>
>(({ className, open, onOpenChange, children, ...props }, ref) => (
  <>
    <DialogOverlay open={open} onOpenChange={onOpenChange} />
    {open && (
      <div
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
        <button
          onClick={() => onOpenChange?.(false)}
          className="absolute right-4 top-4 text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-muted p-1 rounded-full cursor-pointer hover:rotate-90 hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
    )}
  </>
))
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
)
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
)
DialogDescription.displayName = 'DialogDescription'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
)
DialogFooter.displayName = 'DialogFooter'

export {
  Dialog,
  DialogTrigger,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}
