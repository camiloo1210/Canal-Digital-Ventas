const fs = require('fs');
const path = require('path');
const dir = 't:\\Camilo\\Canal-Digital-Ventas\\.quill.md\\issues\\open';
const files = fs.readdirSync(dir);
const map = {};
files.forEach(f => {
  if (f.endsWith('.md')) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const idMatch = content.match(/^id:\s*(.+)$/m);
    const titleMatch = content.match(/^title:\s*\"?([^\"]+)\"?$/m);
    if (idMatch && titleMatch) {
      map[titleMatch[1].trim()] = idMatch[1].trim();
    }
  }
});
fs.writeFileSync('t:\\Camilo\\Canal-Digital-Ventas\\id_map.json', JSON.stringify(map, null, 2));
console.log('Done!');
