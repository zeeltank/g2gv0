import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'left' | 'right' | 'top' | 'bottom'
  children?: React.ReactNode
}

const Sheet = ({
  open,
  onOpenChange,
  side = 'right',
  children,
}: SheetProps) => {
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
            side,
          } as any)
        }
        return child
      })}
    </>
  )
}

interface SheetTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ onClick, onOpenChange, ...props }, ref) => (
    <button
      ref={ref}
      onClick={(e) => {
        onClick?.(e)
        onOpenChange?.(true)
      }}
      {...props}
    />
  ),
)
SheetTrigger.displayName = 'SheetTrigger'

interface SheetOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const SheetOverlay = React.forwardRef<
  HTMLDivElement,
  SheetOverlayProps
>(({ className, open, onOpenChange, ...props }, ref) => (
  <>
    {open && (
      <div
        ref={ref}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity',
          className,
        )}
        onClick={() => onOpenChange?.(false)}
        {...props}
      />
    )}
  </>
))
SheetOverlay.displayName = 'SheetOverlay'

interface SheetContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'left' | 'right' | 'top' | 'bottom'
}

const SheetContent = React.forwardRef<
  HTMLDivElement,
  SheetContentProps
>(({ className, open, onOpenChange, side = 'right', children, ...props }, ref) => {
  const sideClass = {
    left: 'left-0 top-0 h-full w-3/4 max-w-sm border-r',
    right: 'right-0 top-0 h-full w-3/4 max-w-sm border-l',
    top: 'top-0 left-0 w-full h-3/4 max-h-sm border-b',
    bottom: 'bottom-0 left-0 w-full h-3/4 max-h-sm border-t',
  }[side]

  const animationClass = {
    left: open ? 'translate-x-0' : '-translate-x-full',
    right: open ? 'translate-x-0' : 'translate-x-full',
    top: open ? 'translate-y-0' : '-translate-y-full',
    bottom: open ? 'translate-y-0' : 'translate-y-full',
  }[side]

  return (
    <>
      <SheetOverlay open={open} onOpenChange={onOpenChange} />
      {open && (
        <div
          ref={ref}
          className={cn(
            'fixed z-50 border-border bg-card shadow-lg transition-transform',
            sideClass,
            animationClass,
            className,
          )}
          {...props}
        >
          {children}
          <button
            onClick={() => onOpenChange?.(false)}
            className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </>
  )
})
SheetContent.displayName = 'SheetContent'

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />
)
SheetHeader.displayName = 'SheetHeader'

const SheetTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
)
SheetTitle.displayName = 'SheetTitle'

const SheetDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
)
SheetDescription.displayName = 'SheetDescription'

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
)
SheetFooter.displayName = 'SheetFooter'

export {
  Sheet,
  SheetTrigger,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
}
