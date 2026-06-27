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

processFile('task-workspace.tsx', [
  { from: '<Button\n                onClick={() => setView(\'list\')}', to: '<Button variant="ghost"\n                onClick={() => setView(\'list\')}' },
  { from: '<Button\n                onClick={() => setView(\'board\')}', to: '<Button variant="ghost"\n                onClick={() => setView(\'board\')}' },
  { from: '<Button\n                onClick={() => setView(\'approvals\')}', to: '<Button variant="ghost"\n                onClick={() => setView(\'approvals\')}' },
  { from: '<Button\n                onClick={() => setView(\'workload\')}', to: '<Button variant="ghost"\n                onClick={() => setView(\'workload\')}' },
]);

processFile('task-approvals-view.tsx', [
  { from: '<Button\n            onClick={() => setActiveTab(\'pending\')}', to: '<Button variant="ghost"\n            onClick={() => setActiveTab(\'pending\')}' },
  { from: '<Button\n            onClick={() => setActiveTab(\'approved\')}', to: '<Button variant="ghost"\n            onClick={() => setActiveTab(\'approved\')}' },
  { from: '<Button\n            onClick={() => setActiveTab(\'rejected\')}', to: '<Button variant="ghost"\n            onClick={() => setActiveTab(\'rejected\')}' }
]);

processFile('my-tasks-view.tsx', [
  { from: '<Button\n              key={tab}', to: '<Button variant="ghost"\n              key={tab}' },
  { from: '<Button\n              onClick={() => setView(\'list\')}', to: '<Button variant="ghost"\n              onClick={() => setView(\'list\')}' },
  { from: '<Button\n              onClick={() => setView(\'board\')}', to: '<Button variant="ghost"\n              onClick={() => setView(\'board\')}' }
]);

processFile('create-project-modal.tsx', [
  { from: '<Button\n                        key={size}', to: '<Button variant="ghost"\n                        key={size}' },
  { from: '<Button \n                            onClick={() => setProjectData({ ...projectData, members: projectData.members.filter(m => m !== member) })}', to: '<Button variant="ghost"\n                            onClick={() => setProjectData({ ...projectData, members: projectData.members.filter(m => m !== member) })}' },
  { from: '<Button\n                        key={p.id}', to: '<Button variant="ghost"\n                        key={p.id}' },
  { from: '<Button\n                          key={flag.id}', to: '<Button variant="ghost"\n                          key={flag.id}' }
]);

processFile('create-task-modal.tsx', [
  { from: '<Button \n                      onClick={() => setPriority(\'low\')}', to: '<Button variant="ghost"\n                      onClick={() => setPriority(\'low\')}' },
  { from: '<Button \n                      onClick={() => setPriority(\'medium\')}', to: '<Button variant="ghost"\n                      onClick={() => setPriority(\'medium\')}' },
  { from: '<Button \n                      onClick={() => setPriority(\'high\')}', to: '<Button variant="ghost"\n                      onClick={() => setPriority(\'high\')}' }
]);

processFile('dependencies-view.tsx', [
  { from: '<Button\n                key={id}', to: '<Button variant="ghost"\n                key={id}' }
]);
