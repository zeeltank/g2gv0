const fs = require('fs');

const fixFile = (file, replaces) => {
  let content = fs.readFileSync(file, 'utf8');
  for (const rep of replaces) {
    content = content.replace(rep[0], rep[1]);
  }
  fs.writeFileSync(file, content, 'utf8');
}

// 1. attendance-report-table.tsx
fixFile('c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\attendance\\attendance-report-table.tsx', [
  [/import \{ EnterpriseDataTable, type Column \} from '@\/components\/data\/enterprise-data-table'/g, "import { DataTable, type Column } from '@/components/ui/data-table'"],
  [/<EnterpriseDataTable/g, "<DataTable"]
]);

// 2. attendance-table-toolbar.tsx
fixFile('c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\attendance\\attendance-table-toolbar.tsx', [
  [/import type \{ Column \} from '@\/components\/data\/enterprise-data-table'/g, "import type { Column } from '@/components/ui/data-table'"]
]);

// 3. attendance-reports-page.tsx
fixFile('c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\attendance\\attendance-reports-page.tsx', [
  [/import \{ type Column \} from '@\/components\/data\/enterprise-data-table'/g, "import type { Column } from '@/components/ui/data-table'"]
]);

// 4. components/data/index.ts
let indexContent = fs.readFileSync('c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\data\\index.ts', 'utf8');
indexContent = indexContent.split('\n').filter(line => !line.includes('enterprise-data-table') && !line.includes('filter-bar')).join('\n');
fs.writeFileSync('c:\\Users\\MILAN\\Downloads\\g2gv0\\components\\data\\index.ts', indexContent, 'utf8');

console.log('Fixed imports for data-table');
