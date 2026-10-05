'use client';

/**
 * What one module has to declare to get an AI Stack.
 *
 * WHY THIS TYPE EXISTS
 *
 * Fees, Attendance, Admission and Student each have nine hand-written AI Stack screens,
 * and comparing any two of them shows the same file with a module name substituted: the
 * same client calls, the same endpoints, the same tables, the same empty states. That was
 * defensible while three modules had proved the shape; it is not a thing to do five more
 * times.
 *
 * So the screens in this folder take an `AiStackModule` and render from it. A module gets
 * the whole stack by declaring one of these — the nine screens are shared, and what
 * differs between modules is data and words, which is what a declaration is for.
 *
 * WHAT IS DECLARED HERE AND WHAT IS LOOKED UP
 *
 * Declared: the module's key, how it is named in prose, the filters its report accepts,
 * the tool agents worth offering, and the handful of sentences that are genuinely
 * different because the modules are genuinely different — what a hostel report may not
 * claim is not what an exam report may not claim.
 *
 * Looked up, always, at runtime: every record. Policies come from `ai_policies`, prompts
 * and layouts from `ai_templates`, usage from `ai_conversations`, refusals from
 * `ai_generation_requests`, the ledger from `ai_audit_logs`, agents from the Agent
 * Management engine. Nothing in a descriptor is a record, an id, a count or a name from
 * the school's data, and nothing in one may become so.
 *
 * WHY THE FOUR EXISTING STACKS ARE NOT PORTED ONTO THIS
 *
 * Because they work, and a working module is not improved by being folded into an
 * abstraction on the way past. This type was extracted from them rather than imposed on
 * them: every field below exists because one of those four screens needed it. When one of
 * the four is next worked on, it can adopt this by writing a descriptor and deleting a
 * folder — and until somebody chooses to do that, Fees and Attendance keep behaving
 * exactly as they do today, which is the requirement.
 */

import type { CreateAgentInput } from '@/lib/agents/types';

/** One filter the module's report-build panel offers, and the tool argument it fills. */
export interface AiStackReportFilter {
  /** The argument name the bound read tool accepts. Never invented — see the tool's schema. */
  key: string;
  label: string;
  /** `number` sends a positive integer or omits itself; `text` sends a trimmed string. */
  kind: 'number' | 'text' | 'boolean';
  placeholder?: string;
  hint?: string;
  /** Booleans are always sent, because omitting one means the layout's own default. */
  defaultValue?: string | boolean;
}

/**
 * The backend domain agent a module is bound to in `config/ai.php`, when it has one.
 *
 * Null is a real and common answer, and the Automations tab says so rather than showing
 * an empty panel: a module with no manifest cannot open a case, and the reason belongs on
 * the screen where somebody is looking for the button.
 */
export interface AiStackBoundAgent {
  /** The `ai_agents` key, e.g. `k12_academic_risk`. */
  agentKey: string;
  /** The workflow that manifest may put a recommendation to. */
  workflowKey: string;
  /** What the panel calls it, when the manifest itself has no name. */
  fallbackName: string;
  /** The `runAgent` filters this manifest actually reads. Offering others would be a lie. */
  filters: Array<{ key: 'limit' | 'subject_id'; label: string; placeholder?: string }>;
  /** What one sweep is for, in one line, shown on the stage trace. */
  sweepDescription: string;
}

/** How one AI Stack operation is described in the ledger. */
export interface AiStackOperationSpec {
  key: string;
  label: string;
  /** An `ai_modules` capability flag, or null when the operation used no AI. */
  capability: 'conversational' | 'generative' | 'agent' | 'workflow' | 'ontology' | null;
  /** Which kind of AI Stack record to resolve for it. `none` is a real answer. */
  uses: 'report_template' | 'prompt' | 'agent' | 'none';
  /** Preference when several records of the right kind are published. Never a requirement. */
  prefers?: string[];
}

export interface AiStackModule {
  /**
   * The `ai_modules` key. Every call on every tab is scoped by it, and it is the only
   * thing that makes a saved policy, prompt, template or ledger row belong to this module.
   */
  key: string;

  /**
   * The level-2 menu slug, which is what `fees_menu_categories.module_name` carries and
   * what the shared category route is addressed by.
   *
   * It is not always the same word as `key` and does not have to be: a route is how a URL
   * is recognised, not what a module is called. `student-request` is the slug; the module
   * is keyed `student_request`.
   */
  menuSlug: string;

  /** The module as a heading names it: "Exam", "PTM", "Hostel", "Circular". */
  label: string;

  /** The module's records in prose, plural: "exam results", "hostel allocations". */
  records: string;

  /** One record: "exam result", "hostel allocation". */
  record: string;

  /**
   * The route the AI Stack reports itself as when it builds a report.
   *
   * `/api/ai/workspace/*` resolves which module a call belongs to from the route it is
   * given, so a report built from this screen has to say where it was built from. Declared
   * once here rather than typed into a screen, because a typo resolves to the general
   * module and the call comes back "this page is not a module a report can be built from"
   * with nothing to suggest why.
   */
  route: string;

  /** The entity a ledger row is about, e.g. `exam_result`, `booking`, `circular`. */
  subjectEntityKey: string;

  /** The sentences that are genuinely different because the modules are different. */
  copy: {
    /**
     * The one thing this module's AI must never do, in a sentence.
     *
     * Shown on Guardrails as the module's central risk and on Policies as the reason a
     * policy is worth writing. It is not decoration: a guardrails screen that did not name
     * the module's own risk would be describing a different module.
     */
    centralRisk: string;
    /** The example a policy name field shows. Never a real policy. */
    policyNamePlaceholder: string;
    /** What a new prompt starts with — the standing instruction hardest to remember. */
    promptSystemDefault: string;
    /** What a report can print that a prompt may not, for the Prompts tab's hint. */
    reportCanPrint: string;
    /** What the module's answers rest on when no document is indexed. */
    groundedOn: string;
    /** Capability wording for `agent`, when the module has no manifest of its own. */
    capabilityAgent: string;
    /** Capability wording for `workflow`. */
    capabilityWorkflow: string;
  };

  /** The read tool a report is built from, and the filters that panel offers. */
  report: {
    /** Shown as the hint when no layout is published yet. */
    defaultDataSource: string;
    filters: AiStackReportFilter[];
    /** The operation key recorded when a report is built from this tab. */
    operation: string;
    /** What an empty result means, said plainly rather than shown as a blank report. */
    emptyNote: string;
  };

  /**
   * Tool agents offered as one button each.
   *
   * Each is exactly the `CreateAgentInput` the Create Agent form would submit. Enabling
   * one writes an ordinary agent that then behaves like any other; there is no second
   * mechanism here, and every tool named must be in this module's catalogue in
   * `lib/agents/registry.ts` or the server refuses the create.
   */
  presets: CreateAgentInput[];

  /** The backend domain agent this module is bound to, or null when it has none. */
  boundAgent: AiStackBoundAgent | null;

  /**
   * Why the module has no bound agent, in the words `config/ai.php` uses.
   *
   * Required when `boundAgent` is null, because "there is no agent" is only half an
   * answer and the other half is what that means for the person reading the tab.
   */
  noAgentReason?: string;

  /** The operations this module records, keyed by operation key. */
  operations: Record<string, AiStackOperationSpec>;
}

/** The Laravel permission key this module's tool agents are gated on. */
export function aiStackRbacKey(module: AiStackModule): string {
  return `agents.${module.key}`;
}
