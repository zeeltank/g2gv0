'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Lightbulb, Workflow, Bot } from 'lucide-react'

type ToolbarItem = {
  id: string
  label: string
  icon: React.ElementType
  description: string
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
  {
    id: 'recommendations',
    label: 'Recommendations',
    icon: Lightbulb,
    description: 'AI-generated suggestions, best practices, and insights to help you improve your work and make better decisions.',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: Workflow,
    description: 'Create, manage, and automate workflows. View existing workflows, create new ones, and monitor execution.',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    description: 'Available AI agents for performing tasks, answering questions, and automating business processes.',
  },
]

interface FloatingToolbarProps {
  openPanel?: string | null
  onOpenPanelChange?: (panel: string | null) => void
}

export function FloatingToolbar({ openPanel, onOpenPanelChange }: FloatingToolbarProps = {}) {
  const [internalOpenPanel, setInternalOpenPanel] = useState<string | null>(null)
  const activePanel = openPanel ?? internalOpenPanel
  const setActivePanel = (panel: string | null) => {
    setInternalOpenPanel(panel)
    onOpenPanelChange?.(panel)
  }

  return (
    <aside
      aria-label="Floating Toolbar"
      className={cn(
        'fixed top-1/2 right-4 -translate-y-1/2 z-50 flex flex-col items-center gap-1 p-1.5 w-16 rounded-xl',
        'bg-background/95 dark:bg-card/95 border border-border shadow-lg backdrop-blur-sm',
      )}
    >
      {TOOLBAR_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = activePanel === item.id

        return (
          <Popover key={item.id} open={isActive} onOpenChange={(open) => setActivePanel(open ? item.id : null)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 px-1.5 rounded-lg transition-all duration-200 ease-out',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary/15 text-primary w-full'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground w-full',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="left" align="center" sideOffset={12} className="w-80 rounded-xl shadow-lg p-6">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </h2>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <div className="mt-4 max-h-96 overflow-y-auto">
                {item.id === 'recommendations' && <RecommendationsPanel />}
                {item.id === 'workflows' && <WorkflowsPanel />}
                {item.id === 'agents' && <AgentsPanel />}
              </div>
            </PopoverContent>
          </Popover>
        )
      })}
    </aside>
  )
}

function RecommendationsPanel() {
  const recommendations = [
    {
      id: 1,
      title: 'Optimize your workflow',
      description: 'Consider automating repetitive tasks to improve efficiency',
      time: '2 hours ago',
    },
    {
      id: 2,
      title: 'Team collaboration tip',
      description: 'Schedule a weekly sync to align on project priorities',
      time: '1 day ago',
    },
    {
      id: 3,
      title: 'Data quality improvement',
      description: 'Some records are missing required fields. Run the data audit tool.',
      time: '2 days ago',
    },
  ]

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className="rounded-lg border border-border bg-surface-muted p-4 hover:bg-secondary transition-colors duration-200"
        >
          <h3 className="font-medium text-foreground">{rec.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{rec.description}</p>
          <time className="mt-2 block text-xs text-muted-foreground">{rec.time}</time>
        </div>
      ))}
    </div>
  )
}

function WorkflowsPanel() {
  const workflows = [
    {
      id: 1,
      name: 'Employee Onboarding',
      status: 'Active',
      runs: 12,
    },
    {
      id: 2,
      name: 'Performance Review',
      status: 'Draft',
      runs: 0,
    },
    {
      id: 3,
      name: 'Leave Approval',
      status: 'Active',
      runs: 24,
    },
  ]

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="w-full rounded-lg border border-dashed border-border bg-background p-4 text-center hover:bg-secondary transition-colors duration-200"
      >
        <span className="text-sm font-medium text-foreground">+ Create New Workflow</span>
      </button>

      <div className="space-y-2">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface-muted p-3 hover:bg-secondary transition-colors duration-200 cursor-pointer"
          >
            <div>
              <h3 className="font-medium text-foreground">{workflow.name}</h3>
              <p className="text-xs text-muted-foreground">{workflow.runs} runs</p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                workflow.status === 'Active' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
              )}
            >
              {workflow.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentsPanel() {
  const agents = [
    {
      id: 1,
      name: 'Assistant',
      description: 'General purpose AI assistant',
      available: true,
    },
    {
      id: 2,
      name: 'HR Specialist',
      description: 'Human resources expertise',
      available: true,
    },
    {
      id: 3,
      name: 'Analytics Pro',
      description: 'Data analysis and insights',
      available: false,
    },
  ]

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="w-full rounded-lg border border-dashed border-border bg-background p-4 text-center hover:bg-secondary transition-colors duration-200"
      >
        <span className="text-sm font-medium text-foreground">+ Create New Agent</span>
      </button>

      <div className="space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border border-border p-3',
              agent.available ? 'bg-surface-muted hover:bg-secondary cursor-pointer' : 'opacity-60',
              'transition-colors duration-200',
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">{agent.name}</h3>
              <p className="text-xs text-muted-foreground">{agent.description}</p>
            </div>
            {!agent.available && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Coming Soon
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}