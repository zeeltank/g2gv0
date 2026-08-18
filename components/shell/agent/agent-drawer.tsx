'use client'

import { Bot, X } from 'lucide-react'
import { AgentChat, type Message } from './agent-chat'
import { IconButton } from '@/components/ui/icon-button'

interface AgentPanelProps {
  messages: Message[]
  isLoading?: boolean
  error?: string | null
  onClose?: () => void
  onSendMessage?: (message: string) => void | Promise<void>
}

export function AgentPanel({
  messages,
  isLoading,
  error,
  onClose,
  onSendMessage,
}: AgentPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-background via-background to-surface-muted/30">
      <div className="border-b border-border/70 px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/10">
            <Bot className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">AI Agent</h2>
            <p className="mt-1 max-w-[18rem] text-xs leading-5 text-muted-foreground">
              Ask about any G2G module - people, attendance, leave, learning, competencies,
              hiring, tasks and reports - with text or voice.
            </p>
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
      </div>

      <AgentChat
        messages={messages}
        isLoading={isLoading}
        error={error}
        onSendMessage={onSendMessage}
      />
    </div>
  )
}
