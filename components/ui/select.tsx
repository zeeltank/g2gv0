import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  label: string
  value: string
}

interface SelectProps {
  value?: string
  onChange?: (value: string) => void
  options?: SelectOption[]
  className?: string
  size?: 'sm' | 'default' | 'lg'
  placeholder?: string
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ className, size = 'default', value, onChange, options = [], placeholder = 'Select...' }, ref) => {
    const [open, setOpen] = React.useState(false)
    const [isMounted, setIsMounted] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

    React.useEffect(() => {
      if (open) {
        setIsMounted(true)
      } else {
        const timer = setTimeout(() => setIsMounted(false), 150)
        return () => clearTimeout(timer)
      }
    }, [open])

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const sizeClass = {
      sm: 'h-7 px-2.5 text-xs',
      default: 'h-8 px-3 text-sm',
      lg: 'h-9 px-3.5 text-base',
    }[size]

    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || placeholder

    return (
      <div ref={containerRef} className="relative inline-block w-full">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border border-input bg-transparent py-1.5 text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 appearance-none cursor-pointer',
            sizeClass,
            className,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className={cn('size-4 opacity-50 transition-transform duration-200', open && 'rotate-180')} />
        </button>

        {(isMounted || open) && (
          <div
            className={cn(
              'absolute z-50 mt-1 max-h-60 w-full min-w-[8rem] overflow-auto rounded-xl border border-border/50 bg-surface/80 backdrop-blur-xl p-1 shadow-xl ring-1 ring-black/5',
              'origin-top transition-all duration-150 ease-out',
              open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
            )}
          >
            <div className="flex flex-col gap-0.5">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange?.(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-foreground transition-colors outline-none cursor-pointer hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10',
                    String(value) === String(opt.value) && 'bg-primary/15 text-primary font-medium'
                  )}
                >
                  {opt.label}
                  {String(value) === String(opt.value) && <Check className="size-4" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
