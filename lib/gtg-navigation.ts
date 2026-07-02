import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Users,
  ShieldCheck,
  Library,
  Briefcase,
  Gauge,
  BookOpen,
  ClipboardCheck,
  CalendarClock,
  CalendarDays,
  Wallet,
  LayoutDashboard,
  CheckSquare,
  Network,
  Link,
  CheckCircle,
  Calendar,
  FileDown,
  Shield,
  Settings,
  UserPlus,
  TrendingUp,
  FileText,
  LayoutGrid,
  User,
  Target,
  Award,
  Megaphone,
  BarChart3,
  ListChecks,
  ArrowRightLeft,
  LogOut,
  DollarSign
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
      { id: 'cm-command-center', label: 'Command Center', icon: LayoutGrid, submenus: [] },
      { id: 'cm-competency-library', label: 'Competency Library', icon: BookOpen, submenus: [] },
      { id: 'cm-framework-mapping', label: 'Framework & Role Mapping', icon: Network, submenus: [] },
      { id: 'cm-assessments', label: 'Assessments', icon: ClipboardCheck, submenus: [] },
      { id: 'cm-employee-profiles', label: 'Employee Profiles', icon: User, submenus: [] },
      { id: 'cm-development-career', label: 'Development & Career Paths', icon: Target, submenus: [] },
      { id: 'cm-certifications', label: 'Certifications', icon: Award, submenus: [] },
      { id: 'cm-audit', label: 'Audit & Activity Center', icon: ShieldCheck, submenus: [] },
    ],
  },
  {
    id: 'm3',
    label: 'Talent Management',
    short: 'M3',
    icon: UserPlus,
    menus: [
      { id: 'tm-dashboard', label: 'Dashboard', icon: LayoutDashboard, submenus: [] },
      { id: 'recruitment', label: 'Recruitment', icon: Briefcase, submenus: [] },
      { id: 'onboarding', label: 'Onboarding', icon: UserPlus, submenus: [] },
      { id: 'performance', label: 'Performance', icon: TrendingUp, submenus: [] },
      { id: 'compensation', label: 'Compensation', icon: DollarSign, submenus: [] },
      { id: 'mobility-succession', label: 'Mobility & Succession', icon: ArrowRightLeft, submenus: [] },
      { id: 'offboarding', label: 'Offboarding', icon: LogOut, submenus: [] },
      { id: 'administration', label: 'Administration', icon: Settings, submenus: [] },
      { id: 'audit-activity', label: 'Audit & Activity', icon: FileText, submenus: [] },
    ],
  },
  {
    id: 'm4',
    label: 'LMS',
    short: 'M4',
    icon: BookOpen,
    menus: [
      {
        id: 'learning',
        label: 'Learning',
        icon: BookOpen,
        submenus: [
          { id: 'lms-dashboard', label: 'Dashboard' },
          { id: 'learning-catalog', label: 'Learning Catalog' },
          { id: 'my-learning', label: 'My Learning' },
        ],
      },
      {
        id: 'training-records',
        label: 'Training & Records',
        icon: CalendarClock,
        submenus: [
          { id: 'assignments', label: 'Assignments' },
          { id: 'sessions-calendar', label: 'Sessions & Calendar' },
          { id: 'certifications', label: 'Certifications & Records' },
        ],
      },
      {
        id: 'lms-administration',
        label: 'Administration',
        icon: Settings,
        submenus: [
          { id: 'create-course', label: 'Course Builder' },
          { id: 'governance', label: 'Admin & Governance' },
        ],
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
        submenus: [
          { id: 'leave-dashboard', label: 'Dashboard' },
          { id: 'leave-requests', label: 'Leave Requests' },
          { id: 'leave-reports', label: 'Reports' },
          { id: 'leave-configuration', label: 'Configuration' },
        ],
      },
      {
        id: 'payroll-management',
        label: 'Payroll Management',
        icon: Wallet,
        submenus: [{ id: 'payroll-processing', label: 'Payroll Processing' }],
      },
    ],
  },
  {
    id: 'm6',
    label: 'Task Management',
    short: 'TM',
    icon: ListChecks,
    menus: [
      {
        id: 'tm-dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        submenus: [],
      },
      {
        id: 'tm-tasks',
        label: 'My Tasks',
        icon: CheckSquare,
        submenus: [],
      },
      {
        id: 'tm-projects',
        label: 'Projects & Workstreams',
        icon: Briefcase,
        submenus: [],
      },
      {
        id: 'tm-dependencies',
        label: 'Dependencies',
        icon: Link,
        submenus: [],
      },
      {
        id: 'tm-calendar',
        label: 'Calendar',
        icon: Calendar,
        submenus: [],
      },
      {
        id: 'tm-admin',
        label: 'Administration',
        icon: Shield,
        submenus: [
          { id: 'status-management', label: 'Status Management' },
          { id: 'priority-management', label: 'Priority Management' },
          { id: 'permissions', label: 'Permissions' },
          { id: 'integrations', label: 'Integrations' },
          { id: 'audit-logs', label: 'Audit Logs' },
        ],
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