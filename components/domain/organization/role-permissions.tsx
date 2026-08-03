'use client'

import { lazy, Suspense, useMemo, useState } from 'react'
import { Search, Plus, ShieldCheck, Save, Users, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRolePermissions } from '@/hooks/use-role-permissions'

const LazyRolePermissionsMatrix = lazy(() =>
  import('./role-permissions-matrix').then((module) => ({ default: module.RolePermissionsMatrix })),
)

function PermissionsSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto bg-surface p-6">
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
        ))}
      </div>
    </div>
  )
}

/**
 * Role & Permissions.
 *
 * The matrix is the live tblmenumaster_g2g tree - the same Modules -> Menus ->
 * Submenus rows the sidebar is built from - so ticking View here is what makes
 * a screen appear in that role's navigation.
 */
export function RolePermissions() {
  const {
    roles,
    rolesLoading,
    activeRoleId,
    activeRole,
    setActiveRoleId,
    permissions,
    permissionsLoading,
    error,
    hasChanges,
    saving,
    animateKey,
    toggleAction,
    toggleNodeAll,
    toggleModuleColumn,
    save,
    createRole,
  } = useRolePermissions()

  const [searchQuery, setSearchQuery] = useState('')
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const filteredRoles = useMemo(
    () => roles.filter((role) => role.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery, roles],
  )

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return
    setCreating(true)
    const created = await createRole({ name: newRoleName.trim(), description: newRoleDesc.trim() })
    setCreating(false)
    if (!created) return
    setIsAddRoleOpen(false)
    setNewRoleName('')
    setNewRoleDesc('')
  }

  return (
    <div className="flex h-full min-h-0 gap-6 overflow-hidden">

      {/* Left Sidebar: Roles List */}
      <div className="flex w-80 flex-col rounded-xl border bg-card shadow-sm overflow-hidden shrink-0">
        <div className="px-4 border-b bg-muted/20 shrink-0 h-[116px] flex flex-col justify-center gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Access Roles
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsAddRoleOpen(true)}
              className="h-8 px-2 text-primary cursor-pointer hover:bg-primary/10 active:scale-95 transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {rolesLoading && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          )}

          {!rolesLoading && filteredRoles.map(role => (
            <button
              key={role.id}
              onClick={() => setActiveRoleId(String(role.id))}
              className={cn(
                "w-full text-left px-3 py-3 rounded-lg transition-all duration-300 cursor-pointer flex flex-col gap-1 active:scale-[0.98]",
                activeRoleId === String(role.id)
                  ? "bg-primary/10 border border-primary/20 shadow-sm"
                  : "hover:bg-muted/60 border border-transparent hover:shadow-sm"
              )}
            >
              <div className="flex justify-between items-center w-full">
                <span className={cn(
                  "font-medium text-sm",
                  activeRoleId === String(role.id) ? "text-primary font-semibold" : "text-foreground"
                )}>
                  {role.name}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> {role.user_count}
                </span>
              </div>
              <span className="text-xs text-muted-foreground line-clamp-1">
                {role.description || 'No description'}
              </span>
            </button>
          ))}

          {!rolesLoading && filteredRoles.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No roles found.
            </div>
          )}
        </div>
      </div>

      {/* Right Main Area: Permissions */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        {activeRole ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 border-b bg-muted/10 shrink-0 h-[116px]">
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {activeRole.name} Permissions
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  {activeRole.description ? `${activeRole.description}. ` : ''}
                  Rights apply to the live menu tree - View is what puts a screen in this role&apos;s sidebar.
                </p>
              </div>
              <Button
                onClick={save}
                disabled={!hasChanges || saving}
                className={cn(
                  "cursor-pointer shadow-sm transition-all duration-300 active:scale-95",
                  hasChanges && !saving
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-6 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Permissions List */}
            {permissionsLoading ? (
              <PermissionsSkeleton />
            ) : (
              <Suspense fallback={<PermissionsSkeleton />}>
                <LazyRolePermissionsMatrix
                  modules={permissions}
                  animateKey={animateKey}
                  onToggleAction={toggleAction}
                  onToggleNodeAll={toggleNodeAll}
                  onToggleModuleColumn={toggleModuleColumn}
                />
              </Suspense>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-2">
            <ShieldCheck className="h-12 w-12 opacity-20 animate-pulse" />
            <p>{rolesLoading ? 'Loading roles...' : 'Select a role from the sidebar to configure permissions.'}</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </div>

      <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
        <DialogContent className="sm:max-w-[425px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Add New Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Sales Director"
                className="transition-all duration-200 focus-visible:ring-primary/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Brief description of responsibilities"
                className="transition-all duration-200 focus-visible:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRoleOpen(false)} className="active:scale-95 transition-transform">
              Cancel
            </Button>
            <Button onClick={handleAddRole} disabled={!newRoleName.trim() || creating} className="active:scale-95 transition-transform">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
