import * as React from 'react'
import { cn } from '@/lib/utils'

interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value: valueProp, defaultValue, onValueChange, disabled, children, ...props }, ref) => {
    /*
     * Controlled when `value` is passed, uncontrolled otherwise.
     *
     * There was no `defaultValue` prop at all, so callers passing one had it
     * swept into ...props and spread onto the div as an invalid DOM attribute.
     * `value` was then undefined, every child cloned with
     * `checked={childProps.value === undefined}` - false - and onChange called
     * an undefined onValueChange. The result was a radio group that could not
     * be checked by default OR by clicking: the gender radios in the Add
     * Employee wizard were inert.
     */
    const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue)
    const isControlled = valueProp !== undefined
    const value = isControlled ? valueProp : internalValue

    const select = (next: string) => {
      if (!isControlled) setInternalValue(next)
      onValueChange?.(next)
    }

    return (
      <div
        ref={ref}
        role="radiogroup"
        className={cn('flex flex-col gap-3', className)}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            const childProps = child.props as any;
            return React.cloneElement(child, {
              ...childProps,
              checked: childProps.value === value,
              onChange: () => select(childProps.value),
              disabled: disabled || childProps.disabled,
            } as any)
          }
          return child
        })}
      </div>
    )
  },
)
RadioGroup.displayName = 'RadioGroup'

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'default' | 'lg'
  label?: React.ReactNode
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, size = 'default', label, id, ...props }, ref) => {
    /*
     * ═══════════════════════════════════════════════════════════════════════
     * THE CHECKED STATE WAS INVISIBLE IN LIGHT MODE
     * ═══════════════════════════════════════════════════════════════════════
     *
     * The dot was `bg-primary-foreground`, which is `hsl(0 0% 100%)` — WHITE,
     * in both themes. It sat on `bg-background`, which in light mode is
     * `hsl(210 40% 98%)`: a white dot on a near-white circle. The only thing
     * marking a radio as selected was the border turning blue, and at 1px on a
     * 20px circle that is not a state anybody can read at a glance.
     *
     * This is not a switch. `Switch` fills with `checked:bg-primary`, so a white
     * thumb reads correctly against it; a radio keeps its background and marks
     * itself with a coloured dot. `bg-primary` is that dot.
     *
     * ── THE HOVER SCALE IS GONE ────────────────────────────────────────────
     *
     * `hover:scale-110` was on the INPUT, and the dot is an absolutely
     * positioned SIBLING that does not scale with it — so hovering a checked
     * radio grew the ring and left the dot behind, off-centre. Radios do not
     * resize on hover anyway; a border colour change is the conventional
     * affordance and it cannot come apart.
     *
     * ── THE LABEL NOW ACTUALLY SELECTS ─────────────────────────────────────
     *
     * It carried `cursor-pointer` and no `htmlFor`, and did not wrap the input
     * either — so it promised a click target and delivered nothing, and a
     * screen reader had no name for the control. A generated id ties the two
     * together; `useId` rather than a counter because it is stable across
     * server and client render.
     */
    const generatedId = React.useId()
    const inputId = id ?? generatedId

    const sizeClass = {
      sm: 'size-4',
      default: 'size-5',
      lg: 'size-6',
    }[size]

    const dotSize = {
      sm: 'size-1.5',
      default: 'size-2',
      lg: 'size-2.5',
    }[size]

    return (
      <div className="flex items-center gap-2">
        <div className="relative inline-flex">
          <input
            ref={ref}
            id={inputId}
            type="radio"
            className={cn(
              'peer appearance-none cursor-pointer rounded-full border-2 border-input bg-background transition-colors duration-200',
              'hover:border-primary/60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input',
              'checked:border-primary',
              sizeClass,
              className,
            )}
            {...props}
          />
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary',
              'scale-50 opacity-0 transition-[opacity,transform] duration-150',
              'peer-checked:scale-100 peer-checked:opacity-100',
              'peer-disabled:opacity-50',
              dotSize,
            )}
          />
        </div>
        {label && (
          <label
            htmlFor={inputId}
            className="cursor-pointer select-none text-sm text-foreground"
          >
            {label}
          </label>
        )}
      </div>
    )
  },
)

Radio.displayName = 'Radio'

export { RadioGroup, Radio }
