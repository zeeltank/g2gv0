'use client';

/**
 * AI Provider & Model Management — the Add/Edit half of the providers screen.
 *
 * THE FLOW IS THE POINT
 *
 * Module → Provider → Model → API key → Save. Each step narrows the next: the model
 * list is the selected provider's models and nothing else, so the form cannot produce
 * a pairing the provider would reject. The model list comes from the same catalogue
 * Model Management edits — one list, read in two places, never two lists that drift.
 *
 * WHAT THE TWO TABLES SAY, AND WHY BOTH
 *
 * `Saved configurations` is what someone typed. `What each module calls` is what the
 * runtime will actually do — including for modules nobody has configured, which still
 * resolve to the shared pool. Showing only the first would let an administrator
 * conclude that an unconfigured module is not calling anything, when it is.
 *
 * CREDENTIALS ARE ONE-WAY
 *
 * A saved key never comes back from the server, so the edit form starts with the key
 * field blank and a note that leaving it blank keeps the stored one. That is why the
 * field is not pre-filled with a mask: a masked value in an input invites someone to
 * edit around the dots and submit the mask as the new key.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Pencil, Plus, RefreshCw, ShieldAlert, X } from 'lucide-react';

import {
  createAiConfiguration,
  fetchAiConfigurationOptions,
  fetchAiConfigurations,
  retireAiConfiguration,
  updateAiConfiguration,
  type AiConfigurationIndex,
  type AiConfigurationOptions,
  type AiConfigurationRow,
} from '@/lib/intelligence/ai-configuration';
import { AiApiError, describeAiError } from '@/lib/intelligence/client';

interface FormState {
  /** The row being edited, or null when adding. */
  id: number | null;
  ai_module: string;
  provider: string;
  model: string;
  api_key: string;
  account_email: string;
  api_limit: string;
  status: number;
}

const EMPTY_FORM: FormState = {
  id: null,
  ai_module: '',
  provider: '',
  model: '',
  api_key: '',
  account_email: '',
  api_limit: '',
  status: 1,
};

export function ConfigurationManager() {
  const [options, setOptions] = useState<AiConfigurationOptions | null>(null);
  const [index, setIndex] = useState<AiConfigurationIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);

  // Bumping this re-runs the effect below. The alternative — a load() the effect
  // calls — sets state synchronously inside the effect body, which React flags as a
  // cascading render. Only the promise callbacks touch state, matching the pattern
  // CapabilityLiveData already uses on this screen.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Both in flight together: the form is useless without the options and the table
    // is useless without the rows, so there is nothing to show until both land.
    Promise.all([fetchAiConfigurationOptions(), fetchAiConfigurations()])
      .then(([nextOptions, nextIndex]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setIndex(nextIndex);
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

  const formProvider = form?.provider ?? '';

  /** Models for the provider currently selected in the form. */
  const modelsForProvider = useMemo(() => {
    if (!options || !formProvider) return [];
    return options.models[formProvider] ?? [];
  }, [options, formProvider]);

  const selectedProvider = useMemo(
    () => options?.providers.find((p) => p.key === formProvider) ?? null,
    [options, formProvider]
  );

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setFieldErrors({});
    setNotice(null);
  };

  const openEdit = (row: AiConfigurationRow) => {
    setForm({
      id: row.id,
      ai_module: row.ai_module ?? '',
      provider: row.provider,
      model: row.model ?? '',
      // Deliberately blank — see the file note. Blank on save means "keep the stored key".
      api_key: '',
      account_email: row.account_email ?? '',
      api_limit: row.api_limit ?? '',
      status: row.status,
    });
    setFormError(null);
    setFieldErrors({});
    setNotice(null);
  };

  const closeForm = () => {
    setForm(null);
    setFormError(null);
    setFieldErrors({});
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      ai_module: form.ai_module,
      provider: form.provider,
      model: form.model.trim() === '' ? null : form.model.trim(),
      account_email: form.account_email.trim() === '' ? null : form.account_email.trim(),
      api_limit: form.api_limit.trim() === '' ? null : Number(form.api_limit),
      status: form.status,
      // Omitted entirely on an edit with no new key, so the server leaves the stored
      // credential alone rather than being sent an empty string to store.
      ...(form.api_key.trim() === '' ? {} : { api_key: form.api_key.trim() }),
    };

    try {
      if (form.id === null) {
        await createAiConfiguration(payload);
        setNotice('Configuration saved.');
      } else {
        await updateAiConfiguration(form.id, payload);
        setNotice('Configuration updated.');
      }

      closeForm();
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

  const retire = async (row: AiConfigurationRow) => {
    if (!window.confirm(`Retire the ${row.provider_label} configuration for ${row.module_label}?`)) {
      return;
    }

    try {
      await retireAiConfiguration(row.id);
      setNotice('Configuration retired.');
      load();
    } catch (cause) {
      setError(describeAiError(cause));
    }
  };

  if (loading && !index) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading AI configuration…
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
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
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
          <h2 className="text-base font-semibold text-foreground">Provider &amp; model configuration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Point each AI module at the provider, model and credential it should use.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Add configuration
          </button>
        </div>
      </header>

      {notice && (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="size-3.5" />
          {notice}
        </p>
      )}

      {/* The error state before this component's return only renders on the FIRST
          load. Without this banner a failed Retire set `error` and showed nothing —
          the row stayed on screen, apparently still active, and the administrator
          had no way to know the write had been refused. */}
      {error && index && (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="size-3.5" />
          {error}
        </p>
      )}

      {form && options && (
        <ConfigurationForm
          form={form}
          setForm={setForm}
          options={options}
          models={modelsForProvider}
          provider={selectedProvider}
          saving={saving}
          error={formError}
          fieldErrors={fieldErrors}
          onSubmit={submit}
          onCancel={closeForm}
        />
      )}

      <SavedConfigurations rows={index?.configurations ?? []} onEdit={openEdit} onRetire={retire} />
      <ResolvedModules rows={index?.resolved ?? []} />
    </section>
  );
}

function ConfigurationForm({
  form,
  setForm,
  options,
  models,
  provider,
  saving,
  error,
  fieldErrors,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  options: AiConfigurationOptions;
  models: AiConfigurationOptions['models'][string];
  provider: AiConfigurationOptions['providers'][number] | null;
  saving: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  // Not named `module`: Next refuses that identifier in a client bundle, where it
  // collides with the module wrapper.
  const selectedModule = options.modules.find((m) => m.key === form.ai_module) ?? null;
  const isEdit = form.id !== null;

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {isEdit ? 'Edit configuration' : 'Add configuration'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="AI module" error={fieldErrors.ai_module}>
          <select
            required
            value={form.ai_module}
            onChange={(e) => setForm({ ...form, ai_module: e.target.value })}
            className={selectClass}
          >
            <option value="">Select a module…</option>
            {options.modules.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          {selectedModule && (
            <p className="mt-1.5 text-xs text-muted-foreground">{selectedModule.description}</p>
          )}
          {selectedModule && !selectedModule.wired && (
            // Said before Save, not after. A settings screen that accepts a value it
            // does not yet control has to say so at the moment of choosing.
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              This module does not read centralised configuration yet. The setting is saved
              and shown, but it will not change what this module calls until it is migrated.
            </p>
          )}
        </Field>

        <Field label="AI provider" error={fieldErrors.provider}>
          <select
            required
            value={form.provider}
            // Changing provider clears the model: a model belongs to one provider, and
            // carrying it across is how an invalid pairing reaches Save.
            onChange={(e) => setForm({ ...form, provider: e.target.value, model: '' })}
            className={selectClass}
          >
            <option value="">Select a provider…</option>
            {options.providers.map((p) => (
              <option key={p.key} value={p.key} disabled={!p.driveable}>
                {p.label}
                {p.driveable ? '' : ' — not callable yet'}
              </option>
            ))}
          </select>
          {provider && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Credentials stored as <code className="font-mono">{provider.api_type}</code>.{' '}
              <a
                href={provider.docs}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Get a key
              </a>
            </p>
          )}
        </Field>

        <Field label="Model" error={fieldErrors.model}>
          <select
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            disabled={!form.provider}
            className={selectClass}
          >
            <option value="">
              {form.provider ? 'Provider default' : 'Select a provider first'}
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.model_id}>
                {m.label} ({m.model_id})
              </option>
            ))}
          </select>
          {form.provider && models.length === 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              No models in the catalogue for this provider. Add one in Model Management,
              or leave this blank to use the provider default.
            </p>
          )}
        </Field>

        <Field
          label={isEdit ? 'API key (leave blank to keep the stored key)' : 'API key'}
          error={fieldErrors.api_key}
        >
          <input
            type="password"
            autoComplete="off"
            required={!isEdit}
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder={isEdit ? '••••••••' : 'Paste the provider API key'}
            className={inputClass}
          />
        </Field>

        <Field label="Account email (optional)" error={fieldErrors.account_email}>
          <input
            type="email"
            value={form.account_email}
            onChange={(e) => setForm({ ...form, account_email: e.target.value })}
            placeholder="Which account this key belongs to"
            className={inputClass}
          />
        </Field>

        <Field label="Max output tokens (optional)" error={fieldErrors.api_limit}>
          <input
            type="number"
            min={1}
            value={form.api_limit}
            onChange={(e) => setForm({ ...form, api_limit: e.target.value })}
            placeholder="Provider default"
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
        Active
      </label>

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="size-3.5" />
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {isEdit ? 'Update' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SavedConfigurations({
  rows,
  onEdit,
  onRetire,
}: {
  rows: AiConfigurationRow[];
  onEdit: (row: AiConfigurationRow) => void;
  onRetire: (row: AiConfigurationRow) => void;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-foreground">Saved configurations</h3>

      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th>Module</Th>
              <Th>Provider</Th>
              <Th>Model</Th>
              <Th>Key</Th>
              <Th>Scope</Th>
              <Th>Status</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No credentials are stored for this organisation yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="text-foreground">
                <Td>
                  <span className="font-medium">{row.module_label}</span>
                  {row.ai_module && !row.module_wired && (
                    <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      not wired yet
                    </span>
                  )}
                </Td>
                <Td>{row.provider_label}</Td>
                <Td className="font-mono text-xs">{row.model ?? 'provider default'}</Td>
                <Td className="font-mono text-xs">{row.key_preview ?? '—'}</Td>
                <Td>
                  <span className="text-xs text-muted-foreground">
                    {row.scope === 'platform' ? 'Platform (shared)' : 'This organisation'}
                  </span>
                </Td>
                <Td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      row.status === 1
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {row.status === 1 ? 'Active' : 'Retired'}
                  </span>
                </Td>
                <Td>
                  {row.editable ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                      >
                        <Pencil className="size-3" />
                        Edit
                      </button>
                      {row.status === 1 && (
                        <button
                          type="button"
                          onClick={() => onRetire(row)}
                          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/5"
                        >
                          Retire
                        </button>
                      )}
                    </div>
                  ) : (
                    // Platform rows are shared by every organisation on the estate. The API
                    // refuses them too — this is the explanation, not the control.
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
}

const SOURCE_LABELS: Record<string, string> = {
  module: 'This organisation’s configuration',
  module_platform: 'Platform configuration',
  pool: 'This organisation’s shared key',
  pool_platform: 'Platform shared key',
  env: 'Environment fallback',
  config: 'No credential',
};

function ResolvedModules({ rows }: { rows: AiConfigurationIndex['resolved'] }) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-foreground">What each module calls right now</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Resolved live, including modules with nothing configured — those fall back to the
        shared pool, so they are still calling a provider.
      </p>

      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th>Module</Th>
              <Th>Provider</Th>
              <Th>Model</Th>
              <Th>Resolved from</Th>
              <Th>Credential</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.module} className="text-foreground">
                <Td>
                  <span className="font-medium">{row.module_label}</span>
                  {!row.wired && (
                    <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      not wired yet
                    </span>
                  )}
                </Td>
                <Td>{row.provider_label}</Td>
                <Td className="font-mono text-xs">{row.model ?? '—'}</Td>
                <Td className="text-xs text-muted-foreground">
                  {SOURCE_LABELS[row.source] ?? row.source}
                </Td>
                <Td>
                  {row.has_key ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">Present</span>
                  ) : (
                    <span className="text-xs text-destructive">Missing</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Small shared bits ----------------------------------------------------

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary';

const selectClass = inputClass;

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
