'use client';

/**
 * Add Template — its own page, not a panel under the listing.
 *
 * A static segment, so it wins over `[id]` for this path and `/ai/prompts/new` can
 * never be read as a template whose id is the word "new".
 *
 * `?module=talent_management` carries the listing's selected module in, so adding a template from
 * the Talent Management view files it under Talent Management without the author
 * re-choosing what they had already chosen.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import {
  blankForm,
  TemplateForm,
  TemplatePageShell,
  TemplatePageState,
  useTemplateOptions,
} from '../../_components/TemplateForm';

export default function AddTemplatePage() {
  // `useSearchParams` opts the route into client-side rendering, which Next requires
  // a Suspense boundary for. Without it the build fails rather than the page.
  return (
    <Suspense fallback={null}>
      <AddTemplate />
    </Suspense>
  );
}

function AddTemplate() {
  const searchParams = useSearchParams();
  const { options, optionsError } = useTemplateOptions();

  const moduleKey = searchParams.get('module') ?? '';
  const returnTo = '/ai/prompts';

  return (
    <TemplatePageShell
      title="Add Template"
      subtitle="Write an AI template and file it under the module that will use it."
      actions={<BackLink href={returnTo} />}
    >
      {options === null ? (
        <TemplatePageState loading={optionsError === ''} error={optionsError} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <TemplateForm
            options={options}
            initial={blankForm(moduleKey)}
            templateId={null}
            returnTo={returnTo}
          />
        </div>
      )}
    </TemplatePageShell>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
    >
      <ArrowLeft className="size-4" />
      Back to templates
    </Link>
  );
}
