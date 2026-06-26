'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveBreadcrumb, type ActiveNav, GTG_NAVIGATION } from '@/lib/gtg-navigation'
import { useAuth } from '@/lib/gtg-auth'
import { GtgSidebar } from './gtg-sidebar'
import { GtgHeader } from './gtg-header'
import { GtgBreadcrumb } from './gtg-breadcrumb'
import { OrganizationInformation } from '@/components/org/organization-information'
import { OrganizationDetailsForm } from '@/components/org/organization-details'
import { DepartmentList } from '@/components/org/department-list'
import { DepartmentHierarchy } from '@/components/org/department-hierarchy'
import { AddOrganizationDetail } from '@/components/org/add-organization-detail'
import { AttendanceDashboard } from '@/components/attendance/attendance-dashboard'
import { AttendanceReportsPage } from '@/components/attendance/attendance-reports-page'
import { EmployeeDirectory } from '@/components/org/employee-directory'
import { RolePermissions } from '@/components/org/role-permissions'
import { TaskWorkspace } from '@/components/task/task-workspace'
import { MyTasksView } from '@/components/task/my-tasks-view'
import { ProjectsListView } from '@/components/task/projects-list-view'
import { DependenciesView } from '@/components/task/dependencies-view'
import { TaskCalendarView } from '@/components/task/task-calendar-view'
import { TmStatusManagement } from '@/components/task/tm-status-management'
import { TmPriorityManagement } from '@/components/task/tm-priority-management'
import { TmPermissions } from '@/components/task/tm-permissions'
import { TmIntegrations } from '@/components/task/tm-integrations'
import { TmAuditLogs } from '@/components/task/tm-audit-logs'
import type { ReactNode } from 'react'

const DEFAULT_ACTIVE: ActiveNav = {
  moduleId: 'm1',
  menuId: 'org-setup',
  submenuId: 'org-profile',
}

// Map navigation state to route paths
function getRoutePath(active: ActiveNav): string {
  return `/module/${active.moduleId}/${active.menuId}/${active.submenuId}`
}

// Parse route path to navigation state
function parseRoutePath(pathname: string): ActiveNav | null {
  const match = pathname.match(/^\/module\/([^/]+)\/([^/]+)\/([^/]+)/)
  if (match) {
    return {
      moduleId: match[1],
      menuId: match[2],
      submenuId: match[3],
    }
  }
  return null
}

// Placeholder for submenus that don't have content yet
function ComingSoonScreen({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div
        className="mb-5 flex size-14 items-center justify-center rounded-lg bg-accent text-accent-foreground"
        aria-hidden="true"
      >
        <PanelLeftClose className="size-7 opacity-50" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

// Render content based on active navigation — used when no children are provided
function renderContent(active: ActiveNav, userRole: string) {
  // M1 — Organizational Management
  if (active.moduleId === 'm1') {
    switch (active.submenuId) {
      case 'org-profile':
        return <OrganizationInformation role={userRole as any} />
      case 'dept-management':
        return <DepartmentList role={userRole as any} />
      case 'hierarchy':
        return <DepartmentHierarchy role={userRole as any} />
      case 'employee-directory':
        return <EmployeeDirectory />
      case 'role-permissions':
        return <RolePermissions />
      case 'compliance-management':
        return (
          <ComingSoonScreen
            title="Compliance Management"
            description="Track regulatory compliance, audits, and policy adherence. Coming soon."
          />
        )
      case 'disciplinary-management':
        return (
          <ComingSoonScreen
            title="Disciplinary Management"
            description="Record and manage disciplinary actions and appeals workflow. Coming soon."
          />
        )
    }
  }

  // M2 — Competency Management
  if (active.moduleId === 'm2') {
    switch (active.submenuId) {
      case 'taxonomy-library':
        return (
          <ComingSoonScreen
            title="Taxonomy & Library"
            description="Manage competency frameworks, skills taxonomy, and library mappings. Coming soon."
          />
        )
      case 'job-role-catalogue':
        return (
          <ComingSoonScreen
            title="Job Role Catalogue"
            description="Define and maintain job roles with associated competencies and levels. Coming soon."
          />
        )
      case 'employee-rating':
        return (
          <ComingSoonScreen
            title="Employee Rating"
            description="View and manage competency ratings for employees across roles. Coming soon."
          />
        )
    }
  }

  // M3 — Talent Management
  if (active.moduleId === 'm3') {
    switch (active.submenuId) {
      case 'recruitment-dashboard':
        return (
          <ComingSoonScreen
            title="Recruitment Dashboard"
            description="Overview of hiring pipelines, open requisitions, and recruitment metrics. Coming soon."
          />
        )
      case 'job-postings':
        return (
          <ComingSoonScreen
            title="Job Postings"
            description="Create, manage, and publish job openings across channels. Coming soon."
          />
        )
      case 'interview-management':
        return (
          <ComingSoonScreen
            title="Interview Management"
            description="Schedule, track, and evaluate candidate interviews. Coming soon."
          />
        )
      case 'manager-hub':
        return (
          <ComingSoonScreen
            title="Manager Hub"
            description="Centralized view for managers to review hiring progress and candidate feedback. Coming soon."
          />
        )
      case 'performance-reviews':
        return (
          <ComingSoonScreen
            title="Performance Reviews"
            description="Conduct and track employee performance reviews and 360-degree feedback. Coming soon."
          />
        )
      case 'appraisals-succession':
        return (
          <ComingSoonScreen
            title="Appraisals & Succession"
            description="Manage annual appraisals and succession planning workflows. Coming soon."
          />
        )
      case 'document-templates':
        return (
          <ComingSoonScreen
            title="Document Templates"
            description="Create and manage HR document templates for offers, letters, and policies. Coming soon."
          />
        )
    }
  }

  // M4 — LMS
  if (active.moduleId === 'm4') {
    switch (active.submenuId) {
      case 'learning-dashboard':
        return (
          <ComingSoonScreen
            title="Learning Dashboard"
            description="Track enrollment, completion rates, and learning paths across the organization. Coming soon."
          />
        )
      case 'course-catalogue':
        return (
          <ComingSoonScreen
            title="Course Catalogue"
            description="Browse, assign, and manage training courses and learning resources. Coming soon."
          />
        )
      case 'assessment-centre':
        return (
          <ComingSoonScreen
            title="Assessment Centre"
            description="Create and manage assessments, quizzes, and certification exams. Coming soon."
          />
        )
    }
  }

// M5 — HRIT Solutions
  if (active.moduleId === 'm5') {
    switch (active.submenuId) {
      case 'attendance-tracking':
        return <AttendanceDashboard />
      case 'attendance-reports':
        return <AttendanceReportsPage />
      case 'leave-operations':
        return (
          <ComingSoonScreen
            title="Leave Operations"
            description="Process leave requests, approvals, and policy management. Coming soon."
          />
        )
      case 'payroll-processing':
        return (
          <ComingSoonScreen
            title="Payroll Processing"
            description="Run payroll cycles, manage salary components, and generate payslips. Coming soon."
          />
        )
    }
  }

  // M6 — Task Management
  if (active.moduleId === 'm6') {
    switch (active.submenuId) {
      case 'tm-dashboard':
      case 'task-workspace':
        return <TaskWorkspace />
      case 'tm-tasks':
      case 'my-tasks':
        return <MyTasksView />
      case 'tm-projects':
      case 'projects-list':
        return <ProjectsListView />
      case 'tm-dependencies':
      case 'dependencies-view':
        return <DependenciesView />
      case 'tm-approvals':
        return <ComingSoonScreen title="Approvals" description="Manage and track task approvals." />
      case 'tm-calendar':
      case 'calendar-view':
        return <TaskCalendarView />
      case 'status-management':
        return <TmStatusManagement />
      case 'priority-management':
        return <TmPriorityManagement />
      case 'permissions':
        return <TmPermissions />
      case 'integrations':
        return <TmIntegrations />
      case 'audit-logs':
        return <TmAuditLogs />
    }
  }

  return (
    <ComingSoonScreen
      title="Application Shell Ready"
      description="This is the GapstoGrowth master application layout. Select a module in the sidebar to get started."
    />
  )
}

interface GtgAppShellProps {
  /** Override the default content renderer with custom page content */
  children?: ReactNode
  /** Override the initial active navigation state (defaults to Org Profile) */
  initialActive?: ActiveNav
}

export function GtgAppShell({ children, initialActive }: GtgAppShellProps = {}) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [active, setActive] = useState<ActiveNav>(() => {
    if (initialActive) return initialActive
    if (!children && pathname) {
      const parsed = parseRoutePath(pathname)
      if (parsed) return parsed
    }
    return DEFAULT_ACTIVE
  })

  // Parse active state from URL only when no children override is active
  useEffect(() => {
    if (children) return
    const parsed = parseRoutePath(pathname)
    if (parsed) {
      setActive((prev) => {
        if (
          prev.moduleId === parsed.moduleId &&
          prev.menuId === parsed.menuId &&
          prev.submenuId === parsed.submenuId
        ) {
          return prev
        }
        return parsed
      })
    }
  }, [pathname, children])

  // Navigate when active state changes (skip when children provide their own content)
  const handleNavSelect = (next: ActiveNav) => {
    // Always navigate to the canonical /module/ route so the URL stays in sync
    // State will naturally update via URL parsing on the new route
    router.push(getRoutePath(next))
  }

  const crumb = resolveBreadcrumb(active)

  return (
    <div
      role="application"
      aria-label="GapstoGrowth HRMS"
      className="flex h-screen w-full bg-background"
    >
      <GtgSidebar
        active={active}
        onSelect={handleNavSelect}
        role={user?.role || 'employee'}
      />

      <div
        className="flex h-screen w-full flex-col pl-[72px]"
      >
        <GtgHeader />
        <GtgBreadcrumb
          module={crumb.module}
          menu={crumb.menu}
          submenu={crumb.submenu}
        />

        <main className="g2g-page-scroll g2g-scrollbar flex-1 bg-background flex flex-col">
          <div className="w-full p-6 flex flex-col flex-1 min-h-0">
            {children ?? renderContent(active, user?.role || 'employee')}
          </div>
        </main>
      </div>
    </div>
  )
}
