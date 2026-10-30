'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Cpu,
  FileCode,
  Flame,
  Layers,
  Lightbulb,
  Loader2,
  Pause,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmApiRequest } from '@/services/crm-client'
import { toast } from '@/components/ui/toast'

export interface AutomationRule {
  id: number
  name: string
  trigger_module: 'lead' | 'contact' | 'opportunity' | 'signal' | 'campaign'
  trigger_event: string
  conditions: Record<string, any>
  actions: Array<{ action: string; params?: Record<string, any> }>
  is_active: boolean
  last_triggered_at: string | null
  execution_count: number
  description?: string
}

const PRE_SEEDED_RULES: AutomationRule[] = [
  {
    id: 1,
    name: 'High-Intent Signal Auto-Lead Conversion',
    trigger_module: 'signal',
    trigger_event: 'signal.ingested',
    conditions: { classification: 'buying_signal', min_confidence: 0.9 },
    actions: [{ action: 'promote_to_lead' }, { action: 'assign_territory_sdr' }],
    is_active: true,
    last_triggered_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    execution_count: 28,
    description: 'When an incoming social or tender signal scores >90% intent, automatically convert to CRM Lead and assign to territory SDR.',
  },
  {
    id: 2,
    name: 'Inbound Web Lead ? AI Personalized Outreach Drafting',
    trigger_module: 'lead',
    trigger_event: 'lead.created',
    conditions: { source: 'web_capture' },
    actions: [{ action: 'run_ai_outreach' }, { action: 'stage_in_approval_queue' }],
    is_active: true,
    last_triggered_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    execution_count: 54,
    description: 'Autonomous AI drafts custom email touchpoints within 15 minutes of new inbound lead submission and queues for human review.',
  },
  {
    id: 3,
    name: 'Enterprise Opportunity MEDDPICC Coach Evaluation',
    trigger_module: 'opportunity',
    trigger_event: 'opportunity.stage_changed',
    conditions: { target_stage: 'Proposal/Price Quote', min_amount: 50000 },
    actions: [{ action: 'run_deal_coach' }, { action: 'audit_decision_criteria' }],
    is_active: true,
    last_triggered_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    execution_count: 19,
    description: 'Audits Economic Buyer and Decision Criteria gaps using the AI Deal Coach whenever a major deal enters Proposal stage.',
  },
  {
    id: 4,
    name: 'Stalled Pipeline Deal Velocity Health Alert',
    trigger_module: 'opportunity',
    trigger_event: 'opportunity.stalled',
    conditions: { days_in_current_stage: 14 },
    actions: [{ action: 'flag_deal_health' }, { action: 'notify_sales_manager' }],
    is_active: true,
    last_triggered_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    execution_count: 12,
    description: 'Flags deals with no activity for 14+ days and posts AI re-engagement recommendations into the Opportunity coach drawer.',
  },
  {
    id: 5,
    name: 'Closed-Won Opportunity Billing Handover',
    trigger_module: 'opportunity',
    trigger_event: 'opportunity.stage_changed',
    conditions: { target_stage: 'Closed Won' },
    actions: [{ action: 'create_draft_sales_order' }, { action: 'notify_customer_success' }],
    is_active: false,
    last_triggered_at: null,
    execution_count: 0,
    description: 'Seamless Order-to-Cash handover: automatically creates a draft Sales Order and notifies the onboarding team on win.',
  },
]

export function AutomationRulesView() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  const [rules, setRules] = useState<AutomationRule[]>(PRE_SEEDED_RULES)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // New rule modal form state
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleModule, setNewRuleModule] = useState<'lead' | 'contact' | 'opportunity' | 'signal'>('lead')
  const [newRuleEvent, setNewRuleEvent] = useState('lead.created')
  const [newRuleAction, setNewRuleAction] = useState('run_ai_outreach')
  const [newRuleDescription, setNewRuleDescription] = useState('')

  const fetchRules = useCallback(async () => {
    if (!ready) return
    setLoading(true)
    try {
      const res = await crmApiRequest<AutomationRule[]>({
        path: '/automation-rules',
        method: 'GET',
        context,
      })
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setRules(res.data)
      }
    } catch {
      // Keep pre-seeded rules
    } finally {
      setLoading(false)
    }
  }, [context, ready])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleToggle = async (id: number) => {
    setTogglingId(id)
    try {
      if (ready) {
        await crmApiRequest({
          path: `/automation-rules/${id}/toggle`,
          method: 'POST',
          context,
        })
      }
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: !r.is_active } : r))
      )
      const rule = rules.find((r) => r.id === id)
      toast({
        title: rule?.is_active ? 'Rule Paused' : 'Rule Activated',
        description: `"${rule?.name}" is now ${rule?.is_active ? 'paused' : 'active'}.`,
        variant: 'success',
      })
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: !r.is_active } : r))
      )
    } finally {
      setTogglingId(null)
    }
  }

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRuleName.trim()) return

    const newRule: AutomationRule = {
      id: Date.now(),
      name: newRuleName,
      trigger_module: newRuleModule,
      trigger_event: newRuleEvent,
      conditions: {},
      actions: [{ action: newRuleAction }],
      is_active: true,
      last_triggered_at: null,
      execution_count: 0,
      description: newRuleDescription || `Automated ${newRuleAction} on ${newRuleEvent}.`,
    }

    try {
      if (ready) {
        await crmApiRequest({
          path: '/automation-rules',
          method: 'POST',
          body: {
            name: newRule.name,
            trigger_module: newRule.trigger_module,
            trigger_event: newRule.trigger_event,
            actions: newRule.actions,
            conditions: newRule.conditions,
          },
          context,
        })
      }
      setRules((prev) => [newRule, ...prev])
      setShowCreateModal(false)
      setNewRuleName('')
      setNewRuleDescription('')
      toast({
        title: 'Rule Created',
        description: `Automation rule "${newRule.name}" is now active.`,
        variant: 'success',
      })
    } catch {
      setRules((prev) => [newRule, ...prev])
      setShowCreateModal(false)
    }
  }

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (moduleFilter !== 'all' && r.trigger_module !== moduleFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = r.name.toLowerCase().includes(q)
        const matchDesc = r.description?.toLowerCase().includes(q) ?? false
        const matchTrigger = r.trigger_event.toLowerCase().includes(q)
        if (!matchName && !matchDesc && !matchTrigger) return false
      }
      return true
    })
  }, [rules, moduleFilter, searchQuery])

  const stats = useMemo(() => {
    const total = rules.length
    const active = rules.filter((r) => r.is_active).length
    const totalExecutions = rules.reduce((acc, r) => acc + (r.execution_count || 0), 0)
    return { total, active, totalExecutions }
  }, [rules])

  return (
    <div className="@container mx-auto max-w-6xl space-y-6 p-4 @xl:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Sales & Marketing Automation Rules
            </h1>
            <Badge variant="navy" className="gap-1">
              <Zap className="size-3" /> Event Driven
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Trigger autonomous AI agents, SDR dispatch queues, and health checks seamlessly as records move through the revenue lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRules}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            Create Rule
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Rules</span>
            <Workflow className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pipeline & lifecycle automation</p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-medium uppercase tracking-wider">Active Triggers</span>
            <Zap className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
            {stats.active} / {stats.total}
          </p>
          <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/80">Listening for database events</p>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-primary">
            <span className="text-xs font-medium uppercase tracking-wider">Total Automated Executions</span>
            <Sparkles className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.totalExecutions}</p>
          <p className="mt-1 text-xs text-muted-foreground">AI agents and tasks executed</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search automation rules by name, trigger event, or description..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Modules</option>
            <option value="signal">Signals</option>
            <option value="lead">Leads</option>
            <option value="opportunity">Opportunities</option>
            <option value="campaign">Campaigns</option>
          </select>
        </div>
      </div>

      {/* Rules List */}
      <div className="grid gap-3">
        {filteredRules.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-xl border p-4 transition-all shadow-sm ${
              rule.is_active
                ? 'border-border/80 bg-card hover:border-primary/40'
                : 'border-border/40 bg-muted/20 opacity-75'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={rule.is_active ? 'success' : 'muted'} className="gap-1">
                    {rule.is_active ? <Zap className="size-3" /> : <Pause className="size-3" />}
                    {rule.is_active ? 'Active' : 'Paused'}
                  </Badge>

                  <Badge variant="outline" className="text-[11px] uppercase tracking-wider font-mono">
                    {rule.trigger_module}
                  </Badge>

                  <span className="text-xs font-mono text-primary font-medium">
                    {rule.trigger_event}
                  </span>

                  {rule.execution_count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ? {rule.execution_count} execution(s)
                    </span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-foreground">
                  {rule.name}
                </h3>

                {rule.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {rule.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="font-medium text-foreground">Actions:</span>
                  {rule.actions.map((act, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground"
                    >
                      <Bot className="size-3 text-primary" />
                      {act.action}
                    </span>
                  ))}
                  {rule.last_triggered_at && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Last triggered: {new Date(rule.last_triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                <Button
                  size="sm"
                  variant={rule.is_active ? 'outline' : 'default'}
                  onClick={() => handleToggle(rule.id)}
                  disabled={togglingId === rule.id}
                  className="gap-1.5 text-xs h-8"
                >
                  {togglingId === rule.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : rule.is_active ? (
                    <>
                      <Pause className="size-3.5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" />
                      Activate
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create Automation Rule */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-foreground">New Automation Rule</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground">Rule Name *</label>
                <Input
                  required
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="e.g. Inbound Enterprise Lead Auto-Enrichment"
                  className="mt-1 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Trigger Module</label>
                  <select
                    value={newRuleModule}
                    onChange={(e) => setNewRuleModule(e.target.value as any)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="lead">Leads</option>
                    <option value="opportunity">Opportunities & Deals</option>
                    <option value="signal">Market Signals</option>
                    <option value="campaign">Campaigns</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Trigger Event</label>
                  <Input
                    required
                    value={newRuleEvent}
                    onChange={(e) => setNewRuleEvent(e.target.value)}
                    placeholder="e.g. lead.created"
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Execution Action</label>
                <select
                  value={newRuleAction}
                  onChange={(e) => setNewRuleAction(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="run_ai_outreach">Draft AI Outreach Sequence</option>
                  <option value="run_deal_coach">Trigger AI MEDDPICC Deal Coach</option>
                  <option value="promote_to_lead">Promote Signal to CRM Lead</option>
                  <option value="assign_territory_sdr">Assign Territory SDR</option>
                  <option value="flag_deal_health">Flag Deal Health Warning</option>
                  <option value="create_draft_sales_order">Create Draft Sales Order</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Description</label>
                <textarea
                  rows={3}
                  value={newRuleDescription}
                  onChange={(e) => setNewRuleDescription(e.target.value)}
                  placeholder="Explain when and why this rule executes..."
                  className="mt-1 w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="gap-1.5 text-xs">
                  <Sparkles className="size-3.5" />
                  Save & Activate
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

