'use client';

/**
 * Edit Template — the editor, on its own page.
 *
 * Module Name and Template Title sit side by side,
 * the content block full width below with its toolbar strip, Save and Cancel underneath.
 * See `TemplateForm` for why the toolbar carries the variable picker and Preview but no
 * bold, font or colour controls.
 *
 * Cancel and a successful save both return to the listing rather than to the View page,
 * because the listing is where the administrator came from and where the next template
 * is.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Eye } from 'lucide-react';

import {
  formFromRow,
  TemplateForm,
  TemplatePageShell,
  TemplatePageState,
  useTemplateOptions,
  type TemplateFormState,
} from '../../../_components/TemplateForm';
import { fetchTemplate, type AiTemplateRow } from '@/lib/intelligence/ai-templates';
import { describeAiError } from '@/lib/intelligence/client';

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const { options, optionsError } = useTemplateOptions();
  const [row, setRow] = useState<AiTemplateRow | null>(null);
  const [initial, setInitial] = useState<TemplateFormState | null>(null);
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
        if (cancelled) return;
        setRow(data.template);
        setInitial(formFromRow(data.template));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const ready = options !== null && initial !== null && row !== null;
  const failure = error || optionsError;

  return (
    <TemplatePageShell
      title={row && !row.editable_in_place ? 'Customise Template' : 'Edit Template'}
      subtitle={
        row
          ? `${row.name} — ${row.module_label} · version ${row.version}`
          : 'Change what this template asks the model to do.'
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
              href={`/ai/prompts/${row.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Eye className="size-4" />
              View
            </Link>
          )}
        </div>
      }
    >
      {!ready ? (
        <TemplatePageState loading={failure === ''} error={failure} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <TemplateForm
            options={options}
            initial={initial}
            templateId={row.id}
            editableInPlace={row.editable_in_place}
            isPlatform={row.is_platform}
            returnTo="/ai/prompts"
          />
        </div>
      )}
    </TemplatePageShell>
  );
}
