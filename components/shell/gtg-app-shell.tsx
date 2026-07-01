'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { PanelLeftClose } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveBreadcrumb, type ActiveNav } from '@/lib/gtg-navigation'
import { useAuth } from '@/lib/gtg-auth'
import { GtgSidebar } from './gtg-sidebar'
import { GtgHeader } from './gtg-header'
import { FloatingToolbar } from './gtg-floating-toolbar'
import { GtgBreadcrumb } from './gtg-breadcrumb'
import { AgentPanel } from '@/components/shell/agent/agent-drawer'
import { OrganizationInformation } from '@/components/org/organization-information'
import { OrganizationDetailsForm } from '@/components/org/organization-details'
import { DepartmentList } from '@/components/org/department-list'
import { DepartmentHierarchy } from '@/components/org/department-hierarchy'
import { AddOrganizationDetail } from '@/components/org/add-organization-detail'
import { CmCommandCenter } from '@/components/competency/cm-command-center'
import { CmCompetencyLibrary } from '@/components/competency/cm-competency-library'
import { CmFrameworkMapping } from '@/components/competency/cm-framework-mapping'
import { CmAssessmentWorkspace } from '@/components/competency/cm-assessment-workspace'
import { CmEmployeeProfiles } from '@/components/competency/cm-employee-profiles'
import { CmDevelopmentCareer } from '@/components/competency/cm-development-career'
import { CmCertifications } from '@/components/competency/cm-certifications'
import { CmAudit } from '@/components/competency/cm-audit'
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
import { LmsDashboard } from '@/components/lms/dashboard/lms-dashboard'
import { LearningCatalog } from '@/components/lms/catalog/learning-catalog'
import { CreateCoursePage } from '@/components/lms/course-builder/create-course-page'
import { LearningAssignments } from '@/components/lms/assignments/learning-assignments'
import { LearningDeliveryWorkspace } from '@/components/lms/delivery/learning-delivery-workspace'
import { SessionsCalendar } from '@/components/lms/sessions/sessions-calendar'
import { CertificationsRecords } from '@/components/lms/records/certifications-records'
import { LmsGovernance } from '@/components/lms/governance/lms-governance'
import { TalentDashboard } from '@/components/talent/dashboard/talent-dashboard'
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
    const routeId = active.submenuId || active.menuId
    switch (routeId) {
      case 'cm-command-center':
        return <CmCommandCenter />
      case 'cm-competency-library':
        return <CmCompetencyLibrary />
      case 'cm-framework-mapping':
        return <CmFrameworkMapping />
      case 'cm-assessments':
        return <CmAssessmentWorkspace />
      case 'cm-employee-profiles':
        return <CmEmployeeProfiles />
      case 'cm-development-career':
        return <CmDevelopmentCareer />
      case 'cm-certifications':
        return <CmCertifications />
      case 'cm-audit':
        return <CmAudit />
      default:
        return (
          <ComingSoonScreen
            title="Competency Management"
            description="Manage and track workforce capabilities. Coming soon."
          />
        )
    }
  }

  // M3 — Talent Management
  if (active.moduleId === 'm3') {
    switch (active.menuId) {
      case 'tm-dashboard':
        return <TalentDashboard />
      case 'recruitment':
        return (
          <ComingSoonScreen
            title="Recruitment"
            description="Manage job openings, candidate pipelines, and interviews. Coming soon."
          />
        )
      case 'onboarding':
        return (
          <ComingSoonScreen
            title="Onboarding"
            description="Manage new hire checklists, welcome packages, and compliance. Coming soon."
          />
        )
      case 'performance':
        return (
          <ComingSoonScreen
            title="Performance"
            description="Conduct and track employee performance reviews and feedback. Coming soon."
          />
        )
      case 'compensation':
        return (
          <ComingSoonScreen
            title="Compensation"
            description="Manage salaries, bonuses, and equity grants. Coming soon."
          />
        )
      case 'mobility-succession':
        return (
          <ComingSoonScreen
            title="Mobility & Succession"
            description="Track internal transfers and manage succession planning. Coming soon."
          />
        )
      case 'offboarding':
        return (
          <ComingSoonScreen
            title="Offboarding"
            description="Process employee exits and conduct exit interviews. Coming soon."
          />
        )
      case 'administration':
        return (
          <ComingSoonScreen
            title="Administration"
            description="Configure Talent Management module settings. Coming soon."
          />
        )
      case 'audit-activity':
        return (
          <ComingSoonScreen
            title="Audit & Activity"
            description="View logs and history of Talent actions. Coming soon."
          />
        )
    }
  }

  // M4 — LMS
  if (active.moduleId === 'm4') {
    switch (active.submenuId) {
      case 'lms-dashboard':
        return <LmsDashboard />
      case 'learning-catalog':
        return <LearningCatalog />
      case 'my-learning':
        return <LearningDeliveryWorkspace />
      case 'create-course':
        return <CreateCoursePage />
      case 'assignments':
        return <LearningAssignments />
      case 'sessions-calendar':
        return <SessionsCalendar />
      case 'certifications':
        return <CertificationsRecords />
      case 'governance':
        return <LmsGovernance />
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
  /** AI Agent panel state */
  agentOpen?: boolean
  /** Callback when AI Agent panel open state changes */
  onAgentOpenChange?: (open: boolean) => void
}

export function GtgAppShell({
  children,
  initialActive,
  agentOpen,
  onAgentOpenChange,
}: GtgAppShellProps = {}) {
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

  const [internalAgentOpen, setInternalAgentOpen] = useState(false)
  const agentOpenState = agentOpen ?? internalAgentOpen
  const setAgentOpen = useCallback((next: boolean) => {
    setInternalAgentOpen(next)
    onAgentOpenChange?.(next)
  }, [onAgentOpenChange])

  const crumb = resolveBreadcrumb(active)

return (
    <div
      role="application"
      aria-label="GapstoGrowth HRMS"
      className="flex h-screen w-full bg-background overflow-hidden"
    >
      <GtgSidebar
        active={active}
        onSelect={handleNavSelect}
        role={user?.role || 'employee'}
      />

      <div className="flex h-screen w-full flex-col pl-[72px]">
        <GtgHeader agentOpen={agentOpenState} onAgentOpenChange={setAgentOpen} />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
            <GtgBreadcrumb
              module={crumb.module}
              menu={crumb.menu}
              submenu={crumb.submenu}
            />

            <main className="g2g-page-scroll g2g-scrollbar flex-1 bg-background overflow-auto">
              <div className="w-full min-h-full p-6">
                {children ?? renderContent(active, user?.role || 'employee')}
              </div>
            </main>
          </div>

          <aside
            aria-label="AI Agent Panel"
            className="flex-shrink-0 border-l border-border bg-background overflow-hidden transition-[width] duration-300"
            style={{
              width: agentOpenState ? 'var(--agent-panel-width)' : '0px',
              transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <div className="h-full">
              <AgentPanel onClose={() => setAgentOpen(false)} />
            </div>
          </aside>
        </div>

        <FloatingToolbar />
      </div>
    </div>
  )
}
