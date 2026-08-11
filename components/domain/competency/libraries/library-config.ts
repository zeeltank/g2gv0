import {
  Brain,
  Briefcase,
  EyeOff,
  Heart,
  ListChecks,
  Smile,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import type { LibraryTabId } from '@/services/competency'

/**
 * How one column behaves across the table, the form and the detail panel.
 *
 * The eight library tabs sit on eight different tables with different columns,
 * so rather than eight near-identical screens each tab is described once here
 * and rendered by the same generic components.
 */
export interface LibraryFieldDef {
  key: string
  label: string
  /** Editor to render in the create/edit form. Defaults to a single-line input. */
  type?: 'text' | 'textarea' | 'select' | 'url'
  /** Fixed choices for `type: 'select'`. Taxonomy-driven fields use `taxonomy` instead. */
  options?: string[]
  required?: boolean
  /** Show as a table column. */
  column?: boolean
  /** Tailwind width class for the column. */
  width?: string
  /** Hide from the detail panel (used for fields already shown in its header). */
  hideInDetail?: boolean
  /** Hide from the create/edit form (server-owned columns). */
  readOnly?: boolean
  /** Options come from this tab's taxonomy rather than a static list. */
  taxonomy?: 'category' | 'sub_category'
  /**
   * Options come from the tenant's live data (library metadata) rather than a
   * fixed list. Free-typing these columns is how the same department ends up
   * spelled three ways and how a job role task gets filed against a role that
   * does not exist.
   *
   * `jobroles` is enforced as a strict choice - the value has to match a real
   * role name exactly or the Add Task drawer will never find the task. The
   * others suggest known values but still accept a new one, so the first
   * skill in a brand new department is still possible.
   */
  source?:
    | 'departments'
    | 'sub_departments'
    | 'micro_categories'
    | 'industries'
    | 'jobroles'
    | 'related_skills'
    | 'job_titles'
    | 'learning_resources'
    | 'proficiency_levels'
    | 'task_types'
    | 'invisible_types'
  placeholder?: string
  /** Rendered under the field in the form. */
  help?: string
  /**
   * Show in the form's collapsed "More details" section.
   *
   * The Skill tab alone has twenty-one columns. Presenting all of them at once
   * to add one skill buries the four that actually matter, so anything not
   * needed to create a usable row lives behind a disclosure.
   */
  advanced?: boolean
}

/** Re-exported so a tab config and the grid agree on the vocabulary. */
export type LibraryShape = 'hexagon' | 'circle' | 'triangle' | 'card'

export interface LibraryTabConfig {
  id: LibraryTabId
  label: string
  icon: LucideIcon
  /** Column holding the row's display name. */
  titleKey: string
  singular: string
  plural: string
  description: string
  /** Column the `category` filter maps to on the server. */
  categoryKey?: string
  categoryLabel: string
  /** Column the `sub_category` filter maps to, when the tab has a second level. */
  subCategoryKey?: string
  subCategoryLabel?: string
  /** False for Invisible - its types are platform-curated, not tenant taxonomy. */
  hasTaxonomy: boolean
  /**
   * The tile shape this library is recognised by. Each tab had its own in the
   * previous app - a honeycomb of skills, circles of knowledge, triangles of
   * ability - and it is how people tell the libraries apart at a glance.
   */
  shape: LibraryShape
  sortOptions: { value: string; label: string }[]
  fields: LibraryFieldDef[]
}

/** Shared by the four KASA tabs, which differ only in their specialised columns. */
function kasaFields(extra: LibraryFieldDef[]): LibraryFieldDef[] {
  return [
    { key: 'title', label: 'Title', required: true, column: true, hideInDetail: true, placeholder: 'e.g. Risk assessment fundamentals' },
    { key: 'category', label: 'Category', taxonomy: 'category', type: 'select', column: true, width: 'w-48' },
    { key: 'sub_category', label: 'Sub Category', taxonomy: 'sub_category', type: 'select', column: true, width: 'w-48' },
    { key: 'description', label: 'Description', type: 'textarea', column: true },
    { key: 'assessment_method', label: 'Assessment Method', placeholder: 'e.g. MCQ, Case study', advanced: true },
    { key: 'business_link', label: 'Reference Link', type: 'url', placeholder: 'https://…', advanced: true },
    // The per-tab specialised columns are all elaboration on a row that is
    // already usable with a title, a category and a description.
    ...extra.map((field) => ({ ...field, advanced: true })),
  ]
}

const SORT_BY_TITLE = [
  { value: 'title', label: 'Title' },
  { value: 'category', label: 'Category' },
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Last updated' },
]

/**
 * The Skill / Competency library - the honeycomb tab.
 *
 * Skills and competencies are the same rows on s_users_skills, so this tab and
 * the Competency Library screen write one table. The risk that creates is a
 * partial edit blanking columns the other form never showed, which is why the
 * field list below covers the columns the API actually accepts rather than a
 * convenient subset. Anything not listed here is left untouched on update.
 */
export const SKILL_LIBRARY_CONFIG: LibraryTabConfig = {
  id: 'skill',
  shape: 'hexagon',
  // Labelled "Skill" because that is what the tab is called everywhere else -
  // in the old app, in the taxonomy, and in what people ask for. The rows are
  // the same s_users_skills the Competency Library screen owns.
  label: 'Skill',
  icon: Sparkles,
  titleKey: 'title',
  singular: 'Skill',
  plural: 'Skills',
  description: 'Every skill and competency this organisation tracks.',
  categoryKey: 'category',
  categoryLabel: 'Category',
  subCategoryKey: 'sub_category',
  subCategoryLabel: 'Sub Category',
  hasTaxonomy: true,
  sortOptions: SORT_BY_TITLE,
  fields: [
    { key: 'title', label: 'Title', required: true, column: true, hideInDetail: true, placeholder: 'e.g. Lockout / Tagout' },
    { key: 'category', label: 'Category', taxonomy: 'category', type: 'select', column: true, width: 'w-48' },
    { key: 'sub_category', label: 'Sub Category', taxonomy: 'sub_category', type: 'select', column: true, width: 'w-48' },
    { key: 'description', label: 'Description', type: 'textarea', column: true },
    { key: 'department', label: 'Department', source: 'departments', column: true, width: 'w-44' },
    { key: 'sub_department', label: 'Sub Department', source: 'sub_departments', help: 'The second level below department.' },
    // Category > Sub Category > Micro Category. The first two came from the
    // taxonomy panel; the third is a free column, so it is offered from what
    // already exists rather than left to drift.
    { key: 'micro_category', label: 'Micro Category', source: 'micro_categories', help: 'The third level below sub category.' },
    { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], column: true, width: 'w-28' },
    { key: 'skill_status', label: 'Skill Status', type: 'select', options: ['Active', 'Futuristic'], help: 'Futuristic marks a skill the organisation is building towards.' },
    { key: 'skill_code', label: 'Skill Code', placeholder: 'e.g. SAF-014', advanced: true },
    { key: 'competency_type', label: 'Competency Type', placeholder: 'e.g. Technical, Behavioural', advanced: true },
    { key: 'skill_importance', label: 'Importance', placeholder: 'e.g. Critical', advanced: true },
    // X-03. `proficiency_levels` was already returned by /library/meta and already
    // in the `source` union - the field ignored both and stayed free text, so
    // every author reinvented the wording. Suggested, not closed: an open list
    // offers what the tenant already uses while still allowing a new value.
    { key: 'proficiency_level', label: 'Proficiency Levels', source: 'proficiency_levels', help: 'Suggested from the levels this organisation already uses.', advanced: true },
    { key: 'related_skills', label: 'Related Skills', source: 'related_skills', advanced: true, help: 'Suggested from this library; a skill not yet in it can still be typed.' },
    { key: 'sub_skills', label: 'Sub Skills', type: 'textarea', advanced: true },
    { key: 'job_titles', label: 'Job Titles', source: 'job_titles', advanced: true, help: 'Suggested from the job role catalogue.' },
    { key: 'learning_resources', label: 'Learning Resources', source: 'learning_resources', advanced: true, help: 'Suggested from the course catalogue.' },
    { key: 'assesment_method', label: 'Assessment Method', placeholder: 'e.g. Observation, MCQ', advanced: true },
    // X-03: STAYS FREE TEXT. certification_type holds 0 rows, and a picker over
    // an empty table looks like a closed list and offers nothing. Scheduled on
    // 'certification_type populated', not parked.
    { key: 'certification_qualifications', label: 'Certifications', type: 'textarea', advanced: true },
    { key: 'legal_compliance_relevance', label: 'Legal / Compliance Relevance', type: 'textarea', advanced: true },
    { key: 'sop_practice_link', label: 'SOP / Practice Link', type: 'url', placeholder: 'https://…', advanced: true },
    { key: 'performance_metrics', label: 'Performance Metrics', type: 'textarea', advanced: true },
    { key: 'common_errors_tips', label: 'Common Errors & Tips', type: 'textarea', advanced: true },
    { key: 'sme_contacts', label: 'SME Contacts', type: 'textarea', advanced: true },
    { key: 'bussiness_links', label: 'Business Link', type: 'url', placeholder: 'https://…', advanced: true },
    { key: 'custom_tags', label: 'Custom Tags', type: 'textarea', advanced: true },
    // Populated on almost every row in the data but unreachable from this form
    // until now, so a skill could be read but never maintained here.
    { key: 'skill_flow', label: 'Skill Flow', type: 'textarea', help: 'The steps this skill is performed in.', advanced: true },
    { key: 'tasklist', label: 'Task List', type: 'textarea', help: 'The concrete tasks this skill covers.', advanced: true },
    { key: 'experience_project', label: 'Experience / Project', type: 'textarea', help: 'Where someone demonstrates this skill in practice.', advanced: true },
    // C-10. Both were on the wire and discarded by the drawer.
    //
    // approve_status is the find: it is an enum('Approved','Pending','Cancelled')
    // POPULATED ON 3,974 OF 5,171 SKILLS (77%) and rendered nowhere. A library
    // that tracks approval on three quarters of its rows and never shows it
    // leaves the reader unable to tell a governed row from an ungoverned one.
    // Rendered read-only: approval is a workflow outcome, and a free edit here
    // would let anyone approve their own row from the detail drawer.
    { key: 'approve_status', label: 'Approval', type: 'select', options: ['Approved', 'Pending', 'Cancelled'], readOnly: true, column: true, width: 'w-32', help: 'Set by the approval workflow, not edited here.' },
    // The lesser half - 94 of 5,171 (2%). Free text describing what the skill
    // maps onto; kept as a textarea because that is what the data is.
    { key: 'skill_maps', label: 'Skill Maps', type: 'textarea', advanced: true, help: 'What this skill maps onto elsewhere.' },
  ],
}

export const LIBRARY_TABS: LibraryTabConfig[] = [
  SKILL_LIBRARY_CONFIG,
  {
    id: 'jobrole',
    shape: 'card',
    label: 'Job Role',
    icon: Briefcase,
    titleKey: 'jobrole',
    singular: 'Job Role',
    plural: 'Job Roles',
    description: 'The role catalogue: what each role does, which department owns it and how it is expected to perform.',
    categoryKey: 'jobrole_category',
    categoryLabel: 'Role Category',
    hasTaxonomy: true,
    sortOptions: [
      { value: 'jobrole', label: 'Job role' },
      { value: 'department', label: 'Department' },
      { value: 'jobrole_category', label: 'Role category' },
      { value: 'created_at', label: 'Created' },
    ],
    fields: [
      { key: 'jobrole', label: 'Job Role', required: true, column: true, hideInDetail: true, placeholder: 'e.g. Staff Nurse' },
      // The department that owns the role. Suggested from the roles that
      // already exist, but a genuinely new department must still be typeable.
      { key: 'department', label: 'Department', source: 'departments', column: true, width: 'w-48' },
      { key: 'sub_department', label: 'Sub Department', source: 'sub_departments', help: 'The second level below department.' },
      { key: 'jobrole_category', label: 'Role Category', taxonomy: 'category', type: 'select', column: true, width: 'w-44' },
      { key: 'industries', label: 'Industry', source: 'industries' },
      { key: 'description', label: 'Description', type: 'textarea', column: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], column: true, width: 'w-28' },
      { key: 'performance_expectation', label: 'Performance Expectation', type: 'textarea', column: true, advanced: true },
      { key: 'job_level', label: 'Job Level', placeholder: 'e.g. L3', advanced: true },
      { key: 'responsibilities', label: 'Responsibilities', type: 'textarea', advanced: true },
      { key: 'education', label: 'Education', advanced: true },
      { key: 'experience', label: 'Experience', advanced: true },
      { key: 'training', label: 'Training', advanced: true },
      { key: 'related_jobrole', label: 'Related Roles', help: 'Comma separated.', advanced: true },
      { key: 'keyword_tags', label: 'Tags', help: 'Comma separated.', advanced: true },
      { key: 'sequence_order', label: 'Sequence Order', help: 'Where this role sits in the department listing.', advanced: true },
    ],
  },
  {
    id: 'jobrole-task',
    shape: 'card',
    label: 'Job Role Task',
    icon: ListChecks,
    titleKey: 'task',
    singular: 'Task',
    plural: 'Job Role Tasks',
    description: 'Tasks grouped by critical work function, so every role has an explicit list of what it actually does.',
    categoryKey: 'task_category',
    categoryLabel: 'Task Category',
    hasTaxonomy: true,
    sortOptions: [
      { value: 'task', label: 'Task' },
      { value: 'jobrole', label: 'Job role' },
      { value: 'critical_work_function', label: 'Work function' },
      { value: 'created_at', label: 'Created' },
    ],
    fields: [
      { key: 'task', label: 'Task', required: true, type: 'textarea', column: true, hideInDetail: true, placeholder: 'What the role has to do' },
      // Must be a real role name, chosen not typed. This column is the only
      // link between a task and its role - Task Management matches it against
      // the role name verbatim - so a typo files the task against a role that
      // does not exist and it silently disappears from the Add Task drawer.
      {
        key: 'jobrole',
        label: 'Job Role',
        required: true,
        type: 'select',
        source: 'jobroles',
        column: true,
        width: 'w-52',
        help: 'Task Management matches this name exactly. Create the role in the Job Role tab first if it is missing.',
      },
      { key: 'critical_work_function', label: 'Critical Work Function', column: true, width: 'w-52' },
      { key: 'task_category', label: 'Task Category', taxonomy: 'category', type: 'select', column: true, width: 'w-40' },
      {
        key: 'task_type',
        label: 'Task Type',
        type: 'select',
        options: ['Low', 'Medium', 'High', 'Critical'],
        column: true,
        width: 'w-28',
      },
      { key: 'track', label: 'Track', advanced: true },
      { key: 'sector', label: 'Sector', advanced: true },
    ],
  },
  {
    id: 'knowledge',
    shape: 'circle',
    label: 'Knowledge',
    icon: Brain,
    titleKey: 'title',
    singular: 'Knowledge Item',
    plural: 'Knowledge',
    description: 'What people need to know: concepts, theory and the references behind them.',
    categoryKey: 'category',
    categoryLabel: 'Category',
    subCategoryKey: 'sub_category',
    subCategoryLabel: 'Sub Category',
    hasTaxonomy: true,
    sortOptions: SORT_BY_TITLE,
    fields: kasaFields([
      { key: 'key_concepts', label: 'Key Concepts', type: 'textarea' },
      { key: 'theoretical_foundation', label: 'Theoretical Foundation', type: 'textarea' },
      { key: 'complexity_level', label: 'Complexity Level', type: 'select', options: ['Basic', 'Intermediate', 'Advanced', 'Expert'] },
      { key: 'proficiency_expectation', label: 'Proficiency Expectation' },
      { key: 'references', label: 'References', type: 'textarea' },
      { key: 'certification_options', label: 'Certification Options', type: 'textarea' },
      { key: 'compliance_relevance', label: 'Compliance Relevance', type: 'textarea' },
      { key: 'knowledge_tags', label: 'Tags', help: 'Comma separated.' },
    ]),
  },
  {
    id: 'ability',
    shape: 'triangle',
    label: 'Ability',
    icon: Zap,
    titleKey: 'title',
    singular: 'Ability',
    plural: 'Abilities',
    description: 'The cognitive and physical capacities a role draws on, and how each one is measured.',
    categoryKey: 'category',
    categoryLabel: 'Category',
    subCategoryKey: 'sub_category',
    subCategoryLabel: 'Sub Category',
    hasTaxonomy: true,
    sortOptions: SORT_BY_TITLE,
    fields: kasaFields([
      { key: 'cognitive_elements', label: 'Cognitive Elements', type: 'textarea' },
      { key: 'psychomotor_elements', label: 'Psychomotor Elements', type: 'textarea' },
      { key: 'measurement_metrics', label: 'Measurement Metrics', type: 'textarea' },
      { key: 'importance_level', label: 'Importance Level', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
      { key: 'common_challenges', label: 'Common Challenges', type: 'textarea' },
      { key: 'improvement_tips', label: 'Improvement Tips', type: 'textarea' },
      { key: 'ability_tags', label: 'Tags', help: 'Comma separated.' },
    ]),
  },
  {
    id: 'attitude',
    shape: 'card',
    label: 'Attitude',
    icon: Smile,
    titleKey: 'title',
    singular: 'Attitude',
    plural: 'Attitudes',
    description: 'The mindsets the organisation expects, how they are developed and what their absence looks like.',
    categoryKey: 'category',
    categoryLabel: 'Category',
    subCategoryKey: 'sub_category',
    subCategoryLabel: 'Sub Category',
    hasTaxonomy: true,
    sortOptions: SORT_BY_TITLE,
    fields: kasaFields([
      { key: 'development_methods', label: 'Development Methods', type: 'textarea' },
      { key: 'negative_indicators', label: 'Negative Indicators', type: 'textarea' },
      { key: 'improvement_strategies', label: 'Improvement Strategies', type: 'textarea' },
      { key: 'cultural_alignment', label: 'Cultural Alignment', type: 'textarea' },
      { key: 'attitude_tags', label: 'Tags', help: 'Comma separated.' },
    ]),
  },
  {
    id: 'behaviour',
    shape: 'card',
    label: 'Behaviour',
    icon: Heart,
    titleKey: 'title',
    singular: 'Behaviour',
    plural: 'Behaviours',
    description: 'Observable behaviours with the indicators, metrics and coaching notes that make them assessable.',
    categoryKey: 'category',
    categoryLabel: 'Category',
    subCategoryKey: 'sub_category',
    subCategoryLabel: 'Sub Category',
    hasTaxonomy: true,
    sortOptions: SORT_BY_TITLE,
    fields: kasaFields([
      { key: 'measurable_indicators', label: 'Measurable Indicators', type: 'textarea' },
      { key: 'behaviour_alternatives', label: 'Alternative Behaviours', type: 'textarea' },
      { key: 'performance_metrics', label: 'Performance Metrics', type: 'textarea' },
      { key: 'risk_implications', label: 'Risk Implications', type: 'textarea' },
      { key: 'coaching_guidelines', label: 'Coaching Guidelines', type: 'textarea' },
      { key: 'behaviour_tags', label: 'Tags', help: 'Comma separated.' },
    ]),
  },
  {
    id: 'invisible',
    shape: 'card',
    label: 'Invisible',
    icon: EyeOff,
    titleKey: 'title',
    singular: 'Invisible Library Entry',
    plural: 'Invisible Library',
    description: 'Frameworks, mental models and matrices — the thinking tools behind the work rather than the work itself.',
    categoryKey: 'type',
    categoryLabel: 'Type',
    hasTaxonomy: false,
    sortOptions: [
      { value: 'title', label: 'Title' },
      { value: 'type', label: 'Type' },
      { value: 'difficulty_level', label: 'Difficulty' },
    ],
    fields: [
      { key: 'title', label: 'Title', required: true, column: true, hideInDetail: true, placeholder: 'e.g. Second-Order Thinking' },
      {
        // The column is `type`, but `type=API` rides on every Laravel request,
        // so the API reads it from `entry_type`. FORM_KEY_OVERRIDES does the swap.
        key: 'type',
        label: 'Type',
        type: 'select',
        options: ['mental models', 'frameworks', 'matrices'],
        required: true,
        column: true,
        width: 'w-40',
      },
      { key: 'description', label: 'Description', type: 'textarea', column: true },
      {
        key: 'difficulty_level',
        label: 'Difficulty',
        type: 'select',
        options: ['beginner', 'intermediate', 'advanced'],
        column: true,
        width: 'w-32',
      },
      { key: 'purpose', label: 'Purpose', type: 'textarea', advanced: true },
      { key: 'when_to_use', label: 'When To Use', type: 'textarea', advanced: true },
      { key: 'benefits', label: 'Benefits', type: 'textarea', advanced: true },
      { key: 'limitations', label: 'Limitations', type: 'textarea', advanced: true },
      { key: 'example_use_case', label: 'Example Use Case', type: 'textarea', advanced: true },
      { key: 'tags', label: 'Tags', help: 'Comma separated.', advanced: true },
    ],
  },
]

/**
 * Columns whose API request key differs from the DB column name.
 *
 * `type` is the Laravel transport flag on every request (type=API), so the
 * Invisible tab's `type` column is written through `entry_type` instead.
 */
export const FORM_KEY_OVERRIDES: Partial<Record<LibraryTabId, Record<string, string>>> = {
  invisible: { type: 'entry_type' },
}

export function tabConfig(id: LibraryTabId): LibraryTabConfig {
  return LIBRARY_TABS.find((tab) => tab.id === id) ?? LIBRARY_TABS[0]
}
