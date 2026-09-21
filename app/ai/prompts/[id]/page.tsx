'use client';

/**
 * View Template — the whole template, read-only, on its own page.
 *
 * Separate from the editor rather than the editor with its inputs disabled: a reader's
 * question is "what does this template do", and a form answers "what could I change".
 * See `TemplateView` for the layout.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';

import { TemplatePageShell, TemplatePageState } from '../../_components/TemplateForm';
import { TemplateView } from '../../_components/TemplateView';
import { fetchTemplate, type AiTemplateRow } from '@/lib/intelligence/ai-templates';
import { describeAiError } from '@/lib/intelligence/client';

export default function ViewTemplatePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const [row, setRow] = useState<AiTemplateRow | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isFinite(id)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('That template id is not valid.');
      return;
    }

    let cancelled = false;

    fetchTemplate(id)
      .then((data) => {
        if (!cancelled) setRow(data.template);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <TemplatePageShell
      title="View Template"
      subtitle={
        row
          ? `${row.module_label} · ${row.status} · version ${row.version}`
          : 'The complete template as it is stored.'
      }
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/ai/prompts"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to templates
          </Link>
          {row && (
            <Link
              href={`/ai/prompts/${row.id}/edit`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-95"
            >
              <Pencil className="size-4" />
              {row.editable_in_place ? 'Edit' : 'Customise'}
            </Link>
          )}
        </div>
      }
    >
      {row === null ? <TemplatePageState loading={error === ''} error={error} /> : <TemplateView row={row} />}
    </TemplatePageShell>
  );
}
