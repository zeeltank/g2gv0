const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task';

function processFile(filename, replacements) {
  const filePath = path.join(dir, filename);
  let content = fs.readFileSync(filePath, 'utf8');
  for (const { from, to } of replacements) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated ' + filename);
}

processFile('my-tasks-view.tsx', [
  { from: '<Button variant="ghost"\n              key={tab}', to: '<Button variant={activeTab === tab ? \'default\' : \'ghost\'}\n              key={tab}' },
  { from: 'activeTab === tab ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"', to: 'activeTab === tab ? "shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"' }
]);

processFile('task-approvals-view.tsx', [
  { from: 'activeTab === \'pending\' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"', to: 'activeTab === \'pending\' ? "shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"' },
  { from: 'activeTab === \'approved\' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"', to: 'activeTab === \'approved\' ? "shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"' },
  { from: 'activeTab === \'rejected\' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"', to: 'activeTab === \'rejected\' ? "shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"' }
]);

processFile('create-task-modal.tsx', [
  { from: 'priority === \'low\' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted"', to: 'priority === \'low\' ? "shadow-md" : "text-muted-foreground hover:bg-muted"' },
  { from: 'priority === \'medium\' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted"', to: 'priority === \'medium\' ? "shadow-md" : "text-muted-foreground hover:bg-muted"' },
  { from: 'priority === \'high\' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted"', to: 'priority === \'high\' ? "shadow-md" : "text-muted-foreground hover:bg-muted"' }
]);

