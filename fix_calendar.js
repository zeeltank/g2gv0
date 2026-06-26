const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task';
const filePath = path.join(dir, 'task-calendar-view.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr =                   <Button
                  key={v}
                  onClick={() => setView(v as any)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all duration-300",
                    view === v ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >;

const newStr =                   <Button
                  variant={view === v ? 'default' : 'ghost'}
                  key={v}
                  onClick={() => setView(v as any)}
                  className={cn(
                    "rounded-lg capitalize",
                    view === v ? "shadow-md" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >;

content = content.replace(targetStr, newStr);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed task-calendar-view.tsx');
