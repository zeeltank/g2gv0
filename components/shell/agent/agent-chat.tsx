'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, User, Bot as BotIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SuggestedPrompts } from './suggested-prompts'

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
}

const SUGGESTED_PROMPTS = [
  'Help me write a professional email',
  'Explain React hooks in simple terms',
  'Create a todo list for my project',
  'Review my code for best practices',
]

interface AgentChatProps {
  messages?: Message[]
  onSendMessage?: (message: string) => void
}

export function AgentChat({ messages: externalMessages, onSendMessage }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const displayMessages = externalMessages ?? messages

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages])

  const handleSend = () => {
    if (!input.trim()) return
    onSendMessage?.(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6">
        {displayMessages.length === 0 ? (
          <SuggestedPrompts prompts={SUGGESTED_PROMPTS} onSelect={onSendMessage} />
        ) : (
          <div className="py-4 space-y-4">
            {displayMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <BotIcon className="size-4 text-primary" aria-hidden="true" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {message.content}
                </div>
                {message.role === 'user' && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="size-4 text-secondary-foreground" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className={cn(
              'flex-1 h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground',
              'placeholder:text-muted-foreground outline-none transition-all duration-200',
              'focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20'
            )}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            aria-label="Send message"
            className={cn(
              'flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground',
              'transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Send className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}