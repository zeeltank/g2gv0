'use client'

import { Button } from '@/components/ui/button'

export interface QuickAction {
  id: string
  label: string
  prompt: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'improve-writing', label: 'Improve Writing', prompt: 'Improve the writing quality of the selected text' },
  { id: 'fix-grammar', label: 'Fix Grammar', prompt: 'Fix grammar and spelling errors' },
  { id: 'translate', label: 'Translate', prompt: 'Translate to another language' },
  { id: 'make-longer', label: 'Make Longer', prompt: 'Expand and elaborate on the content' },
  { id: 'make-shorter', label: 'Make Shorter', prompt: 'Condense and summarize the content' },
  { id: 'simplify', label: 'Simplify Language', prompt: 'Simplify the language for better understanding' },
  { id: 'be-specific', label: 'Be More Specific', prompt: 'Make the content more specific and detailed' },
]

interface QuickActionsProps {
  onActionSelect?: (action: QuickAction) => void
}

export function QuickActions({ onActionSelect }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_ACTIONS.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          onClick={() => onActionSelect?.(action)}
          className="rounded-full"
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}

export { QUICK_ACTIONS }