const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task';
const content = fs.readFileSync(path.join(dir, 'my-tasks-view.tsx'), 'utf8');
const index = content.indexOf('Filters');
console.log(content.slice(Math.max(0, index - 200), index + 1000));
