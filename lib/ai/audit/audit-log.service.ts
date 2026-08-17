type AuditEventType =
  | "conversation.request"
  | "conversation.response"
  | "conversation.confirmation_required"
  | "voice.transcript"
  | "voice.playback"
  | "tool.execution";

export interface AuditEventRecord {
  id: string;
  type: AuditEventType;
  timestamp: string;
  userId?: string;
  organizationId?: string;
  detail: Record<string, unknown>;
}

const auditLogStore: AuditEventRecord[] = [];
const MAX_AUDIT_LOGS = 500;

export function recordAuditEvent(
  type: AuditEventType,
  detail: Record<string, unknown>,
  context?: {
    userId?: string;
    organizationId?: string;
  }
) {
  const record: AuditEventRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: new Date().toISOString(),
    userId: context?.userId,
    organizationId: context?.organizationId,
    detail,
  };

  auditLogStore.unshift(record);
  if (auditLogStore.length > MAX_AUDIT_LOGS) {
    auditLogStore.length = MAX_AUDIT_LOGS;
  }

  console.log("[audit]", {
    type: record.type,
    userId: record.userId,
    organizationId: record.organizationId,
    detail,
  });

  return record;
}

export function listAuditEvents(userId?: string) {
  return userId
    ? auditLogStore.filter((record) => record.userId === userId)
    : auditLogStore;
}
