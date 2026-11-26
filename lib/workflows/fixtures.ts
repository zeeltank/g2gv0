/**
 * Test data for the Automations and Runs tabs: a catalog with a few events and actions as the server sends them (some actions with typed parameter lists,
 * some with the older descriptions in words), workflows, recipes and runs. Not used by the screens.
 */
import type {
  GtmWorkflow, RunDetail, WorkflowCatalog, WorkflowHealth, WorkflowRecipe, WorkflowRunRow,
} from '../../services/gtm/workflows'

const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'empty', 'not_empty']

export function catalog(): WorkflowCatalog {
  return {
    operators: OPS,
    notes: ['A workflow reacts only to events recorded after it is activated.'],
    triggers: {
      'crm.lead.created': {
        label: 'CRM lead created (signal promotion, manual, import or web form)',
        entity: 'crm_leads',
        provides: ['lead'],
        fields: {
          'lead.company': { type: 'string', label: 'Lead company' },
          'lead.has_email': { type: 'bool', label: 'Lead has an email' },
          'lead.missing_count': { type: 'number', label: 'Details missing' },
          'lead.status': { type: 'enum', label: 'Lead status', options: ['New', 'Not Contacted', 'Qualified'] },
        },
      },
      'crm.lead.reply_classified': {
        label: 'Lead reply classified (interested, needs information, ...)',
        entity: 'crm_leads',
        provides: ['lead'],
        fields: {
          'lead.company': { type: 'string', label: 'Lead company' },
          'event.confidence': { type: 'number', label: 'Confidence' },
          'event.classification': { type: 'enum', label: 'Reply type', options: ['interested', 'meeting_requested', 'not_interested'] },
        },
      },
      'crm.opportunity.stage_changed': {
        label: 'Opportunity sales stage changed',
        entity: 'crm_opportunities',
        provides: ['opportunity'],
        fields: {
          'opportunity.amount': { type: 'number', label: 'Deal amount' },
          'opportunity.name': { type: 'string', label: 'Opportunity name' },
          'event.to': { type: 'string', label: 'Moved to stage' },
        },
      },
      'gtm.deal.created': {
        label: 'Deal created',
        entity: 'gtm_deals',
        provides: ['deal', 'account'],
        fields: { 'deal.amount': { type: 'number', label: 'Deal amount' } },
      },
    },
    actions: {
      // typed parameters, as the server sends them now
      add_lead_note: {
        label: 'Add a note to the lead',
        needs: ['lead'],
        consequential: false,
        description: 'Adds an "[Automation]" comment.',
        params: { text: 'text, required, supports {{field}}' },
        param_fields: [{ key: 'text', label: 'Note', type: 'text', required: true }],
      },
      create_lead_task: {
        label: 'Create a follow-up task for the lead',
        needs: ['lead'],
        consequential: false,
        description: 'Schedules a calendar task.',
        params: { title: 'text, required', due_in_days: 'whole number 0-90, optional', link_to: 'lead | organization | opportunity', only_if_empty: 'true | false' },
        param_fields: [
          { key: 'title', label: 'Task title', type: 'string', required: true },
          { key: 'due_in_days', label: 'Due in days', type: 'number', required: false, min: 0, max: 90 },
          { key: 'link_to', label: 'Attach it to', type: 'enum', required: false, options: ['lead', 'organization', 'opportunity'] },
          { key: 'only_if_empty', label: 'Only when nothing is set', type: 'bool', required: false },
        ],
      },
      book_lead_meeting: {
        label: 'Hold the first proposed time on the owner’s calendar',
        needs: ['lead'],
        consequential: true,
        description: 'Consequential.',
        params: {},
        param_fields: [],
      },
      convert_lead: {
        label: 'Convert the lead (Organization + Contact + Opportunity)',
        needs: ['lead'],
        consequential: true,
        description: 'Runs the conversion.',
        params: { create_opportunity: 'true | false' },
        param_fields: [{ key: 'create_opportunity', label: 'Also create an opportunity', type: 'bool', required: false }],
      },
      create_support_onboarding: {
        label: 'Open a support onboarding ticket for the customer',
        needs: [],
        consequential: false,
        description: 'Opens one ticket.',
        params: { title: 'text, required', assign_to_user_id: 'whole number, required' },
        param_fields: [
          { key: 'title', label: 'Ticket title', type: 'string', required: true },
          { key: 'assign_to_user_id', label: 'Assign to', type: 'user', required: true },
        ],
      },
      // the older shape: descriptions in words
      set_next_step: {
        label: 'Set the deal’s next step',
        needs: ['deal'],
        consequential: false,
        description: 'Writes the next step.',
        params: { text: 'text, required, supports {{field}}', due_in_days: 'whole number 0-365, optional', only_if_empty: 'true | false (default true)' },
      },
      run_agent: {
        label: 'Run a GTM agent',
        needs: [],
        consequential: false,
        description: 'Runs an agent.',
        params: { agent: 'gtm-outreach | gtm-account', input: 'object: each value is a fixed value or "@field"', save_drafts: 'true | false (Outreach agent only)' },
      },
      // an action the server has not sent typed parameters for: the screen reads the words, and `params` is all there is
      run_agent_typed: {
        label: 'Run a GTM agent (typed)',
        needs: [],
        consequential: false,
        description: 'Runs an agent.',
        params: { agent: 'gtm-outreach | gtm-account', input: 'object' },
        param_fields: [
          { key: 'agent', label: 'Agent', type: 'enum', required: true, options: ['gtm-outreach', 'gtm-account'] },
          { key: 'input', label: 'What to give the agent', type: 'text', format: 'json', required: false },
        ],
      },
      assign_lead_round_robin: {
        label: 'Assign the lead by the round-robin rotation',
        needs: ['lead'],
        consequential: false,
        description: 'Assigns the lead.',
        params: {},
        param_fields: [],
      },
    },
  }
}

export function workflow(over: Partial<GtmWorkflow> = {}): GtmWorkflow {
  return {
    id: 1,
    name: 'Book a meeting when the reply is positive',
    description: null,
    trigger_event: 'crm.lead.reply_classified',
    trigger_label: 'Lead reply classified',
    conditions: [{ field: 'event.classification', op: 'eq', value: 'meeting_requested' }],
    actions: [{ type: 'book_lead_meeting', params: {} }],
    requires_approval: 0,
    max_runs_per_day: 100,
    status: 'active',
    activated_at: '2026-11-20 09:00:00',
    created_at: '2026-11-19 09:00:00',
    updated_at: '2026-11-20 09:00:00',
    runs_7d: [],
    ...over,
  }
}

export function recipe(over: Partial<WorkflowRecipe> = {}): WorkflowRecipe {
  return {
    key: 'lead-first-contact',
    title: 'Plan the first contact with a new lead',
    sentence: 'When a lead is created, add a note to the lead, then create a follow-up task.',
    trigger: 'crm.lead.created',
    trigger_label: 'CRM lead created',
    actions: [{ type: 'add_lead_note', label: 'Add a note to the lead' }, { type: 'create_lead_task', label: 'Create a follow-up task for the lead' }],
    consequential: false,
    requires_approval: false,
    installed_workflow_id: null,
    ...over,
  }
}

export function health(over: Partial<WorkflowHealth> = {}): WorkflowHealth {
  return {
    state: 'running',
    last_tick_at: '2026-11-26 09:57:00',
    last_events_at: '2026-11-26 09:50:00',
    expected_every_minutes: 10,
    message: 'Checked about every 10 minutes. Last check 3 minutes ago.',
    ...over,
  }
}

export function run(over: Partial<WorkflowRunRow> = {}): WorkflowRunRow {
  return {
    id: 10,
    workflow_id: 1,
    workflow_name: 'Book a meeting when the reply is positive',
    event_type: 'crm.lead.reply_classified',
    entity_type: 'crm_leads',
    entity_id: 12,
    status: 'succeeded',
    error: null,
    attempts: 1,
    next_attempt_at: null,
    decision_note: null,
    created_at: '2026-11-26 08:00:00',
    finished_at: '2026-11-26 08:01:00',
    ...over,
  }
}

export function runDetail(over: Partial<RunDetail['run']> = {}, steps: RunDetail['steps'] = []): RunDetail {
  return {
    run: {
      ...run(),
      context: { trace: [{ field: 'event.classification', op: 'eq', expected: 'meeting_requested', actual: 'meeting_requested', pass: true }] },
      decided_at: null,
      started_at: '2026-11-26 08:00:30',
      ...over,
    },
    workflow: { id: 1, name: 'Book a meeting when the reply is positive', trigger_event: 'crm.lead.reply_classified', status: 'active' },
    steps,
  }
}
