const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\org\\edit-employee';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const originalContent = content;

  // Replace submit button
  const submitRegex = /<button\s+type="submit"[^>]*className="[^"]*bg-primary[^"]*"[^>]*>([\s\S]*?)<\/button>/g;
  content = content.replace(submitRegex, (match, inner) => {
    changed = true;
    return '<Button type="submit" className="flex-1 sm:flex-none">' + inner + '</Button>';
  });

  // Replace discard/cancel button (outline)
  const discardRegex = /<button\s+type="button"[^>]*className="[^"]*border-border[^"]*"[^>]*>([\s\S]*?)<\/button>/g;
  content = content.replace(discardRegex, (match, inner) => {
    changed = true;
    return '<Button type="button" variant="outline" className="flex-1 sm:flex-none">' + inner + '</Button>';
  });

  if (content !== originalContent) {
    if (!content.includes("import { Button }")) {
       content = "import { Button } from '@/components/ui/button';\n" + content;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated " + file);
  }
}
