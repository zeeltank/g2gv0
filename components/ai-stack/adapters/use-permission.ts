'use client';

/**
 * G2G's answer to LMS_K12's `app/hooks/usePermission.ts`, with the same exports and shapes.
 *
 * WHAT THE FLAGS MEAN HERE
 *
 * In LMS_K12 an agent right is a row in its RBAC registry (`agents.<module>`). In G2G the
 * whole AI API — every endpoint these screens call — sits behind `profile:admin`
 * (hp_erp routes/ai.php), so the true answer to "may this person create, run or remove an
 * AI Stack agent" is exactly "is their profile the Administrator one". That is what these
 * flags report: all four actions for an administrator, none otherwise. The server enforces
 * the same rule; this hook only lets the screen say so before a request is refused.
 */

import { useMemo } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { ROLE_GROUPS } from '@/types/role';

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';

export type ModulePermissions = Record<PermissionAction, boolean>;

export type PermissionsState = {
  permissions: Record<string, ModulePermissions> | undefined;
  loading: boolean;
  authenticated: boolean;
  error: string | null;
  refresh: () => void;
};

const noop = () => undefined;

export function usePermissions(modules: string[]): PermissionsState {
  const { user } = useAuth();
  const key = modules.join(',');

  return useMemo(() => {
    if (!user) {
      return { permissions: undefined, loading: false, authenticated: false, error: null, refresh: noop };
    }

    const allowed = ROLE_GROUPS.admin.includes(user.role);
    const flags: ModulePermissions = { view: allowed, create: allowed, update: allowed, delete: allowed };

    return {
      permissions: Object.fromEntries(key.split(',').filter(Boolean).map((module) => [module, flags])),
      loading: false,
      authenticated: true,
      error: null,
      refresh: noop,
    };
  }, [user, key]);
}

export function usePermission(module: string, action: PermissionAction): boolean | undefined {
  const modules = useMemo(() => [module], [module]);
  const { permissions, authenticated } = usePermissions(modules);

  if (!authenticated || !permissions) return undefined;

  return permissions[module]?.[action] ?? false;
}
