const fs = require('fs');
const files = [
  'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\org\\employee-directory.tsx',
  'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task\\task-workspace.tsx',
  'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task\\my-tasks-view.tsx',
  'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task\\dependencies-view.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const mapRegex = /\{(pulseData|pulseCards)\.map\(\(card, idx\) => \(([\s\S]*?)<card\.icon([^>]+)>([\s\S]*?)\)\)\}/g;
  
  const newContent = content.replace(mapRegex, (match, dataVar, before, attrs, after) => {
     changed = true;
     return '{' + dataVar + '.map((card, idx) => {\n  const Icon = card.icon;\n  return (' + before + '<Icon' + attrs + '>' + after + ');\n})}';
  });

  if (changed) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log("Fixed " + file);
  }
}
