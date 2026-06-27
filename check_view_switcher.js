const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task';

const content = fs.readFileSync(path.join(dir, 'my-tasks-view.tsx'), 'utf8');
if (content.includes('setView(\'list\')')) {
  console.log('my-tasks-view view switcher snippet:');
  const index = content.indexOf('setView(\'list\')');
  console.log(content.slice(index - 100, index + 200));
}
