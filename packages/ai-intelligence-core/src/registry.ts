/**
 * The AI & Intelligence capability registry — one description of each capability,
 * shared by every product that consumes it.
 *
 * WHY THIS FILE EXISTS
 *
 * The twelve AI & Intelligence entries began life as a hard-coded array of labels in
 * a header component and a second hard-coded map of routes beside it, most of them
 * pointing at a generic "under construction" placeholder. So the menu knew a name and
 * nothing else: not what the capability is for, not whether it is built, not which
 * products it serves. Nothing else in the codebase could ask.
 *
 * That is the thing standing between these menus and being shared. A menu that is a
 * list of strings can only ever be copied into the next product; a menu that is a
 * list of records can be imported. This file is that list of records, and it lives in
 * `packages/` rather than `lib/` for exactly that reason — it must not depend on any
 * one product's `app/`.
 *
 * ── HOW THIS COPY RELATES TO LMS K-12's ─────────────────────────────────────
 *
 * The capability set is identical, deliberately and permanently: same twelve ids,
 * same slugs, same names, same order, same purpose sentences. That is what makes
 * "AI & Intelligence" one thing across the platform rather than two menus that happen
 * to rhyme, and it is why renaming a capability here without renaming it there would
 * be a bug rather than a divergence.
 *
 * What differs, and must:
 *
 *   `status`      what G2G actually offers today. LMS K-12's copy answers the same
 *                 question about LMS K-12. A capability cannot be marked "coming
 *                 soon" here while this product's own screen for it is live — a
 *                 construction notice over a working feature reads as broken.
 *
 *   `solutions`   the per-product consumption states. G2G's entries are written from
 *                 what this codebase does, not from what another product predicted it
 *                 would do.
 *
 *   `accessLink`  G2G-only. See the field's own note.
 *
 * STATUS IS ABOUT THIS PRODUCT, AND IS NEVER OPTIMISTIC
 *
 * Three words, and each one is a claim someone can check by opening the screen.
 * Never mark something `coming-soon` that already works, and never mark something
 * `live` because its tables exist — `hpbrain_knowledge_assets` exists and holds six
 * rows with no ingestion pipeline behind them, which is why Knowledge & RAG is
 * `in-progress` rather than `live`.
 */

import type { SolutionId } from './solutions'

/**
 * What state a capability is in.
 *
 * Deliberately the same three words a delivery roadmap uses, minus `pilot`, which no
 * AI capability is in.
 */
export type CapabilityStatus = 'live' | 'in-progress' | 'coming-soon'

/** Whether a product consumes this capability today. */
export type ConsumptionState = 'yes' | 'partial' | 'no'

export interface SolutionConsumption {
  /** Whether this product uses the capability today, not whether it should. */
  today: ConsumptionState
  /** What this product asks the capability for, in one sentence. */
  use: string
}

export interface AiCapability {
  /** Stable dotted id. Screens and tests reference this, never the name. */
  id: string
  /** URL segment under `/ai/`. Lowercase, hyphenated, stable — it gets bookmarked. */
  slug: string
  /** The menu label, exactly as it reads in the header. */
  name: string
  /** What the capability is for. One sentence, sentence case. */
  purpose: string
  /** Why it has to be one shared service instead of three implementations. */
  whyCentral: string
  /** What this product does about it today — the current source of truth. */
  todayInG2g: string
  /** What has to be built or moved before another product can call it. */
  toCentralise: readonly string[]
  /** What the platform gains once it is shared. */
  afterCentralisation: readonly string[]
  status: CapabilityStatus
  /**
   * A working screen at a fixed route, for capabilities that have one.
   *
   * Only for routes this application serves directly, such as `/ai/providers`.
   * Anything inside the module shell is reached by `accessLink` instead.
   */
  href?: string
  /**
   * G2G-ONLY: a `tblmenumaster_g2g.access_link`, for a capability whose screen lives
   * inside the module navigation.
   *
   * It is not an `href` because it is not a URL. G2G's module routes are
   * `/module/{moduleId}/{menuId}/{submenuId}` built from menu-row ids, and those ids
   * differ between deployments — hard-coding one would send half the estate to a
   * screen that does not exist. The access link is the stable identifier, and
   * `useSidebarNavigation().resolveAccessLink()` turns it into this user's real path,
   * which also means a capability the signed-in profile has no rights to resolves to
   * nothing rather than to a 404.
   */
  accessLink?: string
  solutions: Record<SolutionId, SolutionConsumption>
}

/**
 * The twelve capabilities, in the order the menu lists them.
 *
 * Registry order is the running order — the menu and the console index both read it,
 * so re-ordering here re-orders every surface at once and nothing sorts at render
 * time behind anyone's back.
 */
export const AI_CAPABILITIES: readonly AiCapability[] = [
  {
    id: 'ai.providers',
    slug: 'providers',
    name: 'AI Providers',
    purpose:
      'The vendor accounts the platform is allowed to call, their credentials, endpoints and health.',
    whyCentral:
      'A key held in three codebases is rotated in three places and leaked from three places. One account, one rotation, one bill.',
    todayInG2g:
      'Live at /ai/providers. Each AI module can be bound to a provider, model and credential in ai_api_keys, and AiConfigurationResolver resolves that binding per call. Credentials are write-only: the screen shows a masked preview, never the key. Before this, every organisation shared one GEMINI_API_KEY from .env.',
    toCentralise: [
      'A provider record store: vendor, endpoint, credential reference, enabled modules. Done — ai_api_keys.',
      'A resolver that hands a caller a ready configuration and never the credential itself. Done — AiConfigurationResolver.',
      'A health and quota probe, so a dead key is visible before a user meets it as a broken answer.',
    ],
    afterCentralisation: [
      'Rotate a credential once and every module follows on its next call.',
      'A provider can be allowed for one organisation and withheld from another.',
      'No module ships a vendor key of its own.',
    ],
    status: 'live',
    href: '/ai/providers',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Assessment, ESO, Recruitment and LMS content AI resolve provider, model and key from the central configuration.',
      },
      lms_k12: {
        today: 'yes',
        use: 'Runs the same resolution over its own credential table.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Would call the shared endpoint with a service token and hold no vendor credential at all.',
      },
    },
  },

  {
    id: 'ai.models',
    slug: 'models',
    name: 'Model Management',
    purpose:
      'Which models exist, what each is approved for, and which one a given capability gets by default.',
    whyCentral:
      'Model management stays central and must never be re-implemented inside a module. Three model catalogues would mean a model retired in one product still serving traffic in another.',
    todayInG2g:
      'Live at /ai/models. The ai_models catalogue is the one list every model dropdown reads, seeded from config/ai.php so nothing that worked before it existed stopped. Platform rows are shared; an organisation may add its own.',
    toCentralise: [
      'A model catalogue keyed by provider, with cost and output ceiling. Done — ai_models.',
      'Default selection per module rather than per product. Done — the model column on a configuration row.',
      'A fallback chain, so a provider outage is absorbed without a code change.',
    ],
    afterCentralisation: [
      'Retire or swap a model once; every module picks up the change on its next request.',
      'Cost per capability becomes answerable, because the model behind it is known.',
    ],
    status: 'live',
    href: '/ai/models',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Model choice is a catalogue row an administrator can read and change, not a constant in config or code.',
      },
      lms_k12: { today: 'yes', use: 'Same catalogue shape over its own rows.' },
      enterprise_brain: {
        today: 'no',
        use: 'Would name a capability and receive whatever model the catalogue designates for it.',
      },
    },
  },

  {
    id: 'ai.prompts',
    // The slug stays `prompts` while the name reads "Template Management". It is the
    // identifier `/ai/prompts` is built from, and renaming the label costs nothing
    // while renaming the slug costs everyone's bookmarks.
    slug: 'prompts',
    name: 'Template Management',
    purpose:
      'Versioned AI templates for every module — Competency, Talent, LMS and the rest — written and managed in one place.',
    whyCentral:
      'A prompt copied into three codebases is three prompts the moment one is improved, and the improvement never reaches the other two. Per-module template screens would be the same mistake one level down.',
    todayInG2g:
      'Live at /ai/prompts. Templates are rows in ai_templates with a module, a version and a status; the screen is the same for every module and the module list comes from ai_modules, which is seeded from tblmenumaster_g2g — so a module this deployment has needs no new screen. Publishing a template against a module also writes its ai_suggestions binding.',
    toCentralise: [
      'A template store with named variables, versions and an active pointer. Done — ai_templates.',
      'Render-time variable binding, so a caller supplies data and never prompt text. Done — substitution is literal and executes nothing.',
      'Moving the prompts still hard-coded in EsoGenerator, CourseQuizGenerator and the Gemini controllers into rows.',
    ],
    afterCentralisation: [
      'Improve a prompt once and every caller gets the better answer.',
      'A regression is rolled back by republishing the previous version instead of by a deploy.',
      'Prompts become reviewable content rather than string literals buried in services.',
    ],
    status: 'live',
    href: '/ai/prompts',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Every module’s AI templates are authored, versioned and bound to their module from one screen.',
      },
      lms_k12: {
        today: 'yes',
        use: 'The same screen over its own modules, and additionally authors report layouts.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Would bind agent and deliberation templates the same way, versioned with the rest.',
      },
    },
  },

  {
    id: 'ai.policies',
    slug: 'policies',
    name: 'AI Policies',
    purpose:
      'What the AI is permitted to do: data handling, redaction, tool limits, and when a human must approve.',
    whyCentral:
      'A policy that only one product enforces is not a policy. Every product touches the same people and the same records, so the rule has to sit where no caller can route around it.',
    todayInG2g:
      'Live at /ai/policies. A policy is a type, a set of switches and the scopes it applies to — whole organisation, module, department, job role, competency, course or individual. Assignments resolve narrowest-first, so a job role’s policy beats a department’s. Enforcement at the call sites is the half still to come.',
    toCentralise: [
      'A policy document per organisation: retention, redaction, and the human-approval threshold. Done — ai_policies and its rules.',
      'Enforcement in the runtime, before a call is made, rather than in each caller.',
      'An overlay so a module can tighten a rule but never loosen it.',
    ],
    afterCentralisation: [
      'One place answers "what is this organisation allowed to send to a model".',
      'A tightened rule takes effect everywhere at once.',
      'Agent runs acquire an approval threshold that bounds them.',
    ],
    status: 'live',
    href: '/ai/policies',
    solutions: {
      g2g: {
        today: 'partial',
        use: 'Policies are authored, scoped and resolvable; the call sites do not consult them yet.',
      },
      lms_k12: {
        today: 'partial',
        use: 'Enforces shared security guards; module policy toggles are designed but locked.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Needs it most: agents act without a human in the loop, so the approval threshold is what bounds them.',
      },
    },
  },

  {
    id: 'ai.agents',
    slug: 'agents',
    name: 'Agent Management',
    purpose: 'The library of agents, what each may do, and the record of what it did.',
    whyCentral:
      'The agent library is G2G’s to contribute. It becomes a shared service beside Enterprise Brain’s automation layer; existing agents move across carrying their module tag so nothing in flight breaks.',
    todayInG2g:
      'Live in the Agentic AI module: agents, runs, tools, workflows and reflection all persist in agentic_* tables, tenant-scoped. This console reports the same rows so an administrator sees agent activity beside every other AI capability.',
    toCentralise: [
      'Offer the library to other products under each caller’s own permissions.',
      'One run history, filterable by product, so an agent’s behaviour is legible across all of them.',
      'Let a saved provider configuration override an agent’s own model, which it does not yet.',
    ],
    afterCentralisation: [
      'An agent is built once and offered to any product, under that product’s permissions.',
      'Agents in flight keep running through the migration.',
      'A misbehaving agent is disabled once, everywhere.',
    ],
    status: 'live',
    accessLink: '/module/agentic-ai/agentic-library',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Owns the library. Agents, runs and traces are G2G records.',
      },
      lms_k12: {
        today: 'partial',
        use: 'Reads a library hosted elsewhere; becomes a first-class caller after the migration.',
      },
      enterprise_brain: {
        today: 'partial',
        use: 'Hosts the automation layer the shared service will sit beside.',
      },
    },
  },

  {
    id: 'ai.conversational',
    slug: 'conversational-ai',
    name: 'Conversational AI',
    purpose:
      'One assistant runtime that knows which product and which module the question came from.',
    whyCentral:
      'Each product registering as an adapter is what keeps one assistant answering in three contexts. An unknown product id is an error rather than a silent fall back to another product’s data.',
    todayInG2g:
      'Live at /ai/conversational-ai. The assistant is served by /api/ai/ask, resolves its provider through the central configuration like every other module, and grounds every answer in figures read live from this organisation. Transcripts are rows in ai_conversations and ai_conversation_turns, with the model and token cost recorded per turn. It holds no per-person data by design: the grounding is counts and taxonomy only.',
    toCentralise: [
      'Move the chat route behind the Laravel AI API so it resolves its provider like every other module. Done — /api/ai/ask.',
      'Give conversations durable storage. Done — they were an in-memory Map, lost on every restart.',
      'Retire the frontend chat route once the assistant panel points at the shared endpoint.',
      'Streaming. The panel waits for a complete answer today.',
    ],
    afterCentralisation: [
      'One assistant, three products, each answering in its own context and permissions.',
      'A new product is an adapter file and a registration, not a second assistant.',
    ],
    status: 'live',
    href: '/ai/conversational-ai',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Serves its own grounded assistant over its own transcripts, on the central provider configuration.',
      },
      lms_k12: {
        today: 'yes',
        use: 'Hosts a runtime and the ask/stream proxy behind its own assistant panel.',
      },
      enterprise_brain: {
        today: 'partial',
        use: 'Declared and configurable, not yet implemented.',
      },
    },
  },

  {
    id: 'ai.knowledge-rag',
    slug: 'knowledge-rag',
    name: 'Knowledge & RAG',
    purpose:
      'The documents each product can ground an answer in, and the retrieval that finds the right passage.',
    whyCentral:
      'Ingestion, chunking and embedding are expensive and identical everywhere. What differs is only which corpus an organisation may read — an access rule, not a reason for three pipelines.',
    todayInG2g:
      'Partly there. hpbrain_knowledge_assets holds curated documents with categories, confidence and reuse counts, and hpbrain_evidence holds the observations behind them. There is no ingestion pipeline and no retrieval contract, so nothing grounds an answer in them automatically.',
    toCentralise: [
      'One ingestion pipeline: source, chunking, embedding, refresh schedule.',
      'Corpora scoped by organisation and by product, so retrieval cannot cross a boundary.',
      'A retrieval contract the runtime calls, so a caller asks a question and never runs a search.',
    ],
    afterCentralisation: [
      'A document is ingested once and grounds answers in whichever product may see it.',
      'Embedding cost is paid once per document rather than once per product.',
      'Answers cite a passage, which is what makes them checkable.',
    ],
    status: 'in-progress',
    solutions: {
      g2g: {
        today: 'partial',
        use: 'Holds knowledge assets and evidence; would ground answers in competency frameworks and role definitions.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would ground answers in circulars, policies and curriculum documents.',
      },
      enterprise_brain: {
        today: 'partial',
        use: 'Would contribute its knowledge screens as the first shared corpora.',
      },
    },
  },

  {
    id: 'ai.recommendations',
    slug: 'recommendations',
    name: 'Recommendation Engine',
    purpose:
      'Turns stored evidence into ranked, explainable recommendations for any module that asks.',
    whyCentral:
      'A recommendation is only trusted if it can be explained, and the explanation is the evidence behind it. Three engines over three evidence stores would produce three different answers about the same person.',
    todayInG2g:
      'Live at /ai/recommendations. The queue is hpbrain_recommendations ordered by confidence, and opening one shows the reasoning step that produced it and the evidence rows behind that — the full explanation chain, not a headline. Approve, reject and defer write the decision and an audit row, and a recommendation that is already decided is refused rather than silently overwritten. What is still missing is a scoring contract any module can call: these are written by one pipeline rather than requested by many.',
    toCentralise: [
      'An approval gate with the explanation attached. Done — /ai/recommendations.',
      'A scoring contract any module can call: evidence in, ranked items out.',
      'Ranking that reads the shared knowledge graph rather than a per-product table.',
      'Per-module thresholds, so a promotion recommendation can require more confidence than a content suggestion does.',
    ],
    afterCentralisation: [
      'Any module asks the same question the same way and gets a comparable answer.',
      'Every recommendation carries its reasons, so it can be challenged.',
      'Improving the ranking improves it for every product at once.',
    ],
    status: 'live',
    href: '/ai/recommendations',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Reviews and decides its own recommendations, each shown with the reasoning and evidence behind it.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would rank interventions and content for a concept.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Would rank the actions surfaced by its signals and deliberation loop.',
      },
    },
  },

  {
    id: 'ai.knowledge-graph',
    slug: 'knowledge-graph',
    name: 'Knowledge Graph',
    purpose: 'The shared evidence store every recommendation and explanation is drawn from.',
    whyCentral:
      'This is the substrate the other capabilities stand on. A person’s learning evidence, their capability record and their signals describe one person; kept apart they describe three.',
    todayInG2g:
      'Partly there. hpbrain_entity_mappings maps this product’s own tables onto a universal entity model — source system, source field, universal entity, universal field — which is the hard half of a shared graph and is already populated. hpbrain_context_entities, the organisation-specific vocabulary, is not.',
    toCentralise: [
      'One entity and relationship model spanning person, capability, role, competency and evidence.',
      'Write contracts, so each product contributes facts without owning the schema.',
      'Tenant isolation in the store itself, not in the callers.',
    ],
    afterCentralisation: [
      'One record of what is known about a person, contributed to by every product.',
      'Recommendations and explanations read the same evidence, so they cannot contradict each other.',
      'A new product gains context on day one instead of starting empty.',
    ],
    status: 'in-progress',
    solutions: {
      g2g: {
        today: 'partial',
        use: 'Contributes the competency taxonomy and the entity mappings that the other products lack.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would contribute learning evidence and read capability context back.',
      },
      enterprise_brain: {
        today: 'partial',
        use: 'Has the graph screens and is the natural host for the shared store.',
      },
    },
  },

  {
    id: 'ai.evaluation',
    slug: 'evaluation',
    name: 'AI Evaluation',
    purpose:
      'Test sets and scores that say whether a prompt or model change made answers better or worse.',
    whyCentral:
      'Once prompts and models are shared, a change ships to every product at once. Evaluation is what makes that safe — without it, centralising raises the blast radius without raising the confidence.',
    todayInG2g:
      'Live at /ai/evaluation, and the one capability here that is not adapted from LMS K-12 — LMS has not built it, so there was nothing to port. An evaluation is a named set of cases against one published template; each case supplies the variables and declares what a correct answer must contain and must not contain. Running it calls the configured provider once per case and scores by assertion, which is deterministic and reproducible rather than a second model grading the first. Per-case verdicts name the assertion that failed. Stored in ai_evaluations and ai_evaluation_cases as rows, not as JSON blobs, so a run can actually be queried.',
    toCentralise: [
      'Named test sets with expected outcomes. Done — ai_evaluations and its cases.',
      'Scoring that is reproducible. Done — assertions at temperature 0, not a model judging a model.',
      'Running a candidate prompt beside the active one and reporting the difference.',
      'A queue, so a run is not synchronous and bounded at 25 cases.',
      'A gate in the release path, so a regression is caught before it is promoted.',
    ],
    afterCentralisation: [
      'A prompt or model change is measured before it reaches an organisation.',
      'Each product contributes the cases it cares about and is protected by all of them.',
      'Regressions become a number rather than a support ticket.',
    ],
    status: 'live',
    href: '/ai/evaluation',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Scores its own templates against its own cases before a prompt change reaches anyone.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would contribute curriculum, fees and admissions cases.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Would contribute agent-behaviour cases, which is where an unmeasured regression costs most.',
      },
    },
  },

  {
    id: 'ai.usage-cost',
    slug: 'usage-cost',
    name: 'Usage & Cost',
    purpose: 'What each product, organisation and module spent on AI, and against which quota.',
    whyCentral:
      'The bill arrives as one number from the provider. Attributing it is only possible where the calls are counted, which is the same place the quota has to be enforced.',
    todayInG2g:
      'Live at /ai/usage-cost. Metered inside AiModelClient, which is the only place this layer calls a model, so a call cannot spend without being counted — the previous panel read hpbrain_ai_executions, a table another application writes, and therefore reported zero while real calls were billed. Every call lands in ai_usage_events with its module, provider, model, token counts, latency, the precedence step that chose the credential, and its outcome; failures and quota refusals are recorded too. Broken down by module, by model and by day. Quotas are checked before the request is sent, so a runaway is refused rather than invoiced.',
    toCentralise: [
      'Metering at one point, tagged with organisation and module, so no caller can skip it. Done — AiUsageMeter.',
      'Quotas per organisation and per module, enforced before the call. Done.',
      'Cost per call. Done, but only where a rate exists — ai_models rates are null until somebody enters them, so the money column is honestly blank rather than estimated.',
      'Bringing the legacy callers (DeepSeekService, the Gemini controllers, the frontend chat route) through the same client, so their spend is counted too.',
      'Alerts, so passing a warning threshold reaches somebody who is not looking at this screen.',
    ],
    afterCentralisation: [
      'One provider bill is attributable to an organisation, a module and a model.',
      'A runaway agent hits a quota instead of an invoice.',
      'Cost per capability informs which model each capability should get.',
    ],
    status: 'live',
    href: '/ai/usage-cost',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Meters every call this layer makes, attributes it by module and model, and enforces its own token quotas.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would see spend per module and per school, and enforce a per-tenant quota.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Would meter agent runs, which are the least predictable spend of the three.',
      },
    },
  },

  {
    id: 'ai.audit',
    slug: 'audit',
    name: 'AI Audit',
    purpose:
      'The record of every AI call: who asked, what was sent, which model answered, which tools ran.',
    whyCentral:
      'An audit trail split across products cannot answer the one question it exists for — what did the system do about this person. It also has to be written where a caller cannot skip it.',
    todayInG2g:
      'Live for configuration. Every change made through AI & Intelligence — a credential, a model, a template, a policy — is written to ai_audit_logs with its actor, its outcome and a redacted payload, and is readable at /ai/audit. Model calls themselves are not traced there yet; those are in hpbrain_ai_executions and the agent run log.',
    toCentralise: [
      'One append-only record written by the runtime, not by callers.',
      'Redaction applied on write, so the trail does not become a second copy of the sensitive data. Done — AiAuditLogger redacts on write.',
      'Retention per the organisation’s policy, and a search that can be shown to an auditor.',
    ],
    afterCentralisation: [
      'One place answers what the AI did for a given person or organisation.',
      'The approval trail has somewhere to be written.',
      'Every product inherits auditability without implementing any of it.',
    ],
    status: 'live',
    solutions: {
      g2g: {
        today: 'partial',
        use: 'Every AI configuration change is traced; model calls are recorded elsewhere and not yet joined to it.',
      },
      lms_k12: {
        today: 'partial',
        use: 'Conversational calls are traced; nothing else is.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Needs it most: an agent acting unattended is exactly what an audit trail is for.',
      },
    },
  },
]
