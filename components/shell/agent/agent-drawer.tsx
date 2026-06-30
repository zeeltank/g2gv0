'use client'

import { Bot, X } from 'lucide-react'
import { AgentChat } from './agent-chat'
import { SuggestedPrompts } from './suggested-prompts'
import { IconButton } from '@/components/ui/icon-button'

interface AgentPanelProps {
  onClose?: () => void
  onSendMessage?: (message: string) => void
}

const SUGGESTED_PROMPTS = [
  'Help me write a professional email',
  'Explain React hooks in simple terms',
  'Create a todo list for my project',
  'Review my code for best practices',
]

export function AgentPanel({ onClose, onSendMessage }: AgentPanelProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">AI Agent</h2>
            <p className="text-xs text-muted-foreground">How can I help you today?</p>
          </div>
        </div>
        {onClose && (
          <IconButton
            variant="ghost"
            size="default"
            onClick={onClose}
            aria-label="Close AI Agent"
          >
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        <SuggestedPrompts prompts={SUGGESTED_PROMPTS} onSelect={onSendMessage} />
        <AgentChat onSendMessage={onSendMessage} />
      </div>
    </div>
  )
}
