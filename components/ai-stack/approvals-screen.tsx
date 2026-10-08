'use client';

/**
 * AI Stack → Approvals, for any module.
 *
 * The ledger of every action the assistant proposed from this module's screens, and where each
 * stands: waiting for an administrator, approved, running, completed, failed, rejected or
 * withdrawn. Administrators decide waiting requests here as well as in the chat.
 *
 * Rows come from the approval ledger (`ai_action_requests`) scoped to this module and the
 * screens beneath it; nothing in this file is data. Deciding is enforced by the server - only an
 * administrator, never on their own request - so a button here is a convenience, not the control.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import {
  listActionRequests,
  resolveActionRequest,
  type ActionRequest,
  type ActionRequestStatus,
} from '@/lib/intelligence/ai-action-requests';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';

const LABEL: Record<ActionRequestStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  executing: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
};

export function AiStackApprovalsScreen({ module }: { module: AiStackModule }) {
  const [requests, setRequests] = useState<ActionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    listActionRequests('all', module.key, true)
      .then((rows) => {
        if (cancelled) return;
        setRequests(rows);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, module.key]);

  const counts = useMemo(() => {
    const by = (status: ActionRequestStatus) => requests.filter((request) => request.status === status).length;
    return { pending: by('pending'), completed: by('completed'), failed: by('failed'), rejected: by('rejected') };
  }, [requests]);

  const decide = async (id: number, decision: 'approved' | 'rejected') => {
    setBusy(id);
    try {
      await resolveActionRequest(id, decision);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The decision could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  if (loading && requests.length === 0 && !error) {
    return <AiStackLoading label={`Loading ${module.label} approvals…`} />;
  }

  return (
    <section className="space-y-5">
      <AiStackHeader
        icon={ShieldCheck}
        title={`${module.label} actions and approvals`}
        summary={`Every action the assistant proposed in ${module.label} and where it stands. A write runs only after the requester confirms it and, where approvals are on, an administrator other than the requester approves it.`}
        loading={loading}
        onRefresh={reload}
      />

      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      <AiStackMetrics
        metrics={[
          { key: 'total', label: 'Requests', value: requests.length, hint: `${module.label} actions` },
          { key: 'pending', label: 'Waiting', value: counts.pending, hint: 'for an administrator' },
          { key: 'completed', label: 'Completed', value: counts.completed, hint: 'ran successfully' },
          { key: 'failed', label: 'Failed', value: counts.failed, hint: 'recorded, not hidden' },
          { key: 'rejected', label: 'Rejected', value: counts.rejected, hint: 'nothing was saved' },
        ]}
      />

      {requests.length === 0 && !loading ? (
        <AiStackEmpty icon={ShieldCheck} title="No actions proposed yet">
          When the assistant proposes a change from a {module.label} screen and it is sent for approval, it appears here
          with its decision and outcome.
        </AiStackEmpty>
      ) : (
        <AiStackCard className="overflow-hidden">
          <AiStackCardHeading title="Action requests" hint="Newest first." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <AiStackTableHead columns={['When', 'Action', 'Details', 'Requested by', 'Status', 'Outcome', '']} />
              <tbody className="divide-y divide-slate-200">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatWhen(request.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{request.preview?.title ?? request.action_key}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {(request.preview?.lines ?? []).map((line) => `${line.label}: ${line.value}`).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">User {request.requested_by}</td>
                    <td className="px-4 py-3">
                      <AiStackPill tone={request.status === 'completed' ? 'green' : request.status === 'failed' || request.status === 'rejected' ? 'red' : request.status === 'pending' ? 'amber' : 'gray'}>
                        {LABEL[request.status] ?? request.status}
                      </AiStackPill>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {request.result?.message ?? request.decision_note ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {request.status === 'pending' && (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            disabled={busy === request.id}
                            onClick={() => void decide(request.id, 'approved')}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy === request.id}
                            onClick={() => void decide(request.id, 'rejected')}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AiStackCard>
      )}
    </section>
  );
}
