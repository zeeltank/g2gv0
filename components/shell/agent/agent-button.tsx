'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentDropdown } from './agent-dropdown'

interface AgentButtonProps {
  agentOpen?: boolean
  onAgentOpenChange?: (open: boolean) => void
  onSendMessage?: (message: string) => void
}

export function AgentButton({ agentOpen, onAgentOpenChange, onSendMessage }: AgentButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAgentToggle = () => {
    onAgentOpenChange?.(!agentOpen)
  }

  const handleSendPrompt = (prompt: string) => {
    onSendMessage?.(prompt)
    onAgentOpenChange?.(true)
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleAgentToggle}
          aria-label={agentOpen ? 'Close AI Agent' : 'Open AI Agent'}
          className={cn(
            'flex items-center gap-2 rounded-l-md border border-r-0 border-border bg-background px-3 py-1.5',
            'text-sm font-medium text-foreground transition-all duration-200 outline-none',
            'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Bot className="size-4 text-primary" aria-hidden="true" />
          <span>Agent</span>
        </button>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label="AI Quick Actions"
          aria-haspopup="menu"
          aria-expanded={dropdownOpen}
          className={cn(
            'flex items-center justify-center rounded-r-md border border-border bg-background px-2 py-1.5',
            'text-muted-foreground transition-all duration-200 outline-none',
            'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </div>

      <AgentDropdown
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        onSendPrompt={handleSendPrompt}
      />
    </div>
  )
}
