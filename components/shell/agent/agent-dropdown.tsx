'use client'

import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { QuickActions, type QuickAction } from './quick-actions'

interface AgentDropdownProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSendPrompt?: (prompt: string) => void
}

export function AgentDropdown({ open, onOpenChange, onSendPrompt }: AgentDropdownProps) {
  const [prompt, setPrompt] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, onOpenChange])

  const handleActionSelect = (action: QuickAction) => {
    onSendPrompt?.(action.prompt)
    onOpenChange(false)
  }

  const handleSend = () => {
    if (!prompt.trim()) return
    onSendPrompt?.(prompt)
    setPrompt('')
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute right-0 z-50 mt-2 w-[27rem] rounded-xl border border-border bg-card p-4 shadow-lg"
      role="menu"
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="agent-prompt" className="text-xs font-medium text-foreground mb-1.5 block">
            AI Prompt
          </label>
          <Textarea
            id="agent-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask or describe what you need..."
            className="w-full resize-none"
            size="lg"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground mb-2">Quick Actions</p>
          <QuickActions onActionSelect={handleActionSelect} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSend} disabled={!prompt.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}