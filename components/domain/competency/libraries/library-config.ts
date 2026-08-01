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
  placeholder?: string
  /** Rendered under the field in the form. */
  help?: string
}

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
    { key: 'assessment_method', label: 'Assessment Method', placeholder: 'e.g. MCQ, Case study' },
    { key: 'business_link', label: 'Reference Link', type: 'url', placeholder: 'https://…' },
    ...extra,
  ]
}

const SORT_BY_TITLE = [
  { value: 'title', label: 'Title' },
  { value: 'category', label: 'Category' },
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Last updated' },
]

/**
 * The Skill / Competency library.
 *
 * NOT a tab here: skills and competencies are the same rows on s_users_skills,
 * and two screens writing one table with different field sets is how a partial
 * edit ends up blanking columns the other form never showed. The Competency
 * Library owns that table - it has the lifecycle, the usage counts and the
 * detail drawer - so this config is exported for its form and taxonomy panel
 * rather than rendered as a ninth tab.
 */
export const SKILL_LIBRARY_CONFIG: LibraryTabConfig = {
  id: 'skill',
  label: 'Competency',
  icon: Sparkles,
  titleKey: 'title',
  singular: 'Competency',
  plural: 'Competencies',
  description: 'Every competency this organisation tracks.',
  categoryKey: 'category',
  categoryLabel: 'Category',
  subCategoryKey: 'sub_category',
  subCategoryLabel: 'Sub Category',
  hasTaxonomy: true,
  sortOptions: SORT_BY_TITLE,
  fields: [],
}

export const LIBRARY_TABS: LibraryTabConfig[] = [
  {
    id: 'jobrole',
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
      { key: 'department', label: 'Department', column: true, width: 'w-48' },
      { key: 'jobrole_category', label: 'Role Category', taxonomy: 'category', type: 'select', column: true, width: 'w-44' },
      { key: 'description', label: 'Description', type: 'textarea', column: true },
      { key: 'performance_expectation', label: 'Performance Expectation', type: 'textarea', column: true },
      { key: 'job_level', label: 'Job Level', placeholder: 'e.g. L3' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], column: true, width: 'w-28' },
      { key: 'responsibilities', label: 'Responsibilities', type: 'textarea' },
      { key: 'education', label: 'Education' },
      { key: 'experience', label: 'Experience' },
      { key: 'training', label: 'Training' },
      { key: 'related_jobrole', label: 'Related Roles', help: 'Comma separated.' },
      { key: 'keyword_tags', label: 'Tags', help: 'Comma separated.' },
    ],
  },
  {
    id: 'jobrole-task',
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
      { key: 'jobrole', label: 'Job Role', column: true, width: 'w-52' },
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
      { key: 'track', label: 'Track' },
      { key: 'sector', label: 'Sector' },
    ],
  },
  {
    id: 'knowledge',
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
      { key: 'purpose', label: 'Purpose', type: 'textarea' },
      { key: 'when_to_use', label: 'When To Use', type: 'textarea' },
      { key: 'benefits', label: 'Benefits', type: 'textarea' },
      { key: 'limitations', label: 'Limitations', type: 'textarea' },
      { key: 'example_use_case', label: 'Example Use Case', type: 'textarea' },
      { key: 'tags', label: 'Tags', help: 'Comma separated.' },
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
