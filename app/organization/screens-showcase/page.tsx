'use client'

import { useState } from 'react'
import { Tabs } from '@/components/org/gtg-ui'
import { OrganizationInformation } from '@/components/org/organization-information'
import { AddOrganizationDetail } from '@/components/org/add-organization-detail'
import { type Role } from '@/lib/gtg-roles'

export default function OrgScreensShowcasePage() {
  const [activeTab, setActiveTab] = useState<'view' | 'roles'>('view')
  const [selectedRole, setSelectedRole] = useState<Role>('admin')
  const [selectedPage, setSelectedPage] = useState<'org-info' | 'add-detail'>('org-info')

  const tabs = [
    { id: 'view', label: 'Organization Information' },
    { id: 'add', label: 'Add Organization Detail' },
  ]

  const roles: { value: Role; label: string; description: string }[] = [
    { value: 'admin', label: 'Administrator', description: 'Full edit access to all fields' },
    { value: 'hr', label: 'HR Manager', description: 'View-only access to organization data' },
    { value: 'dept-head', label: 'Department Head', description: 'No access (Access Denied)' },
    { value: 'employee', label: 'Employee', description: 'No access (Access Denied)' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">Organization Profile Screens</h1>
        <p className="text-lg text-muted-foreground">
          Complete showcase of all organization management screens with role-based access control
        </p>
      </div>

      {/* Role Selector */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 text-lg font-semibold text-foreground">Select Role to View</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((role) => (
            <button
              key={role.value}
              onClick={() => setSelectedRole(role.value)}
              className={`rounded-lg border-2 px-4 py-3 text-left transition-all ${
                selectedRole === role.value
                  ? 'border-brand bg-brand/10 text-foreground'
                  : 'border-border hover:border-input bg-surface text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="font-semibold">{role.label}</div>
              <div className="text-xs text-muted-foreground">{role.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Screens Container */}
      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          {[
            { id: 'org-info', label: 'Organization Information' },
            { id: 'add-detail', label: 'Add Organization Detail' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSelectedPage(id as typeof selectedPage)}
              className={`px-4 py-2 font-medium transition-colors ${
                selectedPage === id
                  ? 'border-b-2 border-brand text-brand'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Page Content */}
        <div className="pt-4">
          {selectedPage === 'org-info' && (
            <OrganizationInformation role={selectedRole} />
          )}
          {selectedPage === 'add-detail' && (
            <AddOrganizationDetail role={selectedRole} />
          )}
        </div>
      </div>

      {/* Screen Variants Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground">Admin Role</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>✓ View all organization data</li>
            <li>✓ Edit organization information</li>
            <li>✓ Add organization details</li>
            <li>✓ Upload company logo</li>
            <li>✓ Manage sister companies</li>
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground">HR Manager Role</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>✓ View organization information</li>
            <li>✗ Cannot edit details</li>
            <li>✗ Cannot add new organizations</li>
            <li>✗ Cannot upload logo</li>
            <li className="text-amber-600">View-only mode enabled</li>
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground">Other Roles</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>✗ Department Head: No access</li>
            <li>✗ Employee: No access</li>
            <li>Access denied message shown</li>
            <li>Cannot view details</li>
            <li>Cannot modify data</li>
          </ul>
        </div>
      </div>

      {/* Responsive Design Info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Responsive Design</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-secondary p-4">
            <div className="font-mono text-sm font-semibold text-foreground">Desktop</div>
            <div className="mt-1 text-xs text-muted-foreground">1440px - Full layout</div>
          </div>
          <div className="rounded-md bg-secondary p-4">
            <div className="font-mono text-sm font-semibold text-foreground">Laptop</div>
            <div className="mt-1 text-xs text-muted-foreground">1024-1439px - Optimized</div>
          </div>
          <div className="rounded-md bg-secondary p-4">
            <div className="font-mono text-sm font-semibold text-foreground">Tablet</div>
            <div className="mt-1 text-xs text-muted-foreground">768-1023px - Stacked</div>
          </div>
          <div className="rounded-md bg-secondary p-4">
            <div className="font-mono text-sm font-semibold text-foreground">Mobile</div>
            <div className="mt-1 text-xs text-muted-foreground">320-767px - Single column</div>
          </div>
        </div>
      </div>
    </div>
  )
}
