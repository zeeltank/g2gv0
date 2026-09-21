'use client';

/**
 * AI Model Management — the catalogue the provider screen's model dropdown reads.
 *
 * ONE CATALOGUE, NOT A SECOND SYSTEM
 *
 * Every model offered anywhere in the platform is a row here. The provider screen does
 * not keep its own list; it reads this one filtered by the selected provider. So adding
 * a model makes it selectable immediately, and retiring one removes it from every
 * dropdown at once.
 *
 * PLATFORM ROWS ARE READ-ONLY HERE
 *
 * Rows seeded for the whole estate are shared by every organisation, so one organisation renaming
 * or retiring one would change what every other organisation sees. They are listed — an
 * administrator needs to know what is available — but only a organisation's own rows can be
 * edited. The API enforces the same rule; this is the explanation, not the control.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Pencil, Plus, RefreshCw, X } from 'lucide-react';

import {
  createAiModel,
  fetchAiModels,
  updateAiModel,
  type AiModelIndex,
} from '@/lib/intelligence/ai-configuration';
import { AiApiError, describeAiError } from '@/lib/intelligence/client';

interface ModelForm {
  id: number | null;
  provider: string;
  model_id: string;
  label: string;
  max_output_tokens: string;
  input_cost_per_1k: string;
  output_cost_per_1k: string;
  sort_order: string;
  status: number;
}

const EMPTY: ModelForm = {
  id: null,
  provider: '',
  model_id: '',
  label: '',
  max_output_tokens: '',
  input_cost_per_1k: '',
  output_cost_per_1k: '',
  sort_order: '',
  status: 1,
};

export function ModelManager() {
  const [index, setIndex] = useState<AiModelIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<ModelForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // See ConfigurationManager: the effect may not set state synchronously, so a token
  // bump re-runs it and only the promise callbacks touch state.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchAiModels()
      .then((next) => {
        if (cancelled) return;
        setIndex(next);
        setError(null);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  /** An event handler, so setting state here is not the effect problem above. */
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  // Providers that have at least one model, in catalogue order, plus any provider the
  // platform supports so an empty one can still be seen to be empty.
  const providers = useMemo(() => index?.providers ?? [], [index]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      provider: form.provider,
      model_id: form.model_id.trim(),
      label: form.label.trim(),
      max_output_tokens: form.max_output_tokens.trim() === '' ? null : Number(form.max_output_tokens),
      input_cost_per_1k: form.input_cost_per_1k.trim() === '' ? null : Number(form.input_cost_per_1k),
      output_cost_per_1k: form.output_cost_per_1k.trim() === '' ? null : Number(form.output_cost_per_1k),
      // Sent even when unchanged. The API defaults an omitted sort_order to 0 and
      // writes it, so leaving it out of an edit silently moved the model to the
      // top of every dropdown that reads this catalogue.
      sort_order: form.sort_order.trim() === '' ? 0 : Number(form.sort_order),
      status: form.status,
    };

    try {
      if (form.id === null) {
        await createAiModel(payload);
        setNotice('Model added.');
      } else {
        await updateAiModel(form.id, payload);
        setNotice('Model updated.');
      }

      setForm(null);
      load();
    } catch (cause) {
      if (cause instanceof AiApiError) {
        setFormError(cause.message);
        setFieldErrors(cause.fieldErrors);
      } else {
        setFormError(describeAiError(cause));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading && !index) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading the model catalogue…
      </div>
    );
  }

  if (error && !index) {
    return (
      <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="size-4" />
          {error}
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className="size-3.5" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Model catalogue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The models each provider offers. This is the list the provider screen&apos;s model
            dropdown reads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({ ...EMPTY });
              setFormError(null);
              setFieldErrors({});
              setNotice(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Add model
          </button>
        </div>
      </header>

      {notice && (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="size-3.5" />
          {notice}
        </p>
      )}

      {/* The full-page error state above only renders before the first successful
          load. Once the catalogue is on screen a failed Refresh used to leave the
          stale list showing with no sign that it was stale — which is the worst
          outcome for a screen whose whole purpose is to say what is configured. */}
      {error && index && (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="size-3.5" />
          {error}
        </p>
      )}

      {form && (
        <form onSubmit={submit} className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {form.id === null ? 'Add model' : 'Edit model'}
            </h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Provider" error={fieldErrors.provider}>
              <select
                required
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className={inputClass}
              >
                <option value="">Select a provider…</option>
                {providers.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Model id (sent to the provider)" error={fieldErrors.model_id}>
              <input
                required
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                placeholder="e.g. gemini-3.6-flash"
                className={`${inputClass} font-mono`}
              />
            </Field>

            <Field label="Label (shown in dropdowns)" error={fieldErrors.label}>
              <input
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Gemini 3.6 Flash"
                className={inputClass}
              />
            </Field>

            <Field label="Max output tokens (optional)" error={fieldErrors.max_output_tokens}>
              <input
                type="number"
                min={1}
                value={form.max_output_tokens}
                onChange={(e) => setForm({ ...form, max_output_tokens: e.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Input cost per 1K tokens (USD, optional)" error={fieldErrors.input_cost_per_1k}>
              <input
                type="number"
                step="0.000001"
                min={0}
                value={form.input_cost_per_1k}
                onChange={(e) => setForm({ ...form, input_cost_per_1k: e.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Output cost per 1K tokens (USD, optional)" error={fieldErrors.output_cost_per_1k}>
              <input
                type="number"
                step="0.000001"
                min={0}
                value={form.output_cost_per_1k}
                onChange={(e) => setForm({ ...form, output_cost_per_1k: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.status === 1}
              onChange={(e) => setForm({ ...form, status: e.target.checked ? 1 : 0 })}
              className="size-4 rounded border-border"
            />
            Selectable
          </label>

          {formError && (
            <p className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
              <AlertTriangle className="size-3.5" />
              {formError}
            </p>
          )}

          <div className="mt-5 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {form.id === null ? 'Save' : 'Update'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-6">
        {providers.map((provider) => {
          const models = index?.models[provider.key] ?? [];

          return (
            <div key={provider.key}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {provider.label}
                {!provider.driveable && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    no client yet
                  </span>
                )}
              </h3>

              <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <Th>Label</Th>
                      <Th>Model id</Th>
                      <Th>Max output</Th>
                      <Th>Cost / 1K (in / out)</Th>
                      <Th>Scope</Th>
                      <Th>Status</Th>
                      <Th> </Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {models.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-5 text-center text-sm text-muted-foreground">
                          No models in the catalogue for this provider.
                        </td>
                      </tr>
                    )}
                    {models.map((model) => (
                      <tr key={model.id} className="text-foreground">
                        <Td className="font-medium">{model.label}</Td>
                        <Td className="font-mono text-xs">{model.model_id}</Td>
                        <Td>{model.max_output_tokens ?? '—'}</Td>
                        <Td className="text-xs">
                          {/* A blank cost is honest rather than a guessed rate: this
                              column exists so a bill can be explained. */}
                          {model.input_cost_per_1k === null && model.output_cost_per_1k === null
                            ? '—'
                            : `${model.input_cost_per_1k ?? '—'} / ${model.output_cost_per_1k ?? '—'}`}
                        </Td>
                        <Td className="text-xs text-muted-foreground">
                          {model.scope === 'platform' ? 'Platform (shared)' : 'This organisation'}
                        </Td>
                        <Td>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              model.status === 1
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {model.status === 1 ? 'Selectable' : 'Retired'}
                          </span>
                        </Td>
                        <Td>
                          {model.scope === 'institute' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setForm({
                                  id: model.id,
                                  provider: model.provider,
                                  model_id: model.model_id,
                                  label: model.label,
                                  max_output_tokens: model.max_output_tokens?.toString() ?? '',
                                  input_cost_per_1k: model.input_cost_per_1k?.toString() ?? '',
                                  output_cost_per_1k: model.output_cost_per_1k?.toString() ?? '',
                                  // Carried through the round trip so an edit
                                  // preserves the model's place in the list.
                                  sort_order: model.sort_order?.toString() ?? '',
                                  status: model.status,
                                });
                                setFormError(null);
                                setFieldErrors({});
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                            >
                              <Pencil className="size-3" />
                              Edit
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Shared — read only</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      {children}
      {error?.length ? <p className="mt-1.5 text-xs text-destructive">{error[0]}</p> : null}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-2.5 ${className}`}>{children}</td>;
}
