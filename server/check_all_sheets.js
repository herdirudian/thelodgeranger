const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const checklistDir = 'C:\\xampp\\htdocs\\thelodgeranger\\Checklist';
const files = fs.readdirSync(checklistDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

files.forEach(file => {
    try {
        const workbook = XLSX.readFile(path.join(checklistDir, file));
        console.log(`${file}: [${workbook.SheetNames.join(', ')}]`);
    } catch (e) {
        console.log(`${file}: Error`);
    }
});
