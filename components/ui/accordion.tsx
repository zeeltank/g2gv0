import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: 'single' | 'multiple'
  collapsible?: boolean
}

interface AccordionContextType {
  openItems: Set<string>
  toggleItem: (value: string) => void
}

const AccordionContext = React.createContext<AccordionContextType | undefined>(
  undefined,
)

const Accordion = React.forwardRef<
  HTMLDivElement,
  AccordionProps & {
    value?: string | string[]
    onValueChange?: (value: string | string[]) => void
  }
>(
  (
    {
      className,
      type = 'single',
      collapsible = false,
      value: controlledValue,
      onValueChange,
      children,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = React.useState<Set<string>>(
      new Set(Array.isArray(controlledValue) ? controlledValue : []),
    )

    const openItems = controlledValue !== undefined ? new Set(Array.isArray(controlledValue) ? controlledValue : []) : internalValue

    const toggleItem = (value: string) => {
      const newSet = new Set(openItems)

      if (type === 'single') {
        if (newSet.has(value) && collapsible) {
          newSet.delete(value)
        } else {
          newSet.clear()
          newSet.add(value)
        }
      } else {
        if (newSet.has(value)) {
          newSet.delete(value)
        } else {
          newSet.add(value)
        }
      }

      setInternalValue(newSet)
      onValueChange?.(
        type === 'single'
          ? Array.from(newSet)[0] || ''
          : Array.from(newSet),
      )
    }

    return (
      <AccordionContext.Provider value={{ openItems, toggleItem }}>
        <div
          ref={ref}
          className={cn('w-full border border-border rounded-lg overflow-hidden', className)}
          {...props}
        >
          {children}
        </div>
      </AccordionContext.Provider>
    )
  },
)
Accordion.displayName = 'Accordion'

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(AccordionContext)

    return (
      <div
        ref={ref}
        className={cn(
          'border-b border-border last:border-b-0',
          className,
        )}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              value,
              isOpen: context?.openItems.has(value),
              onToggle: () => context?.toggleItem(value),
            } as any)
          }
          return child
        })}
      </div>
    )
  },
)
AccordionItem.displayName = 'AccordionItem'

interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value?: string
  isOpen?: boolean
  onToggle?: () => void
}

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  AccordionTriggerProps
>(({ className, value, isOpen, onToggle, children, ...props }, ref) => (
  <button
    ref={ref}
    onClick={onToggle}
    className={cn(
      'flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronDown
      className={cn(
        'size-4 transition-transform',
        isOpen && 'rotate-180',
      )}
    />
  </button>
))
AccordionTrigger.displayName = 'AccordionTrigger'

interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean
}

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  AccordionContentProps
>(({ className, isOpen, children, ...props }, ref) => (
  <>
    {isOpen && (
      <div
        ref={ref}
        className={cn('px-4 py-3 text-sm text-muted-foreground', className)}
        {...props}
      >
        {children}
      </div>
    )}
  </>
))
AccordionContent.displayName = 'AccordionContent'

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
