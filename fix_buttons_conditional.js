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

processFile('task-approvals-view.tsx', [
  { from: '<Button variant="ghost"\n            onClick={() => setActiveTab(\'pending\')}', to: '<Button variant={activeTab === \'pending\' ? \'default\' : \'ghost\'}\n            onClick={() => setActiveTab(\'pending\')}' },
  { from: '<Button variant="ghost"\n            onClick={() => setActiveTab(\'approved\')}', to: '<Button variant={activeTab === \'approved\' ? \'default\' : \'ghost\'}\n            onClick={() => setActiveTab(\'approved\')}' },
  { from: '<Button variant="ghost"\n            onClick={() => setActiveTab(\'rejected\')}', to: '<Button variant={activeTab === \'rejected\' ? \'default\' : \'ghost\'}\n            onClick={() => setActiveTab(\'rejected\')}' }
]);

processFile('create-task-modal.tsx', [
  { from: '<Button variant="ghost"\n                      onClick={() => setPriority(\'low\')}', to: '<Button variant={priority === \'low\' ? \'default\' : \'ghost\'}\n                      onClick={() => setPriority(\'low\')}' },
  { from: '<Button variant="ghost"\n                      onClick={() => setPriority(\'medium\')}', to: '<Button variant={priority === \'medium\' ? \'default\' : \'ghost\'}\n                      onClick={() => setPriority(\'medium\')}' },
  { from: '<Button variant="ghost"\n                      onClick={() => setPriority(\'high\')}', to: '<Button variant={priority === \'high\' ? \'default\' : \'ghost\'}\n                      onClick={() => setPriority(\'high\')}' }
]);

