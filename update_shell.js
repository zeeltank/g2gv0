const fs = require('fs');
const path = require('path');
const shellPath = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\shell\\gtg-app-shell.tsx';
let shellContent = fs.readFileSync(shellPath, 'utf8');

const targetShell =   // M6 — Task Management
  if (active.moduleId === 'm6') {
    switch (active.submenuId) {
      case 'task-workspace':
        return <TaskWorkspace />
      case 'my-tasks':
        return <MyTasksView />
      case 'projects-list':
        return <ProjectsListView />
      case 'dependencies-view':
        return <DependenciesView />
      case 'calendar-view':
        return <TaskCalendarView />;

const newShell =   // M6 — Task Management
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
        return <div>Approvals coming soon</div>
      case 'tm-calendar':
      case 'calendar-view':
        return <TaskCalendarView />;

if (shellContent.includes(targetShell)) {
    shellContent = shellContent.replace(targetShell, newShell);
    fs.writeFileSync(shellPath, shellContent, 'utf8');
    console.log('Fixed gtg-app-shell.tsx');
} else {
    console.log('Could not find target string in gtg-app-shell.tsx');
}

const sidebarPath = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\shell\\gtg-sidebar.tsx';
let sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
const targetSidebar =                               onSelect({ moduleId: flyoutModuleId, menuId: menu.id, submenuId: '' });
const newSidebar =                               onSelect({ moduleId: flyoutModuleId, menuId: menu.id, submenuId: menu.id });
if (sidebarContent.includes(targetSidebar)) {
    sidebarContent = sidebarContent.replace(targetSidebar, newSidebar);
    fs.writeFileSync(sidebarPath, sidebarContent, 'utf8');
    console.log('Fixed gtg-sidebar.tsx');
} else {
    console.log('Could not find target string in gtg-sidebar.tsx');
}
