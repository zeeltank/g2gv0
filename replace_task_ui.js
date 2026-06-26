const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\task';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const originalContent = content;

  // Replace buttons
  if (content.includes('<button') || content.includes('</button>')) {
    content = content.replace(/<button/g, '<Button');
    content = content.replace(/<\/button>/g, '</Button>');
    changed = true;
    
    // Add import if missing
    if (!content.includes('import { Button }') && !content.includes('import {Button}')) {
       // Insert after the last import
       const lastImportIndex = content.lastIndexOf('import ');
       const endOfLastImport = content.indexOf('\n', lastImportIndex);
       content = content.slice(0, endOfLastImport + 1) + "import { Button } from '@/components/ui/button'\n" + content.slice(endOfLastImport + 1);
    }
  }

  // Replace tables
  if (content.includes('<table') || content.includes('</table')) {
    content = content.replace(/<table/g, '<Table');
    content = content.replace(/<\/table>/g, '</Table>');
    content = content.replace(/<thead/g, '<TableHeader');
    content = content.replace(/<\/thead>/g, '</TableHeader>');
    content = content.replace(/<tbody/g, '<TableBody');
    content = content.replace(/<\/tbody>/g, '</TableBody>');
    content = content.replace(/<tr/g, '<TableRow');
    content = content.replace(/<\/tr>/g, '</TableRow>');
    content = content.replace(/<th/g, '<TableHead');
    content = content.replace(/<\/th>/g, '</TableHead>');
    content = content.replace(/<td/g, '<TableCell');
    content = content.replace(/<\/td>/g, '</TableCell>');
    changed = true;

    if (!content.includes('import { Table')) {
       const lastImportIndex = content.lastIndexOf('import ');
       const endOfLastImport = content.indexOf('\n', lastImportIndex);
       content = content.slice(0, endOfLastImport + 1) + "import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'\n" + content.slice(endOfLastImport + 1);
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated " + file);
  }
}
