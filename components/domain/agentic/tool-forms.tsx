'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ToolKey } from '@/services/agentic'

import { TOOL_ENDPOINT_FOR, TOOL_LABELS } from './shared'

/** One field of a tool form. */
interface ToolField {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'email' | 'select'
  options?: string[]
  required?: boolean
  placeholder?: string
  help?: string
}

/**
 * The six tool payloads, mirroring the server-side validation exactly.
 *
 * Declaring them once means a field the API rejects can never be missing from
 * the form, and a required field is marked in both places or neither.
 */
export const TOOL_FORMS: Record<ToolKey, { label: string; blurb: string; fields: ToolField[] }> = {
  knowledge: {
    label: 'Knowledge Base',
    blurb: 'Query indexed documents and record the grounded answer.',
    fields: [
      { key: 'query_text', label: 'Query', type: 'textarea', required: true, placeholder: 'What should the agent look up?' },
      { key: 'source', label: 'Source', placeholder: 'e.g. internal-handbook' },
      { key: 'response', label: 'Response', type: 'textarea' },
      { key: 'confidence_score', label: 'Confidence', type: 'number', help: 'Between 0 and 1.' },
    ],
  },
  email: {
    label: 'Email',
    blurb: 'Compose an email for the agent to send.',
    fields: [
      { key: 'to_email', label: 'To', type: 'email', required: true, placeholder: 'name@example.com' },
      { key: 'subject', label: 'Subject', required: true },
      { key: 'body', label: 'Body', type: 'textarea', required: true },
    ],
  },
  web_search: {
    label: 'Web Search',
    blurb: 'Search the public web and record what came back.',
    fields: [
      { key: 'query', label: 'Search query', required: true, placeholder: 'e.g. nursing competency frameworks 2026' },
      { key: 'source_engine', label: 'Engine', type: 'select', options: ['google', 'bing', 'duckduckgo', 'tavily'] },
      { key: 'results', label: 'Results', type: 'textarea' },
    ],
  },
  sql_exec: {
    label: 'SQL Query',
    blurb: 'Run a read query against reporting data.',
    fields: [
      {
        key: 'query',
        label: 'SQL',
        type: 'textarea',
        required: true,
        placeholder: 'SELECT ...',
        help: 'Reads only — statements that modify data are rejected.',
      },
      { key: 'execution_status', label: 'Execution status', type: 'select', options: ['success', 'error'] },
      { key: 'rows_affected', label: 'Rows returned', type: 'number' },
      { key: 'error_message', label: 'Error message', type: 'textarea' },
    ],
  },
  visualization: {
    label: 'Data Visualization',
    blurb: 'Turn a result set into a chart configuration.',
    fields: [
      { key: 'chart_type', label: 'Chart type', type: 'select', options: ['bar', 'line', 'area', 'pie', 'scatter', 'heatmap'], required: true },
      { key: 'input_data', label: 'Input data', type: 'textarea', placeholder: 'JSON or CSV' },
      { key: 'generated_config', label: 'Generated config', type: 'textarea' },
      { key: 'output_url', label: 'Output URL', placeholder: 'https://…' },
    ],
  },
  file: {
    label: 'File Operations',
    blurb: 'Register a file for the agent to work with.',
    fields: [
      { key: 'file_name', label: 'File name', required: true, placeholder: 'report.csv' },
      { key: 'file_type', label: 'File type', placeholder: 'text/csv' },
      { key: 'file_size', label: 'Size (bytes)', type: 'number' },
      { key: 'storage_path', label: 'Storage path' },
      { key: 'uploaded_by', label: 'Uploaded by' },
    ],
  },
}

/** Which tool endpoint an agent's tool id maps to, or null when it has no form. */
export function toolEndpointFor(agentTool: string): ToolKey | null {
  const key = TOOL_ENDPOINT_FOR[agentTool]
  return key ? (key as ToolKey) : null
}

export function toolLabelFor(agentTool: string): string {
  return TOOL_LABELS[agentTool] ?? agentTool
}

interface ToolFormProps {
  tool: ToolKey
  agentId: number
  runId?: number
  invoking: boolean
  onInvoke: (values: Record<string, string | number>) => Promise<{ ok: boolean; message: string }>
}

/**
 * Renders one tool's form from its declared field list.
 *
 * The agent id is fixed by context rather than being an editable field, which
 * is what the screen this replaces did — an editable agent id let a form post
 * against an agent the user was not looking at.
 */
export function ToolForm({ tool, agentId, runId, invoking, onInvoke }: ToolFormProps) {
  const config = TOOL_FORMS[tool]

  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))

  const handleSubmit = async () => {
    for (const field of config.fields) {
      if (field.required && !(values[field.key] ?? '').trim()) {
        setError(`${field.label} is required.`)
        setSuccess(null)
        return
      }
    }
    setError(null)

    const payload: Record<string, string | number> = { agent_id: agentId }
    if (runId) payload.run_id = runId

    for (const field of config.fields) {
      const raw = (values[field.key] ?? '').trim()
      if (raw === '') continue
      payload[field.key] = field.type === 'number' ? Number(raw) : raw
    }

    const result = await onInvoke(payload)
    if (result.ok) {
      setSuccess(result.message)
      setError(null)
      setValues({})
    } else {
      setError(result.message)
      setSuccess(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{config.blurb}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {config.fields.map((field) => {
          const wide = field.type === 'textarea'
          return (
            <div key={field.key} className={cn('space-y-2', wide && 'md:col-span-2')}>
              <label className="text-sm font-semibold text-foreground" htmlFor={`tool-${tool}-${field.key}`}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </label>

              {field.type === 'textarea' ? (
                <Textarea
                  id={`tool-${tool}-${field.key}`}
                  value={values[field.key] ?? ''}
                  onChange={(event) => set(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="min-h-[90px] border-border bg-background"
                />
              ) : field.type === 'select' ? (
                <Select
                  id={`tool-${tool}-${field.key}`}
                  value={values[field.key] ?? ''}
                  onChange={(value) => set(field.key, value)}
                  options={[
                    { label: `Select ${field.label.toLowerCase()}`, value: '' },
                    ...(field.options ?? []).map((option) => ({ label: option, value: option })),
                  ]}
                  className="h-9 border-border bg-background"
                  aria-label={field.label}
                />
              ) : (
                <Input
                  id={`tool-${tool}-${field.key}`}
                  type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(event) => set(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="border-border bg-background"
                />
              )}

              {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
            </div>
          )
        })}
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {success && <p className="text-sm font-medium text-emerald-600">{success}</p>}

      <Button onClick={handleSubmit} disabled={invoking} className="h-9 gap-2 rounded-lg font-bold">
        <Play className="h-4 w-4" /> {invoking ? 'Running…' : `Run ${config.label}`}
      </Button>
    </div>
  )
}
