const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task';
const filePath = path.join(dir, 'my-tasks-view.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetClassStr = "pb-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] cursor-pointer",
                taskGroup === tab 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground";

const newClassStr = "pb-3 text-sm font-medium transition-colors border-0 border-b-2 rounded-none h-auto px-1 hover:bg-transparent -mb-[1px] cursor-pointer",
                taskGroup === tab 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground";

content = content.replace(targetClassStr, newClassStr);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed my-tasks-view tabs');
