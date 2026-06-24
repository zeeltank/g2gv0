import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'default' | 'lg'
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  indeterminate?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, size = 'default', checked, onCheckedChange, indeterminate, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = indeterminate ?? false
      }
    }, [indeterminate])

    const combinedRef = React.useCallback(
      (node: HTMLInputElement) => {
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement>).current = node

        // @ts-ignore
        innerRef.current = node
        if (node) {
          node.indeterminate = indeterminate ?? false
        }
      },
      [ref, indeterminate]
    )

    const sizeClass = {
      sm: 'size-4',
      default: 'size-5',
      lg: 'size-6',
    }[size]

    const iconSize = {
      sm: 'size-2.5',
      default: 'size-3',
      lg: 'size-4',
    }[size]

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e)
      onCheckedChange?.(e.target.checked)
    }

    return (
      <div className="relative inline-flex">
        <input
          ref={combinedRef}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className={cn(
            'peer appearance-none cursor-pointer rounded border border-input bg-background transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:border-primary checked:bg-primary dark:checked:border-primary dark:checked:bg-primary',
            sizeClass,
            className,
          )}
          {...props}
        />
        <Check
          className={cn(
            'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-foreground opacity-0 peer-checked:opacity-100',
            iconSize,
          )}
        />
      </div>
    )
  },
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
