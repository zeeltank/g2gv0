const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\lib';
const filePath = path.join(dir, 'gtg-navigation.ts');
let content = fs.readFileSync(filePath, 'utf8');

const oldM6 =     menus: [
      {
        id: 'tm-dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        submenus: [{ id: 'task-workspace', label: 'Workspace' }],
      },
      {
        id: 'tm-tasks',
        label: 'Tasks',
        icon: CheckSquare,
        submenus: [
          { id: 'my-tasks', label: 'My Tasks' },
        ],
      },
      {
        id: 'tm-projects',
        label: 'Projects & Workstreams',
        icon: Briefcase,
        submenus: [{ id: 'projects-list', label: 'Projects List' }],
      },
      {
        id: 'tm-dependencies',
        label: 'Dependencies',
        icon: Link,
        submenus: [{ id: 'dependencies-view', label: 'Dependencies View' }],
      },
      {
        id: 'tm-calendar',
        label: 'Calendar',
        icon: Calendar,
        submenus: [{ id: 'calendar-view', label: 'Calendar View' }],
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
    ],;

const newM6 =     menus: [
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
        id: 'tm-approvals',
        label: 'Approvals',
        icon: CheckCircle,
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
    ],;

if (content.includes(oldM6)) {
    content = content.replace(oldM6, newM6);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed gtg-navigation.ts');
} else {
    console.log('Could not find oldM6 string to replace.');
}
