import * as React from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  label: string
  value: string
}

interface SelectProps {
  id?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  options?: SelectOption[]
  className?: string
  size?: 'sm' | 'default' | 'lg'
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ id, className, size = 'default', value, onChange, options = [], placeholder = 'Select...', disabled, 'aria-label': ariaLabel }, ref) => {
    const [open, setOpen] = React.useState(false)
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
    const [isMounted, setIsMounted] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const listRef = React.useRef<HTMLDivElement>(null)
    const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>()
    const typeaheadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
    const typeaheadBufferRef = React.useRef('')
    const listboxId = React.useId()

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

    React.useEffect(() => {
      if (open) {
        setIsMounted(true)
        const currentIndex = options.findIndex(o => String(o.value) === String(value))
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0)
      } else {
        const timer = setTimeout(() => setIsMounted(false), 150)
        return () => clearTimeout(timer)
      }
    }, [open, value, options])

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node) &&
          !listRef.current?.contains(e.target as Node)
        ) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    React.useLayoutEffect(() => {
      if (!open) return

      const positionPopover = () => {
        const trigger = containerRef.current?.getBoundingClientRect()
        if (!trigger) return
        setPopoverStyle({
          top: trigger.bottom + 4,
          left: trigger.left,
          width: Math.max(trigger.width, 128),
        })
      }

      positionPopover()
      window.addEventListener('resize', positionPopover)
      window.addEventListener('scroll', positionPopover, true)
      return () => {
        window.removeEventListener('resize', positionPopover)
        window.removeEventListener('scroll', positionPopover, true)
      }
    }, [open])

    React.useEffect(() => {
      if (!open || !listRef.current) return

      const items = listRef.current.querySelectorAll('[role="option"]')
      items.forEach((item, index) => {
        if (index === highlightedIndex) {
          item.scrollIntoView({ block: 'nearest' })
        }
      })
    }, [highlightedIndex, open])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (open && highlightedIndex >= 0) {
            onChange?.(options[highlightedIndex].value)
            setOpen(false)
          } else {
            setOpen(true)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (!open) {
            setOpen(true)
          } else {
            setHighlightedIndex(prev => 
              prev < options.length - 1 ? prev + 1 : 0
            )
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (!open) {
            setOpen(true)
          } else {
            setHighlightedIndex(prev => 
              prev > 0 ? prev - 1 : options.length - 1
            )
          }
          break
        case 'Home':
          e.preventDefault()
          if (open) {
            setHighlightedIndex(0)
          }
          break
        case 'End':
          e.preventDefault()
          if (open) {
            setHighlightedIndex(options.length - 1)
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          break
        case 'Tab':
          setOpen(false)
          break
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault()
            typeaheadBufferRef.current += e.key.toLowerCase()
            
            if (typeaheadTimeoutRef.current) {
              clearTimeout(typeaheadTimeoutRef.current)
            }
            
            typeaheadTimeoutRef.current = setTimeout(() => {
              typeaheadBufferRef.current = ''
            }, 500)
            
            const matchIndex = options.findIndex(opt => 
              opt.label.toLowerCase().startsWith(typeaheadBufferRef.current)
            )
            
            if (matchIndex >= 0) {
              setHighlightedIndex(matchIndex)
            }
          }
      }
    }

    const sizeClass = {
      sm: 'h-7 px-2.5 text-xs',
      default: 'h-8 px-3 text-sm',
      lg: 'h-9 px-3.5 text-base',
    }[size]

    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || placeholder
    const portalContainer =
      containerRef.current?.closest('[data-slot="sheet-content"]')
      ?? (typeof document !== 'undefined' ? document.body : null)

    return (
      <div 
        ref={containerRef} 
        id={id}
        className="relative inline-block w-full"
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => !disabled && setOpen(!open)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border border-input bg-transparent py-1.5 text-foreground transition-all duration-200 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 appearance-none cursor-pointer active:scale-95',
            sizeClass,
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className={cn('size-4 opacity-50 transition-transform duration-200', open && 'rotate-180')} />
        </button>

        {(isMounted || open) && portalContainer && createPortal(
          <div
            ref={listRef}
            style={popoverStyle}
            role="listbox"
            aria-label={ariaLabel || 'Select options'}
            className={cn(
              'pointer-events-auto fixed z-[100] max-h-60 min-w-[8rem] overflow-auto rounded-xl border border-border/50 bg-card/98 backdrop-blur-xl p-1 shadow-xl ring-1 ring-black/5',
              'origin-top transition-all duration-150 ease-out',
              open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
            )}
          >
            <div className="flex flex-col gap-0.5">
              {options.map((opt, index) => (
                <div
                  key={`${opt.value}-${index}`}
                  role="option"
                  aria-selected={String(value) === String(opt.value)}
                  data-disabled={opt.value === value}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    onChange?.(opt.value)
                    setOpen(false)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-foreground transition-colors outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground',
                    highlightedIndex === index && 'bg-accent text-accent-foreground',
                    String(value) === String(opt.value) && 'bg-primary/15 text-primary font-medium'
                  )}
                >
                  {opt.label}
                  {String(value) === String(opt.value) && <Check className="size-4" />}
                </div>
              ))}
            </div>
          </div>,
          portalContainer,
        )}
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select, type SelectOption }
