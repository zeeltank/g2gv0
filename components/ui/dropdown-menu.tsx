import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropdownMenuProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

const DropdownMenu = ({ open, onOpenChange, children }: DropdownMenuProps) => {
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

interface DropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuTriggerProps
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
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

interface DropdownMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(({ className, open, onOpenChange, children, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        onOpenChange?.(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () =>
      document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onOpenChange])

  return (
    <>
      {open && (
        <div
          ref={contentRef}
          className={cn(
            'absolute z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      )}
    </>
  )
})
DropdownMenuContent.displayName = 'DropdownMenuContent'

interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onOpenChange?: (open: boolean) => void
}

const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuItemProps
>(({ className, onClick, onOpenChange, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'w-full px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted rounded outline-none focus-visible:bg-muted transition-colors',
      className,
    )}
    onClick={(e) => {
      onClick?.(e)
      onOpenChange?.(false)
    }}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

const DropdownMenuSeparator = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('my-1 h-px bg-border', className)}
    {...props}
  />
)
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
