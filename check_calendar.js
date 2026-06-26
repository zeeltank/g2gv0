const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task';
const content = fs.readFileSync(path.join(dir, 'task-calendar-view.tsx'), 'utf8');
const index = content.indexOf('Month');
console.log(content.slice(Math.max(0, index - 200), index + 300));
