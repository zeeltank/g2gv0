'use client'

import { Button } from '@/components/ui/button'

interface SuggestedPromptsProps {
  prompts: string[]
  onSelect?: (prompt: string) => void
}

export function SuggestedPrompts({ prompts, onSelect }: SuggestedPromptsProps) {
  if (prompts.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-foreground mb-2">Suggested prompts</p>
      <div className="flex flex-col gap-1.5">
        {prompts.map((prompt, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect?.(prompt)}
            className="justify-start h-8 px-3 text-xs"
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  )
}