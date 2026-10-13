'use client';

import { BookMarked, Cpu, FileText, Gauge, History, LayoutList, ShieldAlert, ShieldCheck, SlidersHorizontal, Terminal, Workflow } from 'lucide-react';

import type { ModuleStaticScreen } from './ai-stack-host';

import { AiStackWithExample } from './example-card';
import { AiStackActivityScreen } from './activity-screen';
import { AiStackApprovalsScreen } from './approvals-screen';
import { AiStackAutomationsScreen } from './automations-screen';
import { AiStackGuardrailsScreen } from './guardrails-screen';
import { AiStackKnowledgeBaseScreen } from './knowledge-base-screen';
import { AiStackPageExamplesScreen } from './page-examples-screen';
import { AiStackModelsScreen } from './models-screen';
import { AiStackPoliciesScreen } from './policies-screen';
import { AiStackPromptsScreen } from './prompts-screen';
import { AiStackTemplatesScreen } from './templates-screen';
import { AiStackUsageCostScreen } from './usage-cost-screen';
import type { AiStackModule } from './ai-stack-module';

/**
 * The nine AI Stack tabs, for any module.
 *
 * ALL NINE ARE LIVE, AND ALL NINE ARE SCOPED TO ONE MODULE
 *
 * Each renders its own shared screen with this module's descriptor, and each is
 * decentralised in the sense that matters to the person using it: it shows only this
 * module's configuration, and a save from it cannot be filed against another module. The
 * module is never a control the operator can reach — it is a parameter this file supplies
 * and no form offers.
 *
 * DECENTRALISED IS NOT DUPLICATED
 *
 * There is no second AI stack inside any module. Every screen calls the same client, the
 * same endpoint and the same table as the central AI console, scoped to the module's key:
 *
 *   Policies       → ai_policies with a `module` assignment
 *   Models         → ai_module_model_bindings for this module, beside the resolution
 *                    the module's next call will actually get
 *   Prompts        → ai_templates, this module_key, kind = prompt
 *   Templates      → ai_templates, this module_key, kind = report
 *   Knowledge Base → the module's read-only MCP tools, from the backend tool registry
 *   Automations    → the module's bound agent, if any, plus the central Agent Management
 *                    engine scoped to this module
 *   Usage & Cost   → ai_conversations.module_key, this module's generations, the quota
 *   Guardrails     → the five places a guardrail is actually enforced
 *   Activity       → ai_audit_logs rows under `module.<key>.*`
 *
 * So a change to any of those contracts breaks the central screen and every module's at
 * compile time, rather than leaving one quietly wrong. No table, column or store was added
 * to make these tabs module-specific — every module filter is a column the schema already
 * had.
 *
 * NO TAB DOES ANOTHER TAB'S JOB. Prompts and Templates are both `ai_templates` rows split
 * by `kind`, because a prompt is text sent to a model and a report is a layout filled from
 * records. Guardrails reads what the other tabs configure and offers no second place to
 * change it.
 *
 * MODELS WRITES, AND NOTHING IT WRITES LEAVES THE MODULE
 *
 * Fees once removed its Models tab, and Attendance, Admission and Student made theirs
 * read-only mirrors with links out, on the reasoning that a per-module model editor is a
 * second place to change one estate-wide setting. That was wrong about what is being
 * edited. A module choosing its own model is not a second way to write the estate's
 * default — it is a different setting with a different scope, and the two now live in
 * different tables:
 *
 *   this tab            `ai_module_model_bindings` — product module × capability.
 *                       "When Fees makes a conversational call, use this model."
 *   AI & Intelligence   `ai_api_keys` and `ai_models` — capability, estate-wide.
 *                       "Conversational AI runs on this provider by default."
 *
 * So neither console can move the other's row, and a module with no binding inherits the
 * estate default exactly as before. All four hand-written stacks now mount this same
 * screen, so no module's Models tab navigates to AI & Intelligence — the decentralised
 * stack is finished inside the module it belongs to.
 */
export function buildAiStackScreens(module: AiStackModule): ModuleStaticScreen[] {
  return [
    {
      // Live. `ai_policies` rows carrying a `module` assignment for this module, plus a
      // read-only view of the caller's own `agents.<module>` rights — because "what may the
      // AI do" and "who may make it do that" are the two halves of one question and only
      // the first of them is a policy.
      id: 'policies',
      label: 'Policies',
      icon: SlidersHorizontal,
      render: () => (
        <AiStackWithExample module={module} tab="policies">
          <AiStackPoliciesScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live, and it writes — to this module's binding, never to the central tables.
      // See the note above.
      id: 'models',
      label: 'Models',
      icon: Cpu,
      render: () => (
        <AiStackWithExample module={module} tab="models">
          <AiStackModelsScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live. `ai_templates` rows for this module with `kind = 'prompt'` — the other half
      // of the store Templates reads.
      id: 'prompts',
      label: 'Prompts',
      icon: Terminal,
      render: () => (
        <AiStackWithExample module={module} tab="prompts">
          <AiStackPromptsScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live. The module's own report layouts, and the place a report is built from one.
      // Preview, edit, print and send all happen on `/ai-reports/{id}`, which the build
      // hands you a link to rather than reimplementing.
      id: 'templates',
      label: 'Templates',
      icon: FileText,
      render: () => (
        <AiStackWithExample module={module} tab="templates">
          <AiStackTemplatesScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live. The read-only MCP tools the assistant draws on for this module, plus the
      // indexed documents, each checkable against real records.
      id: 'knowledge-base',
      label: 'Knowledge Base',
      icon: BookMarked,
      render: () => (
        <AiStackWithExample module={module} tab="knowledge-base">
          <AiStackKnowledgeBaseScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live. The bound agent, when the module has one — the same manifest the chatbot runs,
      // with its run log, its cases and its approval queue — above the tool agents on the
      // central Agent Management engine, scoped to this module.
      id: 'automations',
      label: 'Automations',
      icon: Workflow,
      render: () => (
        <AiStackWithExample module={module} tab="automations">
          <AiStackAutomationsScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live. Aggregated from ai_conversations.module_key, this module's generations and
      // the resolved credential's quota. Cost is measured or blank, never estimated.
      id: 'usage-cost',
      label: 'Usage & Cost',
      icon: Gauge,
      render: () => (
        <AiStackWithExample module={module} tab="usage-cost">
          <AiStackUsageCostScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live. Reads the guardrails from the five places they are enforced, and lists the
      // requests they refused.
      id: 'guardrails',
      label: 'Guardrails',
      icon: ShieldAlert,
      render: () => (
        <AiStackWithExample module={module} tab="guardrails">
          <AiStackGuardrailsScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live. The execution ledger: what ran in this module, which AI record it used, who
      // did it and how it ended. `ai_audit_logs` rows under `module.<key>.*`.
      id: 'activity',
      label: 'Activity',
      icon: History,
      render: () => (
        <AiStackWithExample module={module} tab="activity">
          <AiStackActivityScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live. The approval ledger (`ai_action_requests`): every action the assistant proposed
      // from this module's screens, its decision and its outcome.
      id: 'approvals',
      label: 'Approvals',
      icon: ShieldCheck,
      render: () => (
        <AiStackWithExample module={module} tab="approvals">
          <AiStackApprovalsScreen module={module} />
        </AiStackWithExample>
      ),
    },
    {
      // Live. One worked example for EVERY PAGE of the module, from that page's own data - what the page is
      // for, the real records behind it, how to use the AI Stack with it, and buttons that really do it.
      id: 'examples',
      label: 'Examples by page',
      icon: LayoutList,
      render: () => <AiStackPageExamplesScreen module={module} />,
    },
  ];
}
