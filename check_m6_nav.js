const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\MILAN\\Downloads\\g2gv0\\lib';
const content = fs.readFileSync(path.join(dir, 'gtg-navigation.ts'), 'utf8');
const startIndex = content.indexOf('id: \'m6\'');
const endIndex = content.indexOf(']', content.indexOf('menus:', startIndex));
console.log(content.slice(startIndex, endIndex + 50));
