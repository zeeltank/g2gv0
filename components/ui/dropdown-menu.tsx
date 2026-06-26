import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropdownMenuContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

const useDropdownMenu = () => {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error('DropdownMenu components must be used within a DropdownMenu');
  }
  return context;
};

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
    <DropdownMenuContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      <div className="relative inline-block">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

interface DropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean // keeping this in case they use it though it's not implemented yet
}

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuTriggerProps
>(({ onClick, asChild, ...props }, ref) => {
  const { open, onOpenChange } = useDropdownMenu();
  return (
    <button
      ref={ref}
      onClick={(e) => {
        onClick?.(e)
        onOpenChange(!open)
      }}
      {...props}
    />
  )
})
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

interface DropdownMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(({ className, children, ...props }, ref) => {
  const { open, onOpenChange } = useDropdownMenu();
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setIsMounted(true)
    } else {
      const timer = setTimeout(() => setIsMounted(false), 150)
      return () => clearTimeout(timer)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () =>
      document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onOpenChange])

  if (!isMounted && !open) return null

  return (
    <div
      ref={contentRef}
      className={cn(
        'absolute z-[100] mt-2 right-0 min-w-[200px] overflow-hidden rounded-xl border border-primary/20 bg-card/95 backdrop-blur-xl p-1.5 shadow-2xl ring-1 ring-black/5',
        'origin-top-right transition-all duration-200 ease-out',
        open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
})
DropdownMenuContent.displayName = 'DropdownMenuContent'

interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuItemProps
>(({ className, onClick, ...props }, ref) => {
  const { onOpenChange } = useDropdownMenu();
  return (
    <button
      ref={ref}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary rounded-md outline-none focus-visible:bg-primary/10 transition-all cursor-pointer',
        className,
      )}
      onClick={(e) => {
        onClick?.(e)
        onOpenChange(false)
      }}
      {...props}
    />
  )
})
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
