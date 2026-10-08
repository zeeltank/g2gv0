'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Loader2,
  Mic,
  Send,
  Square,
  User,
  Bot as BotIcon,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SuggestedPrompts } from './suggested-prompts'
import { ActionCard } from './action-card'
import { ApprovalsPanel } from './approvals-panel'
import { LifecyclePanel } from './lifecycle-panel'
import type { LifecyclePayload } from '@/lib/intelligence/ai-lifecycle'
import type { EntityMatch } from '@/lib/page-entities/types'
import { useChatActions } from './chat-actions-context'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useVoiceInteraction } from '@/hooks/use-voice-interaction'

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  variant?: 'default' | 'error'
  status?: string
  conversationType?: string
  tools?: string[]
  /** Set when this message is a proposed action; the card renders it from the flow state. */
  action?: { key: string }
  /** What stands behind an answer from the lifecycle: trace, evidence, suggestions, report. */
  lifecycle?: LifecyclePayload
  /** Set when this message offers to take the user to a page they asked for. */
  navigate?: { label: string; path: string; trail: string[] }
  /**
   * Real records the user asked to find, to choose from. Each has its own Open button; nothing is
   * opened until the user presses one (a single clear match is opened by the shell and not listed).
   */
  entities?: { providerKey: string; noun: string; summary: string; matches: EntityMatch[] }
  /** Real values the assistant offers in answer to a question it asked; each sends its message. */
  choices?: Array<{ label: string; message: string }>
}

const SUGGESTED_PROMPTS = [
  'How many leave requests are pending approval?',
  'Show attendance for the Engineering department this week',
  'Which departments have the biggest skill gaps?',
  'How many candidates are in the hiring pipeline?',
  'Show me leave risk insights for this month',
  'Recommend courses for my role',
]

interface AgentChatProps {
  /**
   * Starter questions for the page the chat is opened on. Left undefined, the built-in list is
   * shown; provided (even empty), ONLY these are shown - an empty list shows none rather than
   * falling back to questions about other modules.
   */
  suggestedPrompts?: string[]
  messages: Message[]
  isLoading?: boolean
  error?: string | null
  onSendMessage?: (message: string) => void | Promise<void>
  /** Open one record the chat listed (the application knows how). */
  onOpenEntity?: (providerKey: string, match: EntityMatch) => void
}

export function AgentChat({
  suggestedPrompts,
  messages,
  isLoading = false,
  error,
  onSendMessage,
  onOpenEntity,
}: AgentChatProps) {
  const chatActions = useChatActions()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    supportedLanguages,
    isSupported,
    language,
    setLanguage,
    transcript,
    setTranscript,
    isRecording,
    startRecording,
    stopRecording,
    isSpeaking,
    speakText,
    stopSpeaking,
    error: voiceError,
    clearError,
  } = useVoiceInteraction()

  const latestAssistantMessage = useMemo(
    () =>
      [...messages].reverse().find(
        (message) => message.role === 'assistant' && message.variant !== 'error'
      ),
    [messages]
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading, error, voiceError])

  useEffect(() => {
    if (!transcript) return
    setInput(transcript)
  }, [transcript])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSendMessage?.(trimmed)
    setInput('')
    setTranscript('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        <div className="pt-4 empty:hidden"><ApprovalsPanel /></div>
        {messages.length === 0 ? (
          <div className="py-5">
            {suggestedPrompts !== undefined && suggestedPrompts.length === 0 && (
              <p className="text-xs leading-5 text-muted-foreground">
                Questions about this page will appear here once it has loaded.
              </p>
            )}
            <SuggestedPrompts
              prompts={suggestedPrompts ?? SUGGESTED_PROMPTS}
              onSelect={(prompt) => {
                if (!isLoading) {
                  onSendMessage?.(prompt)
                }
              }}
            />
            {chatActions && chatActions.available.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-foreground">Actions on this page</p>
                <div className="flex flex-col gap-1.5">
                  {chatActions.available.map((action) => (
                    <Button
                      key={action.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      title={action.description}
                      onClick={() => chatActions.start(action.key)}
                      className="h-8 justify-start px-3 text-xs"
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-5">
            {messages.map((message) =>
              message.action ? (
                <div key={message.id} className="flex gap-3">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10">
                    <BotIcon className="size-4 text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 max-w-[88%] flex-1">
                    <ActionCard messageId={message.id} />
                  </div>
                </div>
              ) : (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10">
                    <BotIcon className="size-4 text-primary" aria-hidden="true" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[88%] whitespace-pre-wrap break-words rounded-3xl px-4 py-3 text-sm leading-7 shadow-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.variant === 'error'
                        ? 'border border-destructive/20 bg-destructive/10 text-destructive'
                        : 'border border-border/70 bg-card text-foreground shadow-[0_8px_30px_rgba(15,23,42,0.06)]'
                  )}
                >
                  {message.role === 'assistant' &&
                  (message.conversationType || message.status || message.tools?.length) ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {message.conversationType ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
                          {message.conversationType}
                        </span>
                      ) : null}
                      {message.status ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {message.status.replaceAll('_', ' ')}
                        </span>
                      ) : null}
                      {message.tools?.map((tool) => (
                        <span
                          key={`${message.id}-${tool}`}
                          className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {message.content}
                  {message.navigate ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => chatActions?.navigate(message.navigate!.path)}>
                        Open {message.navigate.label}
                      </Button>
                      {message.navigate.trail.length > 0 ? (
                        <span className="text-xs text-muted-foreground">{message.navigate.trail.join(' › ')}</span>
                      ) : null}
                    </div>
                  ) : null}
                  {message.entities ? (
                    <ul className="mt-3 space-y-2">
                      {message.entities.matches.map((match) => (
                        <li key={match.id} className="rounded-2xl border border-border/70 bg-background p-3 text-sm leading-6">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-medium text-foreground">{match.title}</p>
                              {match.subtitle ? <p className="text-xs text-muted-foreground">{match.subtitle}</p> : null}
                              <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 text-xs">
                                {match.details.map((detail) => (
                                  <div key={detail.label} className="contents">
                                    <dt className="text-muted-foreground">{detail.label}</dt>
                                    <dd className="break-words text-foreground">{detail.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onOpenEntity?.(message.entities!.providerKey, match)}
                            >
                              Open
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {message.choices ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.choices.map((choice) => (
                        <button
                          key={choice.message}
                          type="button"
                          onClick={() => void onSendMessage?.(choice.message)}
                          className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium transition hover:border-primary hover:text-primary"
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {message.lifecycle ? (
                    <LifecyclePanel payload={message.lifecycle} onSend={(text) => void onSendMessage?.(text)} />
                  ) : null}
                </div>
                {message.role === 'user' && (
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary ring-1 ring-border/60">
                    <User className="size-4 text-secondary-foreground" aria-hidden="true" />
                  </div>
                )}
              </div>
              ),
            )}
            {isLoading && (
              <div className="flex justify-start gap-3">
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10">
                  <BotIcon className="size-4 text-primary" aria-hidden="true" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Thinking through your request...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            {voiceError && (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{voiceError}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about employees, attendance, leave, learning, competencies, hiring, tasks or reports..."
            disabled={isLoading}
            className={cn(
              'h-11 min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm',
              'placeholder:text-muted-foreground outline-none transition-all duration-200',
              'focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-70'
            )}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm',
              'transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <Send className="size-4" aria-hidden="true" />
          </button>
        </div>

        {transcript ? (
          <div className="mb-3 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-5 text-primary">
            Voice transcript ready:
            <span className="ml-1 text-foreground">{transcript}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
          <div className="min-w-0">
            <Select
              value={language}
              onChange={(value) => {
                clearError()
                setLanguage(value)
              }}
              options={supportedLanguages}
              aria-label="Voice language"
            />
          </div>
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => {
              clearError()
              if (isRecording) {
                stopRecording()
              } else {
                startRecording()
              }
            }}
            disabled={!isSupported}
          >
            {isRecording ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
            {isRecording ? 'Stop' : 'Voice'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (isSpeaking) {
                stopSpeaking()
              } else if (latestAssistantMessage?.content) {
                speakText(latestAssistantMessage.content)
              }
            }}
            disabled={!latestAssistantMessage?.content}
          >
            {isSpeaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            {isSpeaking ? 'Mute' : 'Replay'}
          </Button>
        </div>

        {isRecording ? (
          <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-destructive">
            Recording in progress...
          </div>
        ) : null}
      </div>
    </div>
  )
}
