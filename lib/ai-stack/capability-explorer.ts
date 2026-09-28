import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';

/**
 * AI Stack for Capability Intelligence › Capability Explorer.
 *
 * The Explorer screen itself embeds the external ontology graph service; what G2G holds
 * for this module is `hpbrain_entity_mappings` — how the organisation's source records map
 * onto the shared knowledge graph's universal entities. That is a data mapping, not a
 * model call, which is why this module has no AI consumer of its own (no
 * `ai_modules.registry_keys`). Report source: `capability.entity_mappings`.
 */
export const capabilityExplorerAiStack: AiStackModule = {
  key: 'capability_explorer',
  menuSlug: 'capability-explorer',
  label: 'Capability Explorer',
  records: 'entity mappings',
  record: 'entity mapping',
  route: '/module/capability-intelligence/capability-explorer',
  subjectEntityKey: 'entity_mapping',

  copy: {
    centralRisk:
      'reading the reference graph as organisational fact. The graph shown on the Explorer is an example ontology, not this organisation\'s mapping, and no answer may present it as describing this organisation\'s employees or roles.',
    policyNamePlaceholder: 'Knowledge graph use policy',
    promptSystemDefault:
      'You explain entity mappings to an auditor. State only the source system, source field, universal entity and universal field of the rows you are given, and never describe the reference ontology as this organisation\'s own data.',
    reportCanPrint: 'every mapping row comes from hpbrain_entity_mappings itself rather than from a model.',
    groundedOn: 'the entity mapping records above — which source field maps to which universal field.',
    capabilityAgent:
      'No agent manifest is bound to the Capability Explorer. The tool agent on the Automations tab still reads the entity mappings.',
    capabilityWorkflow: 'No workflow is bound to the Capability Explorer, so nothing here pauses for an approval.',
  },

  report: {
    defaultDataSource: 'capability.entity_mappings',
    filters: [
      { key: 'universal_entity', label: 'Universal entity', kind: 'text', placeholder: 'e.g. Person' },
      { key: 'source_system', label: 'Source system', kind: 'text', placeholder: 'e.g. erp' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'entity_mapping_report',
    emptyNote: 'No entity mappings matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Entity mapping reader',
      description: "Reads how the organisation's source records map onto the knowledge graph's universal entities. Changes nothing.",
      module: 'capability_explorer',
      tools_allowed: ['capability.entity_mappings'],
      instructions: 'Report mappings exactly as recorded, one source field to one universal field. Never extend a mapping by analogy.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Entity mappings are readable, but G2G has no domain agent or approval workflow for the Capability Explorer — the agent here is the read-only tool agent below, which runs in G2G Agentic AI.',

  operations: {
    entity_mapping_report: { key: 'entity_mapping_report', label: 'Entity mapping audit', capability: 'ontology', uses: 'report_template', prefers: ['mapping'] },
    mapping_note: { key: 'mapping_note', label: 'Entity mapping explained', capability: 'generative', uses: 'prompt', prefers: ['mapping'] },
    capability_explorer_agent_run: { key: 'capability_explorer_agent_run', label: 'Capability Explorer agent run', capability: 'agent', uses: 'agent' },
  },
};
