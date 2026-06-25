import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Users,
  ListChecks,
  ShieldCheck,
  Library,
  Briefcase,
  Gauge,
  UserPlus,
  TrendingUp,
  FileText,
  BookOpen,
  ClipboardCheck,
  CalendarClock,
  CalendarDays,
  Wallet,
  Network,
} from 'lucide-react'

export type NavSubmenu = {
  id: string
  label: string
}

export type NavMenu = {
  id: string
  label: string
  icon: LucideIcon
  submenus: NavSubmenu[]
}

export type NavModule = {
  id: string
  label: string
  short: string
  icon: LucideIcon
  menus: NavMenu[]
}

/**
 * Exact navigation hierarchy from the GTG Architecture Reference:
 * 5 Modules -> 16 Menus -> 30 Submenus.
 */
export const GTG_NAVIGATION: NavModule[] = [
  {
    id: 'm1',
    label: 'Organizational Management',
    short: 'M1',
    icon: Network,
    menus: [
      {
        id: 'org-setup',
        label: 'Organization Setup',
        icon: Building2,
        submenus: [
          { id: 'org-profile', label: 'Organization Profile' },
          { id: 'dept-management', label: 'Department Management' },
        ],
      },
      {
        id: 'user-management',
        label: 'User Management',
        icon: Users,
        submenus: [
          { id: 'employee-directory', label: 'Employee Directory' },
          { id: 'role-permissions', label: 'Role & Permissions' },
        ],
      },
      {
        id: 'task-management',
        label: 'Task Management',
        icon: ListChecks,
        submenus: [
          { id: 'task-workspace', label: 'Task Workspace' },
        ],
      },
      {
        id: 'compliance-discipline',
        label: 'Compliance & Discipline',
        icon: ShieldCheck,
        submenus: [
          { id: 'compliance-management', label: 'Compliance Management' },
          { id: 'disciplinary-management', label: 'Disciplinary Management' },
        ],
      },
    ],
  },
  {
    id: 'm2',
    label: 'Competency Management',
    short: 'M2',
    icon: Library,
    menus: [
      {
        id: 'competency-library',
        label: 'Competency Library',
        icon: Library,
        submenus: [{ id: 'taxonomy-library', label: 'Taxonomy & Library' }],
      },
      {
        id: 'job-role-library',
        label: 'Job Role Library',
        icon: Briefcase,
        submenus: [{ id: 'job-role-catalogue', label: 'Job Role Catalogue' }],
      },
      {
        id: 'competency-rating',
        label: 'Competency Rating',
        icon: Gauge,
        submenus: [{ id: 'employee-rating', label: 'Employee Rating' }],
      },
    ],
  },
  {
    id: 'm3',
    label: 'Talent Management',
    short: 'M3',
    icon: UserPlus,
    menus: [
      {
        id: 'talent-acquisition',
        label: 'Talent Acquisition',
        icon: UserPlus,
        submenus: [
          { id: 'recruitment-dashboard', label: 'Recruitment Dashboard' },
          { id: 'job-postings', label: 'Job Postings' },
          { id: 'interview-management', label: 'Interview Management' },
          { id: 'manager-hub', label: 'Manager Hub' },
        ],
      },
      {
        id: 'performance-management',
        label: 'Performance Management',
        icon: TrendingUp,
        submenus: [
          { id: 'performance-reviews', label: 'Performance Reviews' },
          { id: 'appraisals-succession', label: 'Appraisals & Succession' },
        ],
      },
      {
        id: 'hr-template-engine',
        label: 'HR Template Engine',
        icon: FileText,
        submenus: [{ id: 'document-templates', label: 'Document Templates' }],
      },
    ],
  },
  {
    id: 'm4',
    label: 'LMS',
    short: 'M4',
    icon: BookOpen,
    menus: [
      {
        id: 'content-library',
        label: 'Content Library',
        icon: BookOpen,
        submenus: [
          { id: 'learning-dashboard', label: 'Learning Dashboard' },
          { id: 'course-catalogue', label: 'Course Catalogue' },
        ],
      },
      {
        id: 'assessment-library',
        label: 'Assessment Library',
        icon: ClipboardCheck,
        submenus: [{ id: 'assessment-centre', label: 'Assessment Centre' }],
      },
    ],
  },
  {
    id: 'm5',
    label: 'HRIT Solutions',
    short: 'M5',
    icon: CalendarClock,
    menus: [
      {
        id: 'attendance-management',
        label: 'Attendance Management',
        icon: CalendarClock,
        submenus: [
          { id: 'attendance-tracking', label: 'Attendance Tracking' },
          { id: 'attendance-reports', label: 'Attendance Reports' },
        ],
      },
      {
        id: 'leave-management',
        label: 'Leave Management',
        icon: CalendarDays,
        submenus: [{ id: 'leave-operations', label: 'Leave Operations' }],
      },
      {
        id: 'payroll-management',
        label: 'Payroll Management',
        icon: Wallet,
        submenus: [{ id: 'payroll-processing', label: 'Payroll Processing' }],
      },
    ],
  },
]

export type ActiveNav = {
  moduleId: string
  menuId: string
  submenuId: string
}

export function resolveBreadcrumb(active: ActiveNav) {
  const module = GTG_NAVIGATION.find((m) => m.id === active.moduleId)
  const menu = module?.menus.find((mn) => mn.id === active.menuId)
  const submenu = menu?.submenus.find((s) => s.id === active.submenuId)
  return {
    module: module?.label ?? '',
    menu: menu?.label ?? '',
    submenu: submenu?.label ?? '',
  }
}