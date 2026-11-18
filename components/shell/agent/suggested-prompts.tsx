'use client'

interface SuggestedPromptsProps {
  prompts: string[]
  /** "In <module>" / "About <record>" when the page is known; "Suggested prompts" otherwise. */
  label?: string
  disabled?: boolean
  onSelect?: (prompt: string) => void
}

export function SuggestedPrompts({ prompts, label = 'Suggested prompts', disabled, onSelect }: SuggestedPromptsProps) {
  if (prompts.length === 0) return null

  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
      <div className="flex flex-col gap-1.5">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect?.(prompt)}
            disabled={disabled}
            className="rounded-2xl border border-border/80 bg-background px-3.5 py-2.5 text-left text-sm font-medium text-foreground/80 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#0D6EFD]/20 hover:bg-blue-50/70 hover:text-[#0D6EFD] hover:shadow-[0_10px_24px_rgba(13,110,253,0.08)] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-blue-500/10"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
