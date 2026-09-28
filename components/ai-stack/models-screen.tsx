'use client';

/**
 * AI Stack → Models, for any module.
 *
 * THIS TAB CONFIGURES THIS MODULE, AND NOTHING LEAVES IT
 *
 * The AI Stack inside a module is decentralised. Choosing a model here applies to this
 * module and to no other, it is saved from this screen, and there is deliberately NO link
 * to AI & Intelligence anywhere on it. Opening Fees → AI Stack → Models and picking a
 * model is something you finish in Fees.
 *
 * That is a change from what this tab used to be. It was a read-only window onto the
 * central console with two "open Model Management" links, on the reasoning that a
 * per-module editor is a second place to change one estate-wide setting. The reasoning was
 * wrong about what was being edited: a module choosing its own model is not a second way
 * to edit the estate's, it is a different setting with a different scope. The two now live
 * in different tables and never touch the same row.
 *
 * WHERE EACH SETTING LIVES
 *
 *   this tab              `ai_module_model_bindings` — product module × capability.
 *                         "When Fees makes a conversational call, use this model."
 *   AI & Intelligence     `ai_api_keys` and `ai_models` — capability, estate-wide.
 *                         "Conversational AI runs on this provider by default."
 *
 * A module with no binding inherits the estate's configuration; a module with one
 * overrides it for itself. Clearing a choice puts the module back on the estate default.
 *
 * TWO REGISTRIES ARE CALLED "MODULE" AND THEY ARE NOT THE SAME THING
 *
 *   `ai_modules`        PRODUCT modules — Fees, PTM, Hostel. What a page is about.
 *   `AiModuleRegistry`  AI CAPABILITY modules — Conversational AI, Generative AI, Agent
 *                       Reasoning. What a request IS.
 *
 * A binding is the intersection of the two, which is why the rows below are capabilities
 * and the module is fixed. The backend only offers the capabilities this module's own
 * flags say it uses — a module with `generative` off is never asked to choose a generative
 * model, because that setting would do nothing.
 *
 * WHAT `effective` MEANS
 *
 * It is resolved through `AiConfigurationResolver` — the same code the module's next call
 * runs — rather than restated from the saved row. So a binding naming a provider with no
 * usable credential shows what the fallback actually gave it, instead of what was typed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Cpu, KeyRound, Plus, Power, RotateCcw, TriangleAlert, X } from 'lucide-react';

import {
  clearModuleModel,
  createModuleModelCredential,
  fetchModuleModels,
  isModuleOwnChoice,
  saveModuleModel,
  updateModuleModelCredential,
  type AiModuleCredentialOption,
  type AiModuleModelIndex,
  type AiModuleModelRow,
  type AiModuleProviderOption,
} from '@/lib/intelligence/ai-module';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  formatWhen,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';

/** What each capability does for this module, in the module's own terms. */
const WHAT_IT_DOES: Record<string, string> = {
  conversational_ai: 'Answers a question asked from one of this module’s pages.',
  generative_ai: 'Writes the prose behind this module’s prompts and fills its report layouts.',
  agent_reasoning: 'Reasons for this module’s agents — planning and tool selection.',
};

/** The form state for one capability row, before it is saved. */
interface Draft {
  provider: string;
  model: string;
  credentialId: string;
  maxOutputTokens: string;
}

/** The form state for adding a brand-new model + credential to one capability row. */
interface NewCredentialDraft {
  provider: string;
  model: string;
  modelLabel: string;
  apiKey: string;
  accountEmail: string;
  apiLimit: string;
}

function emptyNewCredentialDraft(provider: string): NewCredentialDraft {
  return { provider, model: '', modelLabel: '', apiKey: '', accountEmail: '', apiLimit: '' };
}

/** The form state for editing the credential currently selected on one capability row. */
interface EditCredentialDraft {
  model: string;
  accountEmail: string;
  apiLimit: string;
  apiKey: string;
}

function draftFrom(row: AiModuleModelRow): Draft {
  return {
    // Pre-filled from the saved binding where there is one, and otherwise from what the
    // module currently resolves to — so "save" without touching anything pins the module
    // to what it is already using rather than to an empty provider.
    provider: row.binding?.provider ?? row.effective.provider ?? '',
    model: row.binding?.model ?? row.effective.model ?? '',
    credentialId: row.binding?.api_key_id == null ? '' : String(row.binding.api_key_id),
    maxOutputTokens: row.binding?.max_output_tokens == null ? '' : String(row.binding.max_output_tokens),
  };
}

/**
 * Everything this screen needs to know about the module it is configuring.
 *
 * Narrower than `AiStackModule` on purpose. A binding is keyed by the product module and
 * the capability, and the only other thing on the screen is the module's name — nothing
 * else in a descriptor bears on which model a module runs on. Taking the narrow type lets
 * the four hand-written stacks (Fees, Attendance, Admission, Student) mount this tab by
 * naming themselves, without first inventing report filters and agent manifests that this
 * tab would never read. Any full `AiStackModule` still satisfies it.
 */
export type AiStackModelsModule = Pick<AiStackModule, 'key' | 'label'>;

export function AiStackModelsScreen({ module }: { module: AiStackModelsModule }) {
  const [index, setIndex] = useState<AiModuleModelIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // "Add new model" — which capability's panel is open, and its own draft, separate from
  // `drafts` above so opening it never disturbs the picker's current selection.
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newCredentialDrafts, setNewCredentialDrafts] = useState<Record<string, NewCredentialDraft>>({});

  // Editing the credential currently selected on one capability row.
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const [editCredentialDrafts, setEditCredentialDrafts] = useState<Record<string, EditCredentialDraft>>({});

  // `load` is the manual reload path — retry, refresh, and after a save or reset — all
  // triggered from event handlers, never from an effect body, so it may reset
  // `loading`/`error` synchronously before its `await`.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const next = await fetchModuleModels(module.key);
      setIndex(next);
      setDrafts(Object.fromEntries(next.rows.map((row) => [row.capability, draftFrom(row)])));
    } catch (cause) {
      // The real error, never a placeholder configuration. A screen that invented a
      // provider here would be the one thing this whole tab exists not to do.
      setError(cause instanceof Error ? cause.message : 'Could not read this module’s model configuration.');
      setIndex(null);
    } finally {
      setLoading(false);
    }
  }, [module.key]);

  // The mount fetch is written inline rather than as a call to `load`, so no setState
  // runs synchronously within the effect body — `loading` and `error` already start at
  // the right values (`true` and `null`), and every state update below happens inside a
  // promise callback, after the effect has committed.
  useEffect(() => {
    let cancelled = false;

    fetchModuleModels(module.key)
      .then((next) => {
        if (cancelled) return;
        setIndex(next);
        setDrafts(Object.fromEntries(next.rows.map((row) => [row.capability, draftFrom(row)])));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Could not read this module’s model configuration.');
        setIndex(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [module.key]);

  const providers = index?.providers ?? [];
  const credentials = index?.credentials ?? [];

  const own = useMemo(
    () => (index?.rows ?? []).filter((row) => isModuleOwnChoice(row.effective)).length,
    [index],
  );

  const save = useCallback(
    async (row: AiModuleModelRow) => {
      const draft = drafts[row.capability];

      if (!draft || !draft.provider) {
        setNotice('Choose a provider before saving.');
        return;
      }

      setBusy(row.capability);
      setNotice(null);

      try {
        await saveModuleModel(module.key, {
          capability: row.capability,
          provider: draft.provider,
          model: draft.model.trim() === '' ? null : draft.model.trim(),
          api_key_id: draft.credentialId === '' ? null : Number(draft.credentialId),
          max_output_tokens: draft.maxOutputTokens.trim() === '' ? null : Number(draft.maxOutputTokens),
        });

        // Reloaded rather than patched in place: `effective` is resolved server-side and
        // a local guess at it could disagree with what the module will actually use.
        await load();
        setNotice(`${module.label} will use that model for ${row.label.toLowerCase()}.`);
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : 'That could not be saved.');
      } finally {
        setBusy(null);
      }
    },
    [drafts, load, module.key, module.label],
  );

  const reset = useCallback(
    async (row: AiModuleModelRow) => {
      setBusy(row.capability);
      setNotice(null);

      try {
        const result = await clearModuleModel(module.key, row.capability);
        await load();
        setNotice(
          result.cleared
            ? `${module.label} is back on the configuration the rest of the estate uses.`
            : `${module.label} had no choice of its own to clear.`,
        );
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : 'That could not be cleared.');
      } finally {
        setBusy(null);
      }
    },
    [load, module.key, module.label],
  );

  /** Add a brand-new model + credential for one capability, and use it here immediately. */
  const addCredential = useCallback(
    async (row: AiModuleModelRow) => {
      const draft = newCredentialDrafts[row.capability];

      if (!draft || !draft.provider || !draft.model.trim() || !draft.apiKey.trim()) {
        setNotice('Choose a provider, name a model and paste an API key before adding it.');
        return;
      }

      setBusy(row.capability);
      setNotice(null);

      try {
        await createModuleModelCredential(module.key, {
          capability: row.capability,
          provider: draft.provider,
          model: draft.model.trim(),
          model_label: draft.modelLabel.trim() === '' ? null : draft.modelLabel.trim(),
          api_key: draft.apiKey.trim(),
          account_email: draft.accountEmail.trim() === '' ? null : draft.accountEmail.trim(),
          api_limit: draft.apiLimit.trim() === '' ? null : Number(draft.apiLimit.trim()),
        });

        await load();
        setAddingFor(null);
        setNewCredentialDrafts((current) => {
          const next = { ...current };
          delete next[row.capability];
          return next;
        });
        setNotice(`Added ${draft.model.trim()} and ${module.label} will use it for ${row.label.toLowerCase()}.`);
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : 'That model could not be added.');
      } finally {
        setBusy(null);
      }
    },
    [load, module.key, module.label, newCredentialDrafts],
  );

  /** Save edits to the credential currently selected on one capability row. */
  const saveEditedCredential = useCallback(
    async (row: AiModuleModelRow, credentialId: number) => {
      const draft = editCredentialDrafts[row.capability];
      if (!draft) return;

      setBusy(row.capability);
      setNotice(null);

      try {
        await updateModuleModelCredential(module.key, credentialId, {
          model: draft.model.trim() === '' ? undefined : draft.model.trim(),
          api_key: draft.apiKey.trim() === '' ? undefined : draft.apiKey.trim(),
          account_email: draft.accountEmail.trim() === '' ? null : draft.accountEmail.trim(),
          api_limit: draft.apiLimit.trim() === '' ? null : Number(draft.apiLimit.trim()),
        });

        await load();
        setEditingFor(null);
        setNotice('Credential updated.');
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : 'That could not be saved.');
      } finally {
        setBusy(null);
      }
    },
    [editCredentialDrafts, load, module.key],
  );

  /** Enable or disable the credential currently selected on one capability row. */
  const toggleCredentialStatus = useCallback(
    async (row: AiModuleModelRow, credentialId: number, enable: boolean) => {
      setBusy(row.capability);
      setNotice(null);

      try {
        await updateModuleModelCredential(module.key, credentialId, { status: enable });
        await load();
        setNotice(enable ? 'Credential enabled.' : 'Credential disabled — this module will fall back to its next choice.');
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : 'That could not be changed.');
      } finally {
        setBusy(null);
      }
    },
    [load, module.key],
  );

  if (loading) {
    return <AiStackLoading label={`Reading ${module.label}’s model configuration…`} />;
  }

  if (error) {
    return <AiStackError onRetry={() => void load()}>{error}</AiStackError>;
  }

  const rows = index?.rows ?? [];

  return (
    <div className="space-y-6">
      <AiStackHeader
        icon={Cpu}
        title={`${module.label} — models`}
        summary={`What ${module.label}’s AI runs on. Everything here applies to ${module.label} and to no other module.`}
        loading={busy !== null}
        onRefresh={() => void load()}
      />

      <AiStackMetrics
        metrics={[
          { key: 'capabilities', label: 'Capabilities this module uses', value: rows.length },
          {
            key: 'own',
            label: 'On this module’s own choice',
            value: own,
            hint: 'Chosen here, and applying to this module only.',
          },
          {
            key: 'inherited',
            label: 'Inheriting the estate default',
            value: rows.length - own,
            hint: 'Following whatever the rest of the system uses.',
          },
        ]}
      />

      {notice ? <AiStackHint>{notice}</AiStackHint> : null}

      {rows.length === 0 ? (
        <AiStackCard className="overflow-hidden">
          <AiStackCardHeading
            title="This module calls no model"
            hint={`${module.label} has no conversational, generative or agent capability switched on, so there is nothing here to configure.`}
          />
          <p className="px-5 py-4 text-sm text-slate-600">
            Switching a capability on is done where the module’s capabilities are set, not on
            this tab — and this tab would have nothing to say about a capability the module
            never invokes.
          </p>
        </AiStackCard>
      ) : null}

      {rows.map((row) => {
        const draft = drafts[row.capability] ?? draftFrom(row);
        const provider = providers.find((candidate) => candidate.key === draft.provider);
        const ownChoice = isModuleOwnChoice(row.effective);
        const working = busy === row.capability;

        return (
          <AiStackCard key={row.capability} className="overflow-hidden">
            <AiStackCardHeading
              title={row.label}
              hint={WHAT_IT_DOES[row.capability] ?? row.description}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <AiStackPill tone={ownChoice ? 'green' : 'gray'}>
                    {ownChoice ? `${module.label}’s own choice` : 'Estate default'}
                  </AiStackPill>
                  {row.wired ? null : <AiStackPill tone="amber">Stored, not yet read</AiStackPill>}
                </div>
              }
            />

            <div className="px-5 py-4">

            {/*
              What the module will actually use, resolved by the same code the call runs.
              Shown above the form because it is the answer to the question somebody opened
              this tab with.
            */}
            <dl className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">In force now</dt>
                <dd className="mt-1 font-medium text-slate-900">{row.effective.provider_label}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Model</dt>
                <dd className="mt-1 font-mono text-[13px] text-slate-900">
                  {row.effective.model ?? 'the provider’s own default'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Credential</dt>
                <dd className="mt-1 text-slate-900">
                  {row.effective.has_credential ? 'resolved' : 'none — calls will fail'}
                </dd>
              </div>
            </dl>

            {row.wired ? null : (
              <p className="mt-3 flex items-start gap-2 text-sm text-amber-700">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  This capability still reaches its provider its own way, so a choice saved
                  here is stored and shown but not yet read. It is recorded rather than
                  refused, so the setting is ready when the capability is wired.
                </span>
              </p>
            )}

            {row.binding && !row.binding.editable ? (
              <p className="mt-3 text-sm text-slate-600">
                A default for {module.label} is set for the whole estate
                {row.binding.updated_at ? ` (${formatWhen(row.binding.updated_at)})` : ''}. Saving
                below gives this school its own choice and leaves the estate default alone.
              </p>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Provider</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={draft.provider}
                  disabled={working}
                  onChange={(event) => {
                    const nextProvider = event.target.value;
                    const known = providers.find((candidate) => candidate.key === nextProvider);

                    setDrafts((current) => ({
                      ...current,
                      [row.capability]: {
                        ...draft,
                        provider: nextProvider,
                        // The model belongs to the provider, so changing one clears the
                        // other rather than leaving a model this provider cannot serve.
                        model: known?.default_model ?? '',
                        credentialId: '',
                      },
                    }));
                  }}
                >
                  <option value="">Choose a provider…</option>
                  {providers.map((option: AiModuleProviderOption) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium text-slate-700">Model</span>
                {provider && provider.models.length > 0 ? (
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={draft.model}
                    disabled={working}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [row.capability]: { ...draft, model: event.target.value },
                      }))
                    }
                  >
                    <option value="">The provider’s own default</option>
                    {provider.models.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                        {option.scope === 'institute' ? ' (this school)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[13px]"
                    value={draft.model}
                    disabled={working}
                    placeholder="The provider’s own default"
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [row.capability]: { ...draft, model: event.target.value },
                      }))
                    }
                  />
                )}
              </label>

              <label className="block text-sm">
                <span className="font-medium text-slate-700">Credential</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={draft.credentialId}
                  disabled={working}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [row.capability]: { ...draft, credentialId: event.target.value },
                    }))
                  }
                >
                  {/*
                    The usual answer. Choosing a model should not require handing out a
                    second key, so a blank credential means "whatever this provider would
                    have used anyway".
                  */}
                  <option value="">Use the credential this provider already uses</option>
                  {credentials
                    .filter((option: AiModuleCredentialOption) =>
                      draft.provider === '' ? true : option.provider === draft.provider,
                    )
                    .map((option) => (
                      <option key={option.id} value={String(option.id)}>
                        {option.label}
                        {option.daily_limit == null ? '' : ` — ${option.daily_limit}/day`}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium text-slate-700">Maximum output tokens</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={draft.maxOutputTokens}
                  disabled={working}
                  inputMode="numeric"
                  placeholder="Leave blank for the provider’s ceiling"
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [row.capability]: { ...draft, maxOutputTokens: event.target.value },
                    }))
                  }
                />
              </label>
            </div>

            {(() => {
              const selectedCredential = credentials.find(
                (option) => String(option.id) === draft.credentialId,
              );
              const canEditSelected = selectedCredential?.scope === 'institute';
              const addOpen = addingFor === row.capability;
              const editOpen = editingFor === row.capability;

              return (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
                    disabled={working}
                    onClick={() => {
                      setEditingFor(null);
                      setAddingFor(addOpen ? null : row.capability);
                      setNewCredentialDrafts((current) => ({
                        ...current,
                        [row.capability]: current[row.capability] ?? emptyNewCredentialDraft(draft.provider),
                      }));
                    }}
                  >
                    {addOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
                    {addOpen ? 'Cancel' : 'Add new model'}
                  </button>

                  {canEditSelected && selectedCredential ? (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-800 disabled:opacity-60"
                        disabled={working}
                        onClick={() => {
                          setAddingFor(null);
                          setEditingFor(editOpen ? null : row.capability);
                          setEditCredentialDrafts((current) => ({
                            ...current,
                            [row.capability]: current[row.capability] ?? {
                              model: draft.model,
                              accountEmail:
                                selectedCredential.label.startsWith('Credential #') ? '' : selectedCredential.label,
                              apiLimit: selectedCredential.daily_limit == null ? '' : String(selectedCredential.daily_limit),
                              apiKey: '',
                            },
                          }));
                        }}
                      >
                        {editOpen ? <X className="size-3.5" /> : null}
                        {editOpen ? 'Cancel' : 'Edit this credential'}
                      </button>

                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 font-medium text-amber-700 hover:text-amber-800 disabled:opacity-60"
                        disabled={working}
                        onClick={() => void toggleCredentialStatus(row, selectedCredential.id, false)}
                      >
                        <Power className="size-3.5" />
                        Disable
                      </button>
                    </>
                  ) : null}
                </div>
              );
            })()}

            {addingFor === row.capability ? (
              <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
                <p className="text-sm font-medium text-slate-800">
                  Add a new model for {module.label}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Creates this school’s own credential — not the estate default — and uses it for{' '}
                  {row.label.toLowerCase()} immediately after it is added.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Provider</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={newCredentialDrafts[row.capability]?.provider ?? draft.provider}
                      disabled={working}
                      onChange={(event) =>
                        setNewCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? emptyNewCredentialDraft('')),
                            provider: event.target.value,
                          },
                        }))
                      }
                    >
                      <option value="">Choose a provider…</option>
                      {providers.map((option: AiModuleProviderOption) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Model id</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[13px]"
                      placeholder="e.g. gpt-4o-mini"
                      value={newCredentialDrafts[row.capability]?.model ?? ''}
                      disabled={working}
                      onChange={(event) =>
                        setNewCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? emptyNewCredentialDraft(draft.provider)),
                            model: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Display label (optional)</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="How this model is shown in the picker"
                      value={newCredentialDrafts[row.capability]?.modelLabel ?? ''}
                      disabled={working}
                      onChange={(event) =>
                        setNewCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? emptyNewCredentialDraft(draft.provider)),
                            modelLabel: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">API key</span>
                    <input
                      type="password"
                      autoComplete="off"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[13px]"
                      placeholder="Pasted once; never shown again"
                      value={newCredentialDrafts[row.capability]?.apiKey ?? ''}
                      disabled={working}
                      onChange={(event) =>
                        setNewCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? emptyNewCredentialDraft(draft.provider)),
                            apiKey: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Account email (optional)</span>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="So this credential is easy to tell apart later"
                      value={newCredentialDrafts[row.capability]?.accountEmail ?? ''}
                      disabled={working}
                      onChange={(event) =>
                        setNewCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? emptyNewCredentialDraft(draft.provider)),
                            accountEmail: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Daily limit (optional)</span>
                    <input
                      inputMode="numeric"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Requests per day"
                      value={newCredentialDrafts[row.capability]?.apiLimit ?? ''}
                      disabled={working}
                      onChange={(event) =>
                        setNewCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? emptyNewCredentialDraft(draft.provider)),
                            apiLimit: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={working}
                    onClick={() => void addCredential(row)}
                  >
                    <Plus className="size-4" />
                    {working ? 'Adding…' : 'Save and use this model'}
                  </button>
                </div>
              </div>
            ) : null}

            {editingFor === row.capability && drafts[row.capability] ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">Edit this credential</p>
                <p className="mt-1 text-xs text-slate-600">
                  Leave the API key blank to keep the one already stored.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Model id</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[13px]"
                      value={editCredentialDrafts[row.capability]?.model ?? ''}
                      disabled={working}
                      onChange={(event) =>
                        setEditCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? { model: '', accountEmail: '', apiLimit: '', apiKey: '' }),
                            model: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">New API key (optional)</span>
                    <input
                      type="password"
                      autoComplete="off"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[13px]"
                      placeholder="Leave blank to keep the current key"
                      value={editCredentialDrafts[row.capability]?.apiKey ?? ''}
                      disabled={working}
                      onChange={(event) =>
                        setEditCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? { model: '', accountEmail: '', apiLimit: '', apiKey: '' }),
                            apiKey: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Account email</span>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={editCredentialDrafts[row.capability]?.accountEmail ?? ''}
                      disabled={working}
                      onChange={(event) =>
                        setEditCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? { model: '', accountEmail: '', apiLimit: '', apiKey: '' }),
                            accountEmail: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Daily limit</span>
                    <input
                      inputMode="numeric"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={editCredentialDrafts[row.capability]?.apiLimit ?? ''}
                      disabled={working}
                      onChange={(event) =>
                        setEditCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: {
                            ...(current[row.capability] ?? { model: '', accountEmail: '', apiLimit: '', apiKey: '' }),
                            apiLimit: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    disabled={working || draft.credentialId === ''}
                    onClick={() => {
                      const id = Number(draft.credentialId);
                      if (Number.isFinite(id) && id > 0) void saveEditedCredential(row, id);
                    }}
                  >
                    <Check className="size-4" />
                    {working ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={working || draft.provider === ''}
                onClick={() => void save(row)}
              >
                <Check className="size-4" />
                {working ? 'Saving…' : `Use this for ${module.label}`}
              </button>

              {ownChoice && row.binding?.editable ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                  disabled={working}
                  onClick={() => void reset(row)}
                >
                  <RotateCcw className="size-4" />
                  Use the estate default instead
                </button>
              ) : null}

              {draft.credentialId === '' ? null : (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <KeyRound className="size-3.5" />
                  This module will use its own credential and quota.
                </span>
              )}
            </div>
            </div>
          </AiStackCard>
        );
      })}

      {/*
        No link to AI & Intelligence, deliberately. What is configured here is this
        module's; what is configured there is the estate's; and a module's AI Stack that
        sent somebody to the central console would be neither decentralised nor honest
        about which setting they were about to change.
      */}
      <AiStackHint>
        Everything on this tab applies to {module.label} only. A capability left on the
        estate default follows whatever the rest of the system uses, and clearing a choice
        puts it back there.
      </AiStackHint>
    </div>
  );
}
