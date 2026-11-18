'use client'

import { useState } from 'react'
import { Bot, ChevronLeft, SquarePen } from 'lucide-react'
import { AgentChat, type Message } from './agent-chat'
import { ApprovalsPanel } from './approvals-panel'
import { useChatActions } from './chat-actions-context'
import {
  ContextBanner,
  SuggestionButton,
  TabEmptyState,
  TabSection,
  WorkspaceTabs,
  type WorkspaceContextInfo,
  type WorkspaceTab,
} from './workspace-chrome'
import type { EntityMatch } from '@/lib/page-entities/types'

interface AgentPanelProps {
  suggestedPrompts?: string[]
  messages: Message[]
  isLoading?: boolean
  error?: string | null
  /** What the assistant is looking at (page, module, filters); null until the page has been read. */
  context?: WorkspaceContextInfo | null
  contextLoading?: boolean
  onClose?: () => void
  onNewChat?: () => void
  onSendMessage?: (message: string) => void | Promise<void>
  onOpenEntity?: (providerKey: string, match: EntityMatch, action?: 'open' | 'reveal') => void
}

/**
 * The assistant panel. Layout, header, tabs, bubbles and composer are the LMS K12 assistant's
 * (`ChatbotPanel`); what it answers from - G2G's data, modules, actions and approvals - is G2G's.
 */
export function AgentPanel({
  suggestedPrompts,
  messages,
  isLoading,
  error,
  context = null,
  contextLoading,
  onClose,
  onNewChat,
  onSendMessage,
  onOpenEntity,
}: AgentPanelProps) {
  const chatActions = useChatActions()
  const [tab, setTab] = useState<WorkspaceTab>('ask')
  const subject = context?.subject ?? 'this page'

  /** A prompt chosen on another tab is asked in the conversation, so the answer shows there. */
  const ask = (text: string) => {
    setTab('ask')
    void onSendMessage?.(text)
  }

  const analysePrompts = [
    ...(suggestedPrompts ?? []),
    `What needs my attention on ${subject}?`,
    `Summarise what is shown on ${subject}`,
  ].filter((prompt, index, all) => all.indexOf(prompt) === index)

  const createPrompts = [
    { label: `Create a report on ${subject}`, description: 'A report built from the data on this page.' },
    { label: `Create a template for ${subject}`, description: 'A draft template you can review and reuse.' },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-border/60 bg-background/90 shadow-[0_18px_55px_rgba(15,23,42,0.1)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-border/70 bg-background/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 items-center justify-center rounded-2xl text-white shadow-[0_10px_24px_rgba(13,110,253,0.2)]"
            style={{ background: 'var(--accent-gradient)' }}
          >
            <Bot className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Advance AI</h3>
            <p className="text-[11px] font-medium text-muted-foreground">
              Multilingual, voice-enabled workforce intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onNewChat && (
            <button
              type="button"
              onClick={() => {
                setTab('ask')
                onNewChat()
              }}
              disabled={messages.length === 0 && !isLoading}
              className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              title="New chat"
              aria-label="Start a new chat"
            >
              <SquarePen size={17} aria-hidden="true" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Collapse Chatbot"
              aria-label="Close AI Agent"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <ContextBanner context={context} loading={contextLoading} />
      <WorkspaceTabs active={tab} onChange={setTab} />

      {tab === 'ask' ? (
        <AgentChat
          suggestedPrompts={suggestedPrompts}
          contextLabel={context ? (context.moduleLabel ?? context.subject) : null}
          messages={messages}
          isLoading={isLoading}
          error={error}
          onSendMessage={onSendMessage}
          onOpenEntity={onOpenEntity}
        />
      ) : (
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {tab === 'create' && (
            <TabSection title="Create">
              {createPrompts.map((item) => (
                <SuggestionButton
                  key={item.label}
                  label={item.label}
                  description={item.description}
                  disabled={isLoading}
                  onClick={() => ask(item.label)}
                />
              ))}
            </TabSection>
          )}

          {tab === 'analyse' && (
            <TabSection title="Analyse">
              {analysePrompts.map((prompt) => (
                <SuggestionButton key={prompt} label={prompt} disabled={isLoading} onClick={() => ask(prompt)} />
              ))}
            </TabSection>
          )}

          {tab === 'actions' && (
            <>
              <ApprovalsPanel />
              <TabSection title="Actions on this page">
                {chatActions && chatActions.available.length > 0 ? (
                  chatActions.available.map((action) => (
                    <SuggestionButton
                      key={action.key}
                      label={action.label}
                      description={action.description}
                      onClick={() => {
                        setTab('ask')
                        chatActions.start(action.key)
                      }}
                    />
                  ))
                ) : (
                  <TabEmptyState message="No actions are available on this page." />
                )}
              </TabSection>
            </>
          )}
        </div>
      )}
    </div>
  )
}
