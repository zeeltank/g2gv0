const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task';
const filePath = path.join(dir, 'my-tasks-view.tsx');
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace("<Button variant={activeTab === tab ? 'default' : 'ghost'}", "<Button variant=\"ghost\"");
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed my-tasks-view.tsx');
